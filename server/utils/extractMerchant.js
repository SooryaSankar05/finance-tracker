module.exports = function extractMerchant(text) {
  if (!text) return "Transfer";
  const t = text.trim();
  const lower = t.toLowerCase();

  // HDFC/UPI "To JAYASUDHA S" on its own line
  const upiTo = t.match(
    /^To\s+(?:Mr\.?\s+|Mrs\.?\s+|Ms\.?\s+|Dr\.?\s+)?([A-Z][A-Z\s.]{2,30}?)(?:\s*[\n\r]|$)/m,
  );
  if (upiTo) return toTitle(upiTo[1].trim());

  // "trf to NAME" or "transfer to NAME"
  const trf = t.match(
    /(?:trf|transfer(?:red)?)\s+to\s+([A-Za-z0-9 .]{3,35}?)(?:\s+on|\s+ref|\s+upi|[\n\r]|$)/i,
  );
  if (trf) return toTitle(trf[1].trim());

  // "at MERCHANT on" (card swipe)
  const atM = t.match(
    /\bat\s+([A-Za-z0-9 &'./-]{3,35}?)\s+(?:on\s|\d|via|ref)/i,
  );
  if (atM) return toTitle(atM[1].trim());

  // "to MERCHANT on date"
  const toOn = t.match(/\bto\s+([A-Za-z0-9 &'./-]{3,35}?)\s+on\b/i);
  if (toOn) return toTitle(toOn[1].trim());

  // "paid to / sent to MERCHANT"
  const paid = t.match(
    /(?:paid|sent|credited)\s+to\s+([A-Za-z0-9 &'./-]{3,35}?)(?:\s+via|\s+upi|\s+ref|[\n\r]|$)/i,
  );
  if (paid) return toTitle(paid[1].trim());

  // UPI VPA
  const vpa = t.match(/([a-zA-Z0-9._-]+@[a-zA-Z]+)/);
  if (vpa) return vpa[1];

  // Known brands
  const brands = [
    ["swiggy", "Swiggy"],
    ["zomato", "Zomato"],
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
    ["google pay", "Google Pay"],
    ["airtel", "Airtel"],
    ["jio", "Jio"],
    ["bsnl", "BSNL"],
    ["irctc", "IRCTC"],
    ["redbus", "RedBus"],
    ["bigbasket", "BigBasket"],
    ["blinkit", "Blinkit"],
    ["zepto", "Zepto"],
    ["myntra", "Myntra"],
    ["ajio", "AJIO"],
    ["nykaa", "Nykaa"],
    ["zerodha", "Zerodha"],
    ["groww", "Groww"],
    ["cred", "CRED"],
    ["dunzo", "Dunzo"],
    ["meesho", "Meesho"],
    ["instamart", "Swiggy Instamart"],
  ];
  for (const [kw, name] of brands) {
    if (lower.includes(kw)) return name;
  }

  // Last resort: first capitalized word sequence
  const cap = t.match(/\b([A-Z][A-Z\s]{2,20})\b/);
  if (cap) return toTitle(cap[1].trim());

  return "Personal Transfer";
};

function toTitle(str) {
  return str
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
