// FILE: server/routes/pdfRoutes.js
// REPLACE your existing pdfRoutes.js with this entire file

const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");
const auth = require("../middleware/auth");
const Transaction = require("../models/Transaction");
const categorize = require("../utils/categorize");
const extractMerchant = require("../utils/extractMerchant");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function parseAmount(str) {
  if (!str) return 0;
  const n = parseFloat(str.replace(/,/g, "").trim());
  return isNaN(n) ? 0 : n;
}

function parseDate(str) {
  if (!str) return new Date();
  // DD/MM/YY or DD/MM/YYYY
  const parts = str.trim().split("/");
  if (parts.length === 3) {
    let [d, m, y] = parts;
    if (y.length === 2) y = "20" + y;
    const dt = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    if (!isNaN(dt)) return dt;
  }
  // DD MMM YY or DD MMM YYYY
  const dt2 = new Date(str);
  if (!isNaN(dt2)) return dt2;
  return new Date();
}

function detectType(narration, withdrawalAmt, depositAmt) {
  if (depositAmt > 0 && withdrawalAmt === 0) return "income";
  if (withdrawalAmt > 0 && depositAmt === 0) return "expense";
  const l = (narration || "").toLowerCase();
  if (
    l.includes("credited") ||
    l.includes("salary") ||
    l.includes("refund") ||
    l.includes("cashback") ||
    l.includes("reversal") ||
    l.includes("received")
  )
    return "income";
  return "expense";
}

function cleanNarration(str) {
  return (str || "")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s@.\-\/]/g, " ")
    .trim()
    .slice(0, 120);
}

function extractHDFCMerchant(narration) {
  return (
    extractMerchant(narration) || narration.split(" ").slice(0, 4).join(" ")
  );
}

// ─────────────────────────────────────────────────────────────
// HDFC BANK STATEMENT PARSER
//
// HDFC PDF text layout (after pdf-parse):
//   Each row looks like:
//   "01/01/26 UPI-XXXXXXXXX5307-SBIN0000756-600100565078\n-SENT USING PAYTM U  000800100565078  01/01/26  500.00    260,524.80"
//
// Key insight: the LAST number with decimals on a row = closing balance
//              the SECOND-TO-LAST = transaction amount (withdrawal OR deposit)
//              We determine debit/credit by looking at whether closing balance
//              went UP (deposit) or DOWN (withdrawal) from previous row.
// ─────────────────────────────────────────────────────────────

