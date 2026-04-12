const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  text: { type: String, unique: true },
  amount: { type: Number, default: 0 },
  category: { type: String, default: "Others" },
  type: { type: String, default: "expense" },
  merchant: { type: String, default: "" },
  note: { type: String, default: "" },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Transaction", transactionSchema);
