// FILE: server/routes/pdfRoutes.js
// Parses HDFC (and similar) bank statement PDFs server-side
// Much more reliable than browser-side PDF.js parsing

const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const Transaction = require("../models/Transaction");
const extractMerchant = require("../utils/extractMerchant");
const categorize = require("../utils/categorize");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ── Detect transaction type ─────────────────────────────
function detectType(narration, withdrawalAmt, depositAmt) {
  const w = parseFloat(withdrawalAmt) || 0;
  const d = parseFloat(depositAmt) || 0;
  if (d > 0 && w === 0) return "income";
  const n = (narration || "").toLowerCase();
  if (
    n.includes("credited") ||
    n.includes("salary") ||
    n.includes("refund") ||
    n.includes("cashback")
  )
    return "income";
  return "expense";
}

// ── Parse amount string ─────────────────────────────────
function parseAmount(str) {
  if (!str) return 0;
  const clean = str.replace(/,/g, "").trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

// ── Parse date string like "01/01/26" or "01/01/2026" ──
function parseDate(str) {
  if (!str) return new Date();
  // Try DD/MM/YY or DD/MM/YYYY
  const parts = str.trim().split("/");
  if (parts.length === 3) {
    let [d, m, y] = parts;
    if (y.length === 2) y = "20" + y;
    const dt = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    if (!isNaN(dt.getTime())) return dt;
  }
  return new Date();
}

// ── Clean narration text ───────────────────────────────
function cleanNarration(text) {
  return text.replace(/\s+/g, " ").replace(/\n/g, " ").trim();
}

// ── Extract merchant from HDFC narration ──────────────
// HDFC narration formats:
// UPI-ZOMATO LIMITED-ZOMATO2.PAYU@INDUS-IN...
// UPI-SOORYA SANKAR-8807007325@SUPERYES-HD...
// UPI-MRS ANURADHA PADMANA...
// HDFC BANK CREDIT CAR.CCBILLPAY@PTYBL...
function extractHDFCMerchant(narration) {
  const n = narration.trim();
  const lower = n.toLowerCase();

  // Known brands — check first
  const brands = [
    ["zomato", "Zomato"],
    ["swiggy", "Swiggy"],
    ["amazon", "Amazon"],
    ["flipkart", "Flipkart"],
    ["uber", "Uber"],
    ["ola ", "Ola"],
    ["rapido", "Rapido"],
    ["netflix", "Netflix"],
    ["spotify", "Spotify"],
    ["hotstar", "Hotstar"],
    ["paytm", "Paytm"],
    ["phonepe", "PhonePe"],
    ["gpay", "Google Pay"],
    ["airtel", "Airtel"],
    ["jio", "Jio"],
    ["irctc", "IRCTC"],
    ["redbus", "RedBus"],
    ["bigbasket", "BigBasket"],
    ["blinkit", "Blinkit"],
    ["zepto", "Zepto"],
    ["myntra", "Myntra"],
    ["nykaa", "Nykaa"],
    ["zerodha", "Zerodha"],
    ["groww", "Groww"],
    ["cred", "CRED"],
    ["supermon", "Supermarket"],
    ["perfume", "Perfume Store"],
    ["toonline", "Airtel Online"],
  ];
  for (const [kw, name] of brands) {
    if (lower.includes(kw)) return name;
  }

  // UPI pattern: UPI-NAME-vpa@bank or UPI-COMPANY NAME-vpa@...
  const upiMatch = n.match(/^UPI[-\s]+([A-Z][A-Za-z\s]{2,30}?)[-\s]+[\w.]+@/);
  if (upiMatch) {
    const name = upiMatch[1].trim();
    // Filter out generic names
    if (!["HDFC", "SBI", "ICICI", "AXIS"].includes(name.toUpperCase())) {
      return toTitle(name);
    }
  }

  // UPI with just name and no VPA visible
  const upiSimple = n.match(/^UPI[-\s]+([A-Z][A-Za-z\s]{2,25})/);
  if (upiSimple) return toTitle(upiSimple[1].trim());

  // NEFT/IMPS pattern
  const neft = n.match(/^(?:NEFT|IMPS|RTGS)[-\s]+\w+[-\s]+(.+?)[-\s]+\d/i);
  if (neft) return toTitle(neft[1].trim());

  // ATM
  if (lower.includes("atm")) return "ATM Withdrawal";

  // Credit card bill
  if (lower.includes("credit") && lower.includes("card"))
    return "Credit Card Bill";

  // Fallback — first meaningful word group
  const words = n
    .split(/[-\s]+/)
    .filter((w) => w.length > 2 && /[A-Za-z]/.test(w));
  if (words.length > 0) return toTitle(words.slice(0, 3).join(" "));

  return "Bank Transaction";
}

function toTitle(str) {
  return str
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── MAIN PARSER — handles HDFC statement format ────────
function parseHDFCStatement(text) {
  const transactions = [];
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // HDFC statement rows look like:
  // 01/01/26  UPI-XXXXX...  000800...  01/01/26  500.00  (blank)  260524.80
  // The tricky part: narration spans multiple lines
  // Strategy: find lines that START with a date pattern DD/MM/YY

  const DATE_REGEX = /^(\d{2}\/\d{2}\/\d{2,4})\s+(.+)/;
  const AMOUNT_REGEX =
    /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)?\s*$/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{2,4})/);

    if (dateMatch) {
      const date = dateMatch[1];
      let fullLine = line;

      // Collect continuation lines (lines that don't start with a date)
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        // Stop if next line starts with a date
        if (/^\d{2}\/\d{2}\/\d{2,4}/.test(nextLine)) break;
        // Stop if it's a footer/header line
        if (
          nextLine.includes("HDFC BANK LIMITED") ||
          nextLine.includes("Page No") ||
          nextLine.includes("Closing Balance") ||
          nextLine.includes("From :") ||
          nextLine.includes("Statement of")
        )
          break;
        fullLine += " " + nextLine;
        j++;
      }
      i = j;

      // Now parse fullLine
      // Format: DATE  NARRATION  REF_NO  VALUE_DT  WITHDRAWAL  DEPOSIT  CLOSING
      // We look for amounts at the end
      const amountPattern =
        /(\d{1,3}(?:,\d{3})*\.\d{2})\s+(\d{1,3}(?:,\d{3})*\.\d{2})?\s+(\d{1,3}(?:,\d{3})*\.\d{2})/;
      const amountMatch = fullLine.match(amountPattern);

      if (amountMatch) {
        // Figure out which amounts are withdrawal, deposit, closing
        // Find all decimal numbers in the line
        const allAmounts = [
          ...fullLine.matchAll(/(\d{1,3}(?:,\d{3})*\.\d{2})/g),
        ].map((m) => ({
          value: parseAmount(m[1]),
          index: m.index,
        }));

        if (allAmounts.length >= 2) {
          // Last amount is closing balance
          // Second to last could be deposit or withdrawal
          // We need to figure out from context

          // Get the narration part (between date and first ref number)
          const afterDate = fullLine.slice(date.length).trim();

          // Ref number is typically a long number like 000800...
          const refMatch = afterDate.match(/\b(\d{12,20})\b/);
          let narration = afterDate;
          if (refMatch) {
            narration = afterDate
              .slice(0, afterDate.indexOf(refMatch[0]))
              .trim();
          }

          // Clean narration
          narration = cleanNarration(narration);
          if (!narration || narration.length < 3) {
            continue;
          }

          // Determine withdrawal vs deposit
          // Look for pattern: withdrawal  blank  closing  OR  blank  deposit  closing
          let withdrawalAmt = 0;
          let depositAmt = 0;
          const closingBalance = allAmounts[allAmounts.length - 1].value;

          if (allAmounts.length >= 3) {
            // Could be: withdrawal  deposit  closing (if both exist)
            // Or: withdrawal  closing (withdrawal only)
            // Or: deposit  closing (deposit only)
            const secondLast = allAmounts[allAmounts.length - 2].value;
            const thirdLast =
              allAmounts.length >= 3
                ? allAmounts[allAmounts.length - 3].value
                : 0;

            // Check the text between the amounts to determine which is which
            const lineEnd = fullLine.slice(-100); // last 100 chars
            const amountPositions = [
              ...fullLine.matchAll(/(\d{1,3}(?:,\d{3})*\.\d{2})/g),
            ];

            if (amountPositions.length >= 3) {
              // 3 amounts at end: withdrawal, deposit, closing
              // But one of withdrawal or deposit could be blank (no number)
              // We look for double space gap indicating blank field
              const lastThree = amountPositions.slice(-3);
              const gap1 =
                lastThree[1].index -
                (lastThree[0].index + lastThree[0][0].length);
              const gap2 =
                lastThree[2].index -
                (lastThree[1].index + lastThree[1][0].length);

              if (gap1 > 5 && gap2 < 15) {
                // Large gap before second = deposit col is blank = first is withdrawal
                withdrawalAmt = lastThree[0].value;
              } else if (gap1 < 15 && gap2 > 5) {
                // Large gap before third = withdrawal col is blank = second is deposit
                depositAmt = lastThree[1].value;
              } else {
                // Both present
                withdrawalAmt = lastThree[0].value;
                depositAmt = lastThree[1].value;
              }
            } else if (amountPositions.length === 2) {
              // Only one transaction amount + closing
              // Determine by narration
              const type = detectType(narration, 1, 0);
              if (type === "income") depositAmt = secondLast;
              else withdrawalAmt = secondLast;
            }
          } else if (allAmounts.length === 2) {
            const type = detectType(narration, 1, 0);
            if (type === "income") depositAmt = allAmounts[0].value;
            else withdrawalAmt = allAmounts[0].value;
          }

          const amount = withdrawalAmt > 0 ? withdrawalAmt : depositAmt;
          if (amount <= 0) continue;

          const type = detectType(narration, withdrawalAmt, depositAmt);
          const merchant = extractHDFCMerchant(narration);
          const category = categorize(narration);

          transactions.push({
            date: parseDate(date),
            narration,
            merchant,
            amount,
            type,
            category,
            withdrawalAmt,
            depositAmt,
          });
        }
      }
    } else {
      i++;
    }
  }

  return transactions;
}

