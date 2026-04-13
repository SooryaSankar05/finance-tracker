const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const tc = require("../controllers/transactionController");
const gc = require("../controllers/goalsController");

router.post("/add", auth, tc.addTransaction);
router.get("/all", auth, tc.getTransactions);
router.get("/insights", auth, tc.getInsights);
router.get("/weekly", auth, tc.getWeeklyReport);
router.get("/budget-alerts", auth, tc.getBudgetAlerts);
router.get("/merchants", auth, tc.getMerchantSummary);
router.get("/monthly", auth, tc.getMonthlyData);
router.get("/category-summary", auth, tc.getCategorySummary);
router.post("/bulk", auth, tc.bulkAddTransactions);
router.get("/ai-context", auth, tc.getAIContext);
router.get("/budgets", auth, tc.getBudgets);
router.post("/budgets", auth, tc.setBudget);
router.delete("/:id", auth, tc.deleteTransaction);

router.get("/goals", auth, gc.getGoals);
router.post("/goals", auth, gc.createGoal);
router.put("/goals/:id", auth, gc.updateGoal);
router.delete("/goals/:id", auth, gc.deleteGoal);

router.get("/splits", auth, gc.getSplits);
router.post("/splits", auth, gc.createSplit);
router.put("/splits/:id", auth, gc.updateSplit);
router.delete("/splits/:id", auth, gc.deleteSplit);

// ── AI CHAT ───────────────────────────────────────────────────────────────────
router.post("/chat", auth, async (req, res) => {
  try {
    const { messages, systemPrompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          "GEMINI_API_KEY not set. Get your free key at https://aistudio.google.com/app/apikey then add it to server/.env",
      });
    }

    // Convert messages — drop any leading assistant message since
    // Gemini requires the conversation to start with "user" role
    const filtered = messages.filter((m) => m.role && m.content);
    let startIdx = 0;
    while (
      startIdx < filtered.length &&
      filtered[startIdx].role === "assistant"
    ) {
      startIdx++;
    }
    const contents = filtered.slice(startIdx).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    if (contents.length === 0) {
      return res.status(400).json({ error: "No valid messages to send" });
    }

    const body = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    });

    // ✅ FIXED model list — gemini-1.5-flash replaced with gemini-2.0-flash-lite
    // gemini-1.5-flash returns 404 on v1beta as of 2026
    const MODELS = [
      "gemini-2.5-flash", // best — worked on your localhost
      "gemini-2.0-flash", // reliable fallback
      "gemini-2.0-flash-lite", // lightweight last resort (replaces broken gemini-1.5-flash)
    ];

    let lastError = null;

    for (const model of MODELS) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          },
        );

        const data = await response.json();

        if (!response.ok || data.error) {
          console.warn(`Model ${model} failed:`, data.error?.message);
          lastError = data.error?.message || `${model} failed`;
          continue;
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          lastError = "Empty response from Gemini";
          continue;
        }

        console.log(`AI responded using model: ${model}`);
        return res.json({ content: [{ type: "text", text }] });
      } catch (fetchErr) {
        console.warn(`Fetch error for model ${model}:`, fetchErr.message);
        lastError = fetchErr.message;
        continue;
      }
    }

    // All models failed
    return res.status(500).json({
      error: `All Gemini models failed. Last error: ${lastError}. Check your API key at aistudio.google.com`,
    });
  } catch (err) {
    console.error("Chat route error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
