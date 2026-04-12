const mongoose = require("mongoose");

const splitSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  paidBy: { type: String, required: true },
  participants: [
    {
      name: String,
      share: Number,
      settled: { type: Boolean, default: false },
    },
  ],
  date: { type: Date, default: Date.now },
  note: { type: String, default: "" },
});

module.exports = mongoose.model("Split", splitSchema);
