function extractAmount(text) {
  if (!text) return 0;
  const clean = text.replace(/,/g, "");

  const patterns = [
    /(?:rs\.?|inr|₹)\s*(\d+(?:\.\d{1,2})?)/i,
    /(\d+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|₹)/i,
    /(?:debited?|credited?|paid|sent|spent)\s+(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{1,2})?)/i,
    /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:cr|dr)\b/i,
  ];

  for (const p of patterns) {
    const m = clean.match(p);
    if (m) return parseFloat(m[1]);
  }

  const nums = clean.match(/\d+(?:\.\d{1,2})?/g);
  if (!nums) return 0;
  return Math.max(...nums.map(Number));
}

module.exports = extractAmount;
