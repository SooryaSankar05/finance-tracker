const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  // ✅ FIX: removed `unique: true` on text — manual transactions share no SMS text
  // and the unique constraint caused silent 11000 duplicate errors for manual entries
  // with the same description. A compound index on (user + text) is safer if dedup
  // is needed, but plain text storage is fine here.
  text: { type: String, default: "" },
  amount: { type: Number, default: 0 },
  category: { type: String, default: "Others" },
  type: { type: String, default: "expense" },
  merchant: { type: String, default: "" },
  note: { type: String, default: "" },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  date: { type: Date, default: Date.now },
});

// Optional: index for fast per-user queries
transactionSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model("Transaction", transactionSchema);
