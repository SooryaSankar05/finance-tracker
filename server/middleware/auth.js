const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "moneymind_secret_2024";

module.exports = (req, res, next) => {
  let token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token provided" });
  if (token.startsWith("Bearer ")) token = token.slice(7);
  try {
    const decoded = jwt.verify(token, SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};