function parseHDFCStatement(text) {
  const transactions = [];

  // Normalize: collapse all whitespace runs to single space, keep newlines
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Join multi-line narrations — HDFC splits long narrations across lines
  // A transaction line starts with a date pattern DD/MM/YY or DD/MM/YYYY
  const DATE_RE = /^\d{2}\/\d{2}\/\d{2,4}/;

  const rows = [];
  let currentRow = null;

  for (const line of lines) {
    if (DATE_RE.test(line)) {
      if (currentRow) rows.push(currentRow);
      currentRow = line;
    } else if (currentRow) {
      // Continuation of previous row (multi-line narration)
      currentRow += " " + line;
    }
  }
  if (currentRow) rows.push(currentRow);

  let prevClosing = null;

  for (const row of rows) {
    // Extract all decimal amounts from the row — format: 1,234.56 or 123.45
    const AMOUNT_RE = /\b(\d{1,3}(?:,\d{2,3})*\.\d{2})\b/g;
    const allAmounts = [...row.matchAll(AMOUNT_RE)].map((m) => ({
      raw: m[1],
      value: parseAmount(m[1]),
      index: m.index,
    }));

    // Need at least 2 amounts: one transaction amount + closing balance
    if (allAmounts.length < 2) continue;

    // Extract date at start
    const dateMatch = row.match(/^(\d{2}\/\d{2}\/\d{2,4})/);
    if (!dateMatch) continue;
    const date = parseDate(dateMatch[1]);

    // Closing balance = last amount
    const closingBalance = allAmounts[allAmounts.length - 1].value;

    // Skip if closing balance looks invalid (too small or too large)
    if (closingBalance < 0 || closingBalance > 99999999) continue;

    // Get the narration — text between date and the first long ref number
    const afterDate = row.slice(dateMatch[0].length).trim();

    // HDFC ref numbers are typically 12-20 digit pure-number strings
    // Remove them from narration
    const REF_RE = /\b\d{10,20}\b/g;
    let narration = afterDate
      .replace(REF_RE, " ")
      .replace(AMOUNT_RE, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Also remove value date (second date in row like "01/01/26")
    narration = narration.replace(/\b\d{2}\/\d{2}\/\d{2,4}\b/g, "").trim();
    narration = cleanNarration(narration);

    if (!narration || narration.length < 3) continue;

    // Determine transaction amount and type
    // Strategy: compare closing balance to previous closing balance
    let withdrawalAmt = 0;
    let depositAmt = 0;
    let amount = 0;

    if (allAmounts.length === 2) {
      // Only one transaction amount before closing balance
      amount = allAmounts[0].value;
      if (prevClosing !== null) {
        if (closingBalance > prevClosing) depositAmt = amount;
        else withdrawalAmt = amount;
      } else {
        // First row — use narration to guess
        const type = detectType(narration, 1, 0);
        if (type === "income") depositAmt = amount;
        else withdrawalAmt = amount;
      }
    } else if (allAmounts.length >= 3) {
      // Could be withdrawal+closing, deposit+closing, or withdrawal+deposit+closing
      // The transaction amounts are all except the last one
      const txAmounts = allAmounts.slice(0, -1);

      // Use balance direction to figure out which is debit/credit
      if (prevClosing !== null) {
        const balanceDiff = closingBalance - prevClosing;
        if (balanceDiff > 0) {
          // Balance went up — deposit
          // Find the amount closest to balanceDiff
          depositAmt = txAmounts.reduce((best, a) =>
            Math.abs(a.value - balanceDiff) < Math.abs(best.value - balanceDiff)
              ? a
              : best,
          ).value;
        } else {
          // Balance went down — withdrawal
          withdrawalAmt = txAmounts.reduce((best, a) =>
            Math.abs(a.value - Math.abs(balanceDiff)) <
            Math.abs(best.value - Math.abs(balanceDiff))
              ? a
              : best,
          ).value;
        }
      } else {
        // No previous balance — take second-to-last as transaction amount
        const txAmt = allAmounts[allAmounts.length - 2].value;
        const type = detectType(narration, 1, 0);
        if (type === "income") depositAmt = txAmt;
        else withdrawalAmt = txAmt;
      }
      amount = depositAmt > 0 ? depositAmt : withdrawalAmt;
    }

    if (amount <= 0 || amount > 10000000) {
      prevClosing = closingBalance;
      continue;
    }

    prevClosing = closingBalance;

    const type = detectType(narration, withdrawalAmt, depositAmt);
    const merchant = extractHDFCMerchant(narration);
    const category = categorize(narration);

    transactions.push({
      date,
      narration,
      merchant,
      amount,
      type,
      category,
      withdrawalAmt,
      depositAmt,
    });
  }

  return transactions;
}

// ─────────────────────────────────────────────────────────────
// SBI BANK STATEMENT PARSER
// Columns: Txn Date | Description | Ref No | Debit | Credit | Balance
// ─────────────────────────────────────────────────────────────

function parseSBIStatement(text) {
  const transactions = [];
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const DATE_RE = /^\d{2}\s+\w{3}\s+\d{4}/; // "01 Jan 2026"

  for (const line of lines) {
    if (!DATE_RE.test(line)) continue;
    const AMOUNT_RE = /\b(\d{1,3}(?:,\d{2,3})*\.\d{2})\b/g;
    const amounts = [...line.matchAll(AMOUNT_RE)].map((m) => parseAmount(m[1]));
    if (amounts.length < 2) continue;

    const dateMatch = line.match(/^(\d{2}\s+\w{3}\s+\d{4})/);
    const date = dateMatch ? new Date(dateMatch[1]) : new Date();
    const closing = amounts[amounts.length - 1];
    const txAmt = amounts[amounts.length - 2];

    if (txAmt <= 0 || txAmt > 10000000) continue;

    const afterDate = line.slice(dateMatch ? dateMatch[0].length : 0);
    const narration = cleanNarration(
      afterDate
        .replace(/\d{1,3}(?:,\d{2,3})*\.\d{2}/g, "")
        .replace(/\d{6,}/g, ""),
    );
    if (!narration || narration.length < 3) continue;

    const type = detectType(narration, txAmt, 0);
    transactions.push({
      date,
      narration,
      merchant: extractHDFCMerchant(narration),
      amount: txAmt,
      type,
      category: categorize(narration),
      withdrawalAmt: type === "expense" ? txAmt : 0,
      depositAmt: type === "income" ? txAmt : 0,
    });
  }
  return transactions;
}

// ─────────────────────────────────────────────────────────────
// GENERIC FALLBACK PARSER
// Works for any statement that has date + description + amount on same line
// ─────────────────────────────────────────────────────────────

function parseFallback(text) {
  const transactions = [];
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (!/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/.test(line)) continue;

    const AMOUNT_RE = /\b(\d{1,3}(?:,\d{2,3})*\.\d{2})\b/g;
    const amounts = [...line.matchAll(AMOUNT_RE)].map((m) => parseAmount(m[1]));
    if (amounts.length < 2) continue;

    // Second-to-last = transaction amount, last = balance
    const txAmt = amounts[amounts.length - 2];
    if (txAmt <= 0 || txAmt > 10000000) continue;

    const dateMatch = line.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})/);
    const date = dateMatch
      ? parseDate(dateMatch[1].replace(/-/g, "/"))
      : new Date();

    const narration = cleanNarration(
      line
        .replace(/\d{1,3}(?:,\d{2,3})*\.\d{2}/g, "")
        .replace(/\d{8,}/g, "")
        .replace(/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/g, ""),
    );
    if (!narration || narration.length < 3) continue;

    const type = detectType(narration, txAmt, 0);
    transactions.push({
      date,
      narration,
      merchant: extractHDFCMerchant(narration),
      amount: txAmt,
      type,
      category: categorize(narration),
      withdrawalAmt: type === "expense" ? txAmt : 0,
      depositAmt: type === "income" ? txAmt : 0,
    });
  }
  return transactions;
}

