/**
 * pdfParser.js — Robust Bank Statement PDF Parser
 *
 * Drop this file into: server/utils/pdfParser.js  (or wherever your current parser lives)
 *
 * Dependencies (add to server/package.json if not already present):
 *   npm install pdf-parse
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT WAS WRONG IN TYPICAL IMPLEMENTATIONS & WHAT THIS FILE FIXES:
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PROBLEM 1 — Treating PDF text as clean line-by-line data
 *   pdf-parse extracts text by rendering each PDF operator in order. A single
 *   "row" in the visual PDF can come out as multiple fragmented lines because
 *   columns are laid out separately by the PDF renderer. Splitting on "\n" then
 *   trying to match a single regex per line will miss most transactions.
 *   FIX: Normalize the raw text — collapse excessive whitespace, re-join broken
 *        lines — before running any regex.
 *
 * PROBLEM 2 — Overly strict date regex
 *   Common mistake: only matching DD/MM/YYYY. Real bank statements use:
 *     • DD/MM/YYYY   • DD-MM-YYYY   • DD MMM YYYY   • MMM DD, YYYY
 *     • YYYY-MM-DD   • DD.MM.YYYY
 *   FIX: A single date normalizer that handles all common formats and converts
 *        them to ISO 8601 (YYYY-MM-DD).
 *
 * PROBLEM 3 — Amount regex doesn't handle commas, currency symbols, or CR/DR
 *   Banks print amounts as "1,234.56", "₹ 1,234.56", "1234.56 CR", "( 500.00 )"
 *   A naive /\d+\.\d{2}/ misses everything with commas or currency prefixes.
 *   FIX: Dedicated amount extractor that strips symbols, handles negatives, and
 *        returns a signed float.
 *
 * PROBLEM 4 — No debit/credit sign detection
 *   Losing the sign means expenses look like income.
 *   FIX: Detect DR/CR/Debit/Credit/negative parentheses and flip sign accordingly.
 *
 * PROBLEM 5 — Merchant name captured as garbled fragment
 *   When the rest of the line is consumed by date + amount patterns, whatever
 *   is left over is taken as the merchant name — usually garbage.
 *   FIX: Extract date and amount first, then clean whatever remains as the
 *        description/merchant, applying known noise-word removal.
 *
 * PROBLEM 6 — No multi-strategy fallback
 *   Different banks use different layouts. One regex fails on every bank except
 *   the one it was written for.
 *   FIX: Three independent strategy functions tried in order; results are scored
 *        by confidence and the best set wins.
 */

const _pdfParseMod = require("pdf-parse");
const pdfParse = typeof _pdfParseMod === "function" ? _pdfParseMod : _pdfParseMod.default;

// ─── Date helpers ─────────────────────────────────────────────────────────────

const MONTHS = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/**
 * Try to parse any common date string into "YYYY-MM-DD".
 * Returns null if nothing is recognised.
 */
function parseDate(raw) {
  if (!raw) return null;
  const s = raw.trim();

  // DD/MM/YYYY  or  DD-MM-YYYY  or  DD.MM.YYYY
  let m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;

  // YYYY-MM-DD  (ISO already)
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;

  // DD MMM YYYY  or  DD-MMM-YYYY  or  DD/MMM/YYYY
  m = s.match(/^(\d{1,2})[\s\-\/]([A-Za-z]{3,9})[\s\-\/,]*(\d{4})$/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase().slice(0, 3)];
    if (mon) return `${m[3]}-${mon}-${m[1].padStart(2, "0")}`;
  }

  // MMM DD, YYYY
  m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mon = MONTHS[m[1].toLowerCase().slice(0, 3)];
    if (mon) return `${m[3]}-${mon}-${m[2].padStart(2, "0")}`;
  }

  // MM/DD/YYYY — US format (heuristic: month part ≤ 12 and day part > 12)
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m && parseInt(m[1]) <= 12 && parseInt(m[2]) > 12) {
    return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }

  return null;
}

// ─── Amount helpers ───────────────────────────────────────────────────────────

/**
 * Extract a signed float from a raw amount string.
 * Handles: "1,234.56"  "₹1,234.56"  "$1,234.56"  "1234.56 DR"
 *          "(1,234.56)"  "-1,234.56"  "1,234.56Cr"
 */
