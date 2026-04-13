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
          "GEMINI_API_KEY not configured on server. Add it to your Render environment variables.",
      });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    // Convert to Gemini format (assistant -> model)
    let contents = messages
      .filter((m) => m.role && m.content)
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.content) }],
      }));

    // Gemini requires conversation to start with "user" role — drop any leading model messages
    while (contents.length > 0 && contents[0].role === "model") {
      contents = contents.slice(1);
    }
    if (contents.length === 0) {
      contents = [{ role: "user", parts: [{ text: "Hello" }] }];
    }

    const body = JSON.stringify({
      system_instruction: {
        parts: [
          {
            text:
              systemPrompt ||
              "You are MoneyMind, a helpful personal finance assistant.",
          },
        ],
      },
      contents,
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      },
    });

    // ✅ FIXED MODEL LIST — only models confirmed to work on v1beta
    // Removed: gemini-1.5-flash-8b (not on v1beta), gemini-2.5-flash (preview, unstable)
    const MODELS = [
      "gemini-2.0-flash", // best free tier — fast and reliable
      "gemini-1.5-flash", // proven fallback
      "gemini-2.0-flash-lite", // lightweight last resort
    ];

    let lastError = null;

    for (const model of MODELS) {
      try {
        console.log(`Trying Gemini model: ${model}`);
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
          const errMsg =
            data.error?.message || `${model} returned HTTP ${response.status}`;
          console.warn(`Model ${model} failed: ${errMsg}`);
          lastError = errMsg;
          continue;
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
          const finishReason = data.candidates?.[0]?.finishReason;
          lastError = finishReason
            ? `Response blocked (${finishReason})`
            : "Empty response from Gemini";
          console.warn(`Model ${model}: ${lastError}`);
          continue;
        }

        console.log(`✅ AI responded using model: ${model}`);
        return res.json({ content: [{ type: "text", text }] });
      } catch (fetchErr) {
        console.warn(`Fetch error for ${model}:`, fetchErr.message);
        lastError = fetchErr.message;
        continue;
      }
    }

    console.error("All Gemini models failed. Last error:", lastError);
    return res.status(500).json({
      error: `AI unavailable right now. Please try again in a moment.`,
    });
  } catch (err) {
    console.error("Chat route error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