// ─────────────────────────────────────────────────────────────
// DETECT BANK TYPE FROM TEXT
// ─────────────────────────────────────────────────────────────

function detectBank(text) {
  const t = text.slice(0, 2000).toUpperCase();
  if (t.includes("HDFC BANK")) return "HDFC";
  if (t.includes("STATE BANK OF INDIA") || t.includes("SBI")) return "SBI";
  if (t.includes("ICICI BANK")) return "ICICI";
  if (t.includes("AXIS BANK")) return "AXIS";
  if (t.includes("KOTAK")) return "KOTAK";
  return "GENERIC";
}

// ─────────────────────────────────────────────────────────────
// POST /api/pdf/upload
// ─────────────────────────────────────────────────────────────

router.post("/upload", auth, upload.single("statement"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No PDF file uploaded" });

    let pdfData;
    try {
      pdfData = await pdfParse(req.file.buffer);
    } catch (e) {
      return res.status(400).json({
        error:
          "Could not read PDF. Make sure it's a text-based PDF, not a scanned image.",
      });
    }

    const text = pdfData.text;
    if (!text || text.trim().length < 50) {
      return res.status(400).json({
        error: "PDF appears to be empty or scanned. Text-based PDFs only.",
      });
    }

    const bank = detectBank(text);
    let parsed = [];

    if (bank === "HDFC") {
      parsed = parseHDFCStatement(text);
    } else if (bank === "SBI") {
      parsed = parseSBIStatement(text);
    } else {
      parsed = parseHDFCStatement(text); // Try HDFC format first
      if (parsed.length === 0) parsed = parseFallback(text);
    }

    if (parsed.length === 0) {
      return res.status(400).json({
        error:
          "No transactions found. Supported banks: HDFC, SBI, ICICI, Axis. Make sure your PDF is a text-based statement.",
        rawTextSample: text.slice(0, 800),
      });
    }

    let inserted = 0,
      skipped = 0;

    for (const txn of parsed) {
      try {
        const textKey = `PDF:${txn.narration.slice(0, 80)}:${txn.amount}:${txn.date.toISOString().slice(0, 10)}:${req.userId}`;
        await Transaction.create({
          text: textKey,
          amount: txn.amount,
          category: txn.category,
          type: txn.type,
          merchant: txn.merchant,
          note: txn.narration.slice(0, 100),
          user: req.userId,
          date: txn.date,
        });
        inserted++;
      } catch (e) {
        if (e.code === 11000) skipped++;
      }
    }

    res.json({
      success: true,
      bank,
      parsed: parsed.length,
      inserted,
      skipped,
      message: `Imported ${inserted} transactions from your ${bank} statement${skipped > 0 ? ` (${skipped} duplicates skipped)` : ""}.`,
      preview: parsed.slice(0, 8).map((t) => ({
        date: t.date.toLocaleDateString("en-IN"),
        merchant: t.merchant,
        amount: t.amount,
        type: t.type,
        category: t.category,
      })),
    });
  } catch (err) {
    console.error("PDF upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pdf/test
router.get("/test", auth, (req, res) =>
  res.json({ ok: true, message: "PDF upload endpoint working" }),
);

module.exports = router;