// ── FALLBACK — line-by-line amount extraction ──────────
// If structured parsing finds nothing, fall back to extracting
// any line with a clear debit/credit amount
function parseFallback(text) {
  const transactions = [];
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 10);

  // Look for lines with date + amount pattern
  for (const line of lines) {
    if (!/\d{2}\/\d{2}\/\d{2,4}/.test(line)) continue;

    const amounts = [...line.matchAll(/(\d{1,3}(?:,\d{3})*\.\d{2})/g)];
    if (amounts.length < 2) continue;

    const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{2,4})/);
    if (!dateMatch) continue;

    // Take second-to-last amount as transaction amount (last is closing balance)
    const txnAmount = parseAmount(amounts[amounts.length - 2][1]);
    if (txnAmount <= 0 || txnAmount > 10000000) continue;

    // Get narration — text between date and first big number
    const afterDate = line.slice(dateMatch.index + dateMatch[1].length).trim();
    const firstNumIdx = afterDate.search(/\d{6,}/);
    const narration =
      firstNumIdx > 0
        ? cleanNarration(afterDate.slice(0, firstNumIdx))
        : cleanNarration(afterDate.slice(0, 60));

    if (!narration || narration.length < 3) continue;

    transactions.push({
      date: parseDate(dateMatch[1]),
      narration,
      merchant: extractHDFCMerchant(narration),
      amount: txnAmount,
      type: detectType(narration, txnAmount, 0),
      category: categorize(narration),
      withdrawalAmt: txnAmount,
      depositAmt: 0,
    });
  }

  return transactions;
}