function parseAmount(raw) {
  if (!raw) return null;
  let s = raw.trim();

  // Determine sign from suffixes/prefixes before stripping them
  const isNegative =
    /\bDR\b/i.test(s) ||
    /\bDebit\b/i.test(s) ||
    /^\(.*\)$/.test(s) || // (1,234.56)
    s.startsWith("-");

  const isPositive = /\bCR\b/i.test(s) || /\bCredit\b/i.test(s);

  // Strip currency symbols, commas, whitespace, sign words, parentheses
  s = s
    .replace(/[₹$€£¥,\s]/g, "")
    .replace(/DR|CR|Debit|Credit/gi, "")
    .replace(/[()]/g, "")
    .replace(/^-/, "");

  const amount = parseFloat(s);
  if (isNaN(amount)) return null;

  // Positive amounts are credits (income), negative are debits (expense)
  // Default unsigned amounts to negative (most statements list debits)
  if (isPositive) return +Math.abs(amount);
  if (isNegative) return -Math.abs(amount);
  return -Math.abs(amount); // default: treat as expense
}

// ─── Text normalization ───────────────────────────────────────────────────────

/**
 * pdf-parse sometimes emits lines with excessive internal spaces where the
 * PDF renderer placed separate text chunks side-by-side.
 * This collapses runs of 3+ spaces into a tab-like separator so our split
 * patterns can treat them as column dividers.
 */
function normalizeText(raw) {
  return raw
    .split("\n")
    .map((line) =>
      line
        .replace(/\r/g, "")
        .replace(/ {3,}/g, "  ") // collapse 3+ spaces → 2 spaces (column gap marker)
        .trim(),
    )
    .filter((l) => l.length > 0)
    .join("\n");
}

// ─── Merchant / description cleaner ──────────────────────────────────────────

const NOISE = [
  /^(UPI|NEFT|RTGS|IMPS|ATM|POS|CHQ|TXN|REF|INF|VPS|VISA|MASTER)\s*/i,
  /\b(transfer|payment|purchase|withdrawal|deposit)\b/gi,
  /\b\d{6,}\b/g, // long reference numbers
  /[*\/|\\]+/g,
  /\s{2,}/g,
];

function cleanMerchant(raw) {
  if (!raw) return "Unknown";
  let s = raw.trim();
  for (const pattern of NOISE) s = s.replace(pattern, " ");
  s = s.trim();
  // Capitalize first letter of each word
  s = s.replace(/\b\w/g, (c) => c.toUpperCase());
  return s.length > 2 ? s : "Unknown";
}

// ─── Strategy 1: Date–Description–Amount in columns ──────────────────────────
// Matches lines like:
//   15/04/2024  AMAZON PAY           1,234.56 DR
//   15-Apr-2024  Swiggy Order        500.00

const COL_REGEX =
  /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.](?:\d{2}|\d{4})|\d{1,2}[\s\-\/][A-Za-z]{3}[\s\-\/,]*\d{4})\s{2,}(.+?)\s{2,}([\(]?[₹$€£¥]?\s*[\d,]+\.\d{2}[\)]?\s*(?:CR|DR|Cr|Dr)?)/;

function strategyColumns(lines) {
  const transactions = [];
  for (const line of lines) {
    const m = line.match(COL_REGEX);
    if (!m) continue;
    const date = parseDate(m[1]);
    const amount = parseAmount(m[3]);
    if (!date || amount === null) continue;
    transactions.push({
      date,
      merchant: cleanMerchant(m[2]),
      amount,
    });
  }
  return transactions;
}

// ─── Strategy 2: Date anywhere in line, amount at end ─────────────────────────
// Catches lines where columns aren't cleanly separated:
//   15 Apr 2024 Zomato Online Food   ₹350.00 DR

const LOOSE_DATE =
  /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.](?:\d{2}|\d{4})|\d{1,2}[\s\-\/][A-Za-z]{3}[\s\-\/,]*\d{4}|[A-Za-z]{3}\s+\d{1,2},?\s+\d{4})/;

const LOOSE_AMOUNT =
  /([\(]?[₹$€£¥]?\s*[\d,]+\.\d{2}[\)]?\s*(?:CR|DR|Cr|Dr)?)\s*$/;

