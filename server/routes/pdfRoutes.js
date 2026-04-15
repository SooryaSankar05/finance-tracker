// FILE: server/routes/pdfRoutes.js
// REPLACE your existing pdfRoutes.js with this entire file

const express = require("express");
const router = express.Router();
const multer = require("multer");
const _pdfParseMod = require("pdf-parse");
const pdfParse = typeof _pdfParseMod === "function" ? _pdfParseMod : _pdfParseMod.default;
const auth = require("../middleware/auth");
const Transaction = require("../models/Transaction");
const categorize = require("../utils/categorize");
const extractMerchant = require("../utils/extractMerchant");
const { parseBankStatementPDF } = require("../utils/parser");

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

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Transaction start: DD/MM/YY immediately followed by a letter (no space).
  // Value-date lines (DD/MM/YY alone or followed by a digit) are NOT matched
  // and become continuation lines instead of breaking the block.
  const TXN_START_RE = /^\d{2}\/\d{2}\/\d{2}[A-Za-z]/;

  // Group lines into per-transaction blocks
  const blocks = [];
  let current = null;

  for (const line of lines) {
    if (TXN_START_RE.test(line)) {
      if (current) blocks.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) blocks.push(current);

  let prevClosing = null;

  for (const blockLines of blocks) {
    // Date is at the very start of the first line (no space before narration)
    const dateMatch = blockLines[0].match(/^(\d{2}\/\d{2}\/\d{2})/);
    if (!dateMatch) continue;
    const date = parseDate(dateMatch[1]);

    // The amounts line starts with the 16-digit Chq/Ref.No column.
    // Its raw form after pdf-parse merging:
    //   {16-digit-ref}{DD/MM/YY}{txnAmt}{closingBalance}  — no spaces
    // e.g. "000060056006069305/01/261.00243,583.47"
    const amountsLine = blockLines.find((l) => /^\d{10,}/.test(l)) || "";
    if (!amountsLine) continue;

    // Strip the value date (DD/MM/YY merged into the line) before scanning for
    // amounts — otherwise "02/01/266,000.00" is read as "266,000.00" instead of
    // "6,000.00" because the year digits bleed into the amount.
    const strippedAmountsLine = amountsLine.replace(/\d{2}\/\d{2}\/\d{2}/, "");
    const amountMatches = [...strippedAmountsLine.matchAll(/([\d,]+\.\d{2})/g)];
    console.log("[HDFC] amountsLine:", amountsLine);
    console.log("[HDFC] stripped   :", strippedAmountsLine);
    console.log("[HDFC] matches    :", amountMatches.map(m => m[1]));
    if (amountMatches.length < 2) continue;

    const txAmt = parseAmount(amountMatches[0][1]);
    const closingBalance = parseAmount(amountMatches[amountMatches.length - 1][1]);

    if (txAmt <= 0 || txAmt > 10000000) continue;
    if (closingBalance <= 0 || closingBalance > 99999999) continue;

    // Balance direction tells us which column the amount belongs to
    let withdrawalAmt = 0;
    let depositAmt = 0;
    if (prevClosing !== null) {
      if (closingBalance >= prevClosing) depositAmt = txAmt;
      else withdrawalAmt = txAmt;
    } else {
      const guess = detectType(blockLines.join(" "), 0, 0);
      if (guess === "income") depositAmt = txAmt;
      else withdrawalAmt = txAmt;
    }

    prevClosing = closingBalance;

    // Narration: all lines except the amounts line.
    // Strip the leading DD/MM/YY from line 0 (no space separator).
    const narrationParts = blockLines
      .filter((l) => !(/^\d{10,}/.test(l)))
      .map((l, i) =>
        i === 0 ? l.replace(/^\d{2}\/\d{2}\/\d{2}/, "") : l
      );

    let narration = narrationParts
      .join(" ")
      .replace(/\b\d{10,20}\b/g, " ")       // strip any stray ref numbers
      .replace(/([\d,]+\.\d{2})/g, " ")      // strip any stray amounts
      .replace(/\b\d{2}\/\d{2}\/\d{2,4}\b/g, " ") // strip value date
      .replace(/\s+/g, " ")
      .trim();
    narration = cleanNarration(narration);

    if (!narration || narration.length < 3) continue;

    const type = detectType(narration, withdrawalAmt, depositAmt);
    const merchant = extractHDFCMerchant(narration);
    const category = categorize(narration);

    transactions.push({
      date,
      narration,
      merchant,
      amount: txAmt,
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

    // Tertiary fallback: use the multi-strategy generic parser
    if (parsed.length === 0) {
      try {
        const generic = await parseBankStatementPDF(req.file.buffer);
        parsed = generic.transactions.map((t) => ({
          date: new Date(t.date),
          narration: t.merchant,
          merchant: t.merchant,
          amount: Math.abs(t.amount),
          type: t.amount >= 0 ? "income" : "expense",
          category: categorize(t.merchant),
          withdrawalAmt: t.amount < 0 ? Math.abs(t.amount) : 0,
          depositAmt: t.amount >= 0 ? t.amount : 0,
        }));
      } catch (e) {
        console.error("Generic parser error:", e.message);
      }
    }

    if (parsed.length === 0) {
      return res.status(422).json({
        error:
          "This PDF appears to be scanned/image-based and cannot be parsed. Please upload a text-based bank statement.",
      });
    }

    let inserted = 0,
      skipped = 0;

    for (const txn of parsed) {
      try {
        // Re-run categorisation using both narration and merchant so whichever
        // has the richer keyword wins (prefer the more specific result).
        const catFromNarration = categorize(txn.narration || "");
        const catFromMerchant = categorize(txn.merchant || "");
        const category =
          catFromMerchant !== "Others"
            ? catFromMerchant
            : catFromNarration !== "Others"
              ? catFromNarration
              : "Others";

        const textKey = `PDF:${txn.narration.slice(0, 80)}:${txn.amount}:${txn.date.toISOString().slice(0, 10)}:${req.userId}`;
        await Transaction.create({
          text: textKey,
          amount: txn.amount,
          category,
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
      preview: parsed.slice(0, 8).map((t) => {
        const cat =
          categorize(t.merchant || "") !== "Others"
            ? categorize(t.merchant || "")
            : categorize(t.narration || "");
        return {
          date: t.date.toLocaleDateString("en-IN"),
          merchant: t.merchant,
          amount: t.amount,
          type: t.type,
          category: cat,
        };
      }),
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

// POST /api/pdf/debug
// Upload a PDF and get back raw extracted text + parser diagnostics without
// saving anything to the database.  Useful for verifying what pdf-parse sees.
//
// Usage:
//   curl -X POST https://<host>/api/pdf/debug \
//        -H "Authorization: Bearer <token>" \
//        -F "statement=@/path/to/statement.pdf"
router.post("/debug", auth, upload.single("statement"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });

    let pdfData;
    try {
      pdfData = await pdfParse(req.file.buffer);
    } catch (e) {
      return res.status(400).json({ error: "pdf-parse failed: " + e.message });
    }

    const rawText = pdfData.text || "";
    const bank = detectBank(rawText);

    // Run the HDFC parser with internal visibility
    const lines = rawText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const TXN_START_RE = /^\d{2}\/\d{2}\/\d{2}[A-Za-z]/;
    const DATE_ONLY_RE = /^\d{2}\/\d{2}\/\d{2}\b/;

    // Count how many lines look like transaction starts vs bare dates
    let txnStartLines = 0;
    let bareDateLines = 0;
    for (const l of lines) {
      if (TXN_START_RE.test(l)) txnStartLines++;
      else if (DATE_ONLY_RE.test(l)) bareDateLines++;
    }

    // Run the full parser (no DB writes)
    let parsed = [];
    if (bank === "HDFC") parsed = parseHDFCStatement(rawText);
    else if (bank === "SBI") parsed = parseSBIStatement(rawText);
    else {
      parsed = parseHDFCStatement(rawText);
      if (parsed.length === 0) parsed = parseFallback(rawText);
    }

    res.json({
      bank,
      totalLines: lines.length,
      txnStartLines,   // lines matching DD/MM/YY + letter  → new transaction anchors
      bareDateLines,   // lines matching DD/MM/YY alone     → likely value-date lines
      parsedCount: parsed.length,
      // First 500 chars of raw text so you can see exactly what pdf-parse emits
      rawTextPreview: rawText.slice(0, 500),
      // First 100 lines (trimmed) so you can inspect the line-split structure
      linesPreview: lines.slice(0, 100),
      // First 5 parsed transactions for a quick sanity-check
      parsedPreview: parsed.slice(0, 5).map((t) => ({
        date: t.date.toISOString().slice(0, 10),
        narration: t.narration,
        merchant: t.merchant,
        amount: t.amount,
        type: t.type,
        withdrawalAmt: t.withdrawalAmt,
        depositAmt: t.depositAmt,
        category: t.category,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