// ── POST /api/pdf/upload ───────────────────────────────
router.post("/upload", auth, upload.single("statement"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    // Parse PDF
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

    // Try structured HDFC parser first
    let parsed = parseHDFCStatement(text);

    // Fall back to generic parser if needed
    if (parsed.length === 0) {
      parsed = parseFallback(text);
    }

    if (parsed.length === 0) {
      return res.status(400).json({
        error:
          "No transactions found in PDF. Supported: HDFC, SBI, ICICI, Axis bank statements.",
        rawTextSample: text.slice(0, 500),
      });
    }

    // Insert into DB
    let inserted = 0;
    let skipped = 0;
    const errors = [];

    for (const txn of parsed) {
      try {
        // Create a unique text key from narration + date + amount
        const textKey = `PDF:${txn.narration.slice(0, 80)}:${txn.amount}:${txn.date.toISOString().slice(0, 10)}`;

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
        if (e.code === 11000)
          skipped++; // duplicate
        else errors.push(e.message);
      }
    }

    res.json({
      success: true,
      parsed: parsed.length,
      inserted,
      skipped,
      message: `Successfully imported ${inserted} transactions from your bank statement.`,
      preview: parsed.slice(0, 5).map((t) => ({
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

// ── GET /api/pdf/test ──────────────────────────────────
router.get("/test", auth, (req, res) => {
  res.json({ ok: true, message: "PDF upload endpoint is working" });
});

module.exports = router;