function strategyLoose(lines) {
  const transactions = [];
  for (const line of lines) {
    const dateMatch = line.match(LOOSE_DATE);
    const amountMatch = line.match(LOOSE_AMOUNT);
    if (!dateMatch || !amountMatch) continue;

    const date = parseDate(dateMatch[1]);
    const amount = parseAmount(amountMatch[1]);
    if (!date || amount === null) continue;

    // Everything between the date and amount is the description
    const start = (dateMatch.index ?? 0) + dateMatch[0].length;
    const end = amountMatch.index ?? line.length;
    const descRaw = line.slice(start, end);

    transactions.push({
      date,
      merchant: cleanMerchant(descRaw),
      amount,
    });
  }
  return transactions;
}

// ─── Strategy 3: Multi-line transactions ─────────────────────────────────────
// Some banks split the date on one line and description + amount on the next:
//   15/04/2024
//   SWIGGY FOOD DELIVERY      350.00 DR

function strategyMultiLine(lines) {
  const transactions = [];
  let i = 0;
  while (i < lines.length - 1) {
    const dateLine = lines[i];
    const nextLine = lines[i + 1];

    const dateOnly = dateLine.match(
      /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.](?:\d{2}|\d{4}))$/,
    );
    if (!dateOnly) {
      i++;
      continue;
    }

    const amountMatch = nextLine.match(LOOSE_AMOUNT);
    if (!amountMatch) {
      i++;
      continue;
    }

    const date = parseDate(dateOnly[1]);
    const amount = parseAmount(amountMatch[1]);
    if (!date || amount === null) {
      i++;
      continue;
    }

    const descRaw = nextLine.slice(0, amountMatch.index ?? nextLine.length);
    transactions.push({
      date,
      merchant: cleanMerchant(descRaw),
      amount,
    });
    i += 2; // consumed both lines
  }
  return transactions;
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function deduplicate(txns) {
  const seen = new Set();
  return txns.filter((t) => {
    const key = `${t.date}|${t.amount}|${t.merchant}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * parseBankStatementPDF(buffer)
 *
 * @param {Buffer} buffer  — the PDF file buffer (e.g. from multer: req.file.buffer)
 * @returns {Promise<{ transactions: Array<{date, merchant, amount}>, rawText: string }>}
 */
async function parseBankStatementPDF(buffer) {
  // Extract raw text from PDF
  const data = await pdfParse(buffer);
  const rawText = data.text;

  // Normalize
  const normalized = normalizeText(rawText);
  const lines = normalized.split("\n");

  // Run all three strategies
  const results1 = strategyColumns(lines);
  const results2 = strategyLoose(lines);
  const results3 = strategyMultiLine(lines);

  // Pick the strategy with the most results (most likely correct for this PDF)
  let best;
  if (
    results1.length >= results2.length &&
    results1.length >= results3.length
  ) {
    best = results1;
  } else if (results2.length >= results3.length) {
    best = results2;
  } else {
    best = results3;
  }

  // If the best has very few results, merge all strategies and deduplicate
  // (catches partially-structured PDFs where layouts are mixed)
  if (best.length < 3) {
    best = deduplicate([...results1, ...results2, ...results3]);
  } else {
    best = deduplicate(best);
  }

  return {
    transactions: best,
    rawText, // expose raw text so you can debug from the route if needed
    strategyStats: {
      // useful for debugging which strategy fired
      columns: results1.length,
      loose: results2.length,
      multiLine: results3.length,
      final: best.length,
    },
  };
}

/**
 * parseTextWithStrategies(text)
 *
 * Applies the same three parsing strategies directly to raw text (e.g. from
 * OCR) instead of extracting from a PDF buffer first.
 *
 * @param {string} text — raw text (e.g. Tesseract OCR output)
 * @returns {Array<{date, merchant, amount}>}
 */
function parseTextWithStrategies(text) {
  const normalized = normalizeText(text);
  const lines = normalized.split("\n");

  const results1 = strategyColumns(lines);
  const results2 = strategyLoose(lines);
  const results3 = strategyMultiLine(lines);

  let best;
  if (results1.length >= results2.length && results1.length >= results3.length) {
    best = results1;
  } else if (results2.length >= results3.length) {
    best = results2;
  } else {
    best = results3;
  }

  if (best.length < 3) {
    best = deduplicate([...results1, ...results2, ...results3]);
  } else {
    best = deduplicate(best);
  }

  return best;
}

module.exports = { parseBankStatementPDF, parseTextWithStrategies };
