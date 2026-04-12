module.exports = function categorize(text) {
  const m = (text || "").toLowerCase();

  if (
    m.includes("credited") ||
    m.includes("salary") ||
    m.includes("received") ||
    m.includes("refund") ||
    m.includes("cashback")
  )
    return "Income";

  if (
    m.includes("swiggy") ||
    m.includes("zomato") ||
    m.includes("restaurant") ||
    m.includes("cafe") ||
    m.includes("food") ||
    m.includes("biryani") ||
    m.includes("pizza") ||
    m.includes("burger") ||
    m.includes("bakery") ||
    m.includes("canteen") ||
    m.includes("bigbasket") ||
    m.includes("blinkit") ||
    m.includes("zepto") ||
    m.includes("instamart") ||
    m.includes("grocer") ||
    m.includes("dining")
  )
    return "Food";

  if (
    m.includes("uber") ||
    m.includes("ola ") ||
    m.includes("rapido") ||
    m.includes("metro") ||
    m.includes("irctc") ||
    m.includes("redbus") ||
    m.includes("petrol") ||
    m.includes("fuel") ||
    m.includes("parking") ||
    m.includes("toll") ||
    m.includes("flight") ||
    m.includes("indigo") ||
    m.includes("spicejet") ||
    m.includes("makemytrip")
  )
    return "Travel";

  if (
    m.includes("amazon") ||
    m.includes("flipkart") ||
    m.includes("myntra") ||
    m.includes("meesho") ||
    m.includes("ajio") ||
    m.includes("nykaa") ||
    m.includes("shopping") ||
    m.includes("mart") ||
    m.includes("supermarket") ||
    m.includes("dmart") ||
    m.includes("reliance smart")
  )
    return "Shopping";

  if (
    m.includes("electricity") ||
    m.includes("water bill") ||
    m.includes("gas bill") ||
    m.includes("recharge") ||
    m.includes("broadband") ||
    m.includes("wifi") ||
    m.includes("airtel") ||
    m.includes("jio") ||
    m.includes("bsnl") ||
    m.includes("postpaid") ||
    m.includes("bill payment") ||
    m.includes("bescom") ||
    m.includes("tata power")
  )
    return "Bills";

  if (
    m.includes("netflix") ||
    m.includes("hotstar") ||
    m.includes("prime video") ||
    m.includes("spotify") ||
    m.includes("youtube premium") ||
    m.includes("movie") ||
    m.includes("cinema") ||
    m.includes("bookmyshow") ||
    m.includes("pvr") ||
    m.includes("inox") ||
    m.includes("gaming") ||
    m.includes("steam")
  )
    return "Entertainment";

  if (
    m.includes("pharmacy") ||
    m.includes("medical") ||
    m.includes("hospital") ||
    m.includes("doctor") ||
    m.includes("clinic") ||
    m.includes("apollo") ||
    m.includes("netmeds") ||
    m.includes("1mg") ||
    m.includes("pharmeasy") ||
    m.includes("health")
  )
    return "Healthcare";

  if (
    m.includes("school") ||
    m.includes("college") ||
    m.includes("tuition") ||
    m.includes("course") ||
    m.includes("udemy") ||
    m.includes("coursera") ||
    m.includes("fees") ||
    m.includes("education")
  )
    return "Education";

  if (
    m.includes("fd ") ||
    m.includes("fixed deposit") ||
    m.includes("mutual fund") ||
    m.includes("sip ") ||
    m.includes("zerodha") ||
    m.includes("groww") ||
    m.includes("stocks") ||
    m.includes("nps") ||
    m.includes("ppf") ||
    m.includes("investment")
  )
    return "Savings";

  if (
    /^To\s+[A-Z]/m.test(text || "") ||
    m.includes("trf to") ||
    m.includes("transfer to") ||
    m.includes("upi")
  )
    return "Transfer";

  return "Others";
};
