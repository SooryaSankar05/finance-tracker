const Goal = require("../models/Goal");
const Split = require("../models/Split");

// ── GOALS ────────────────────────────────────────────────
exports.getGoals = async (req, res) => {
  try {
    res.json(await Goal.find({ user: req.userId }).sort({ createdAt: -1 }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.createGoal = async (req, res) => {
  try {
    const { name, targetAmount, savedAmount, deadline, emoji } = req.body;
    if (!name || !targetAmount)
      return res.status(400).json({ error: "name and targetAmount required" });
    const goal = await Goal.create({
      user: req.userId,
      name,
      targetAmount,
      savedAmount: savedAmount || 0,
      deadline: deadline || null,
      emoji: emoji || "🎯",
    });
    res.json(goal);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.updateGoal = async (req, res) => {
  try {
    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      req.body,
      { new: true },
    );
    if (!goal) return res.status(404).json({ error: "Goal not found" });
    res.json(goal);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.deleteGoal = async (req, res) => {
  try {
    await Goal.findOneAndDelete({ _id: req.params.id, user: req.userId });
    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── SPLITS ────────────────────────────────────────────────
exports.getSplits = async (req, res) => {
  try {
    res.json(await Split.find({ user: req.userId }).sort({ date: -1 }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.createSplit = async (req, res) => {
  try {
    const { title, totalAmount, paidBy, participants, note, date } = req.body;
    if (!title || !totalAmount || !paidBy || !participants?.length)
      return res.status(400).json({ error: "Missing required fields" });
    const split = await Split.create({
      user: req.userId,
      title,
      totalAmount,
      paidBy,
      participants,
      note: note || "",
      date: date || new Date(),
    });
    res.json(split);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.updateSplit = async (req, res) => {
  try {
    const split = await Split.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      req.body,
      { new: true },
    );
    if (!split) return res.status(404).json({ error: "Not found" });
    res.json(split);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.deleteSplit = async (req, res) => {
  try {
    await Split.findOneAndDelete({ _id: req.params.id, user: req.userId });
    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
