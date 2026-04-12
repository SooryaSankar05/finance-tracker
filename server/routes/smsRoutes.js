const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const jwt = require("jsonwebtoken");

const Transaction = require("../models/Transaction");
const extractAmount = require("../utils/parser");
const categorize = require("../utils/categorize");
const extractMerchant = require("../utils/extractMerchant");

// ---------- HELPERS ----------

function detectType(text) {
  const l = (text || "").toLowerCase();
  if (
    l.includes("credited") ||
    l.includes("received") ||
    l.includes("salary") ||
    l.includes("refund") ||
    l.includes("cashback") ||
    l.includes("reversal")
  )
    return "income";
  return "expense";
}

function isBankSMS(text, sender) {
  if (!text) return false;

  const t = text.toLowerCase();
  const s = (sender || "").toUpperCase();

  const bankSenders = [
    "HDFC",
    "ICICI",
    "SBIINB",
    "SBIPSG",
    "AXISBANK",
    "KOTAKBANK",
    "INDUSIND",
    "YESBANK",
    "PNBSMS",
    "BOISMS",
    "CANBNK",
    "UNIONBK",
    "PAYTM",
    "PHONEPE",
    "GPAY",
    "AMAZON",
    "CRED",
  ];

  if (bankSenders.some((b) => s.includes(b))) return true;

  return (
    (t.includes("debited") || t.includes("credited")) &&
    (t.includes("rs") || t.includes("inr") || t.includes("₹"))
  );
}

// ---------- ANDROID APP SYNC (PROTECTED) ----------

router.post("/sync", auth, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages[] required" });
    }

    const bankMessages = messages.filter((m) => isBankSMS(m.text, m.sender));

    if (!bankMessages.length) {
      return res.json({
        inserted: 0,
        skipped: messages.length,
        message: "No bank SMS found",
      });
    }

    const docs = bankMessages.map((m) => ({
      text: m.text,
      amount: extractAmount(m.text),
      category: categorize(m.text),
      type: detectType(m.text),
      merchant: extractMerchant(m.text),
      user: req.userId,
      date: m.timestamp ? new Date(m.timestamp) : new Date(),
      note: "",
    }));

    let inserted = 0;
    let skipped = 0;

    for (const doc of docs) {
      try {
        await Transaction.create(doc);
        inserted++;
      } catch (e) {
        if (e.code === 11000) skipped++;
        else throw e;
      }
    }

    res.json({
      inserted,
      skipped,
      total: messages.length,
      bankFound: bankMessages.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- LAST SYNC ----------

router.get("/last-sync", auth, async (req, res) => {
  try {
    const latest = await Transaction.findOne(
      { user: req.userId },
      { date: 1 },
      { sort: { date: -1 } },
    );

    res.json({ lastSync: latest?.date || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- SMS FORWARDER WEBHOOK (JWT BASED) ----------

router.post("/", async (req, res) => {
  console.log("🔥 HIT API", req.body);

  const { sender, message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "No message" });
  }

  // 🔍 Filter: Only process financial SMS
  if (!isBankSMS(message, sender)) {
    return res.json({ skipped: true, reason: "Not bank SMS" });
  }

  const amount = extractAmount(message);

  if (!amount || amount === 0) {
    return res.json({ skipped: true, reason: "No valid amount" });
  }

  const tx = await Transaction.create({
    text: message,
    amount,
    category: categorize(message),
    type: detectType(message),
    merchant: extractMerchant(message),
    note: sender || "",
    user: "test-user",
    date: new Date(),
  });

  res.json({ ok: true, id: tx._id });
});

module.exports = router;
