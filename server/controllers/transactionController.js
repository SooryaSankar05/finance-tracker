const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const extractAmount = require("../utils/parser");
const categorize = require("../utils/categorize");
const extractMerchant = require("../utils/extractMerchant");

const uid = (id) => new mongoose.Types.ObjectId(id);

function detectType(text) {
  const l = (text || "").toLowerCase();
  if (
    l.includes("credited") ||
    l.includes("received") ||
    l.includes("salary") ||
    l.includes("refund") ||
    l.includes("cashback") ||
    l.includes("reversal")
  )
    return "income";
  return "expense";
}

function periodFilter(period) {
  if (!period || period === "all") return {};
  const now = new Date();
  const from = new Date();
  if (period === "week") from.setDate(now.getDate() - 7);
  else if (period === "month") {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  } else if (period === "quarter") from.setMonth(now.getMonth() - 3);
  else if (period === "year") from.setFullYear(now.getFullYear() - 1);
  return { date: { $gte: from } };
}

// ADD TRANSACTION (SMS text or manual)
exports.addTransaction = async (req, res) => {
  try {
    const {
      text,
      date,
      manual,
      amount: mAmt,
      category: mCat,
      note,
      type: mType,
    } = req.body;
    let amount, category, type, merchant, rawText;

    if (manual) {
      if (!mAmt || parseFloat(mAmt) <= 0)
        return res.status(400).json({ error: "Valid amount required" });
      amount = parseFloat(mAmt);
      category = mCat || "Others";
      type = mType || "expense";
      merchant = note || mCat || "Manual";
      rawText = `Manual:${category}:${amount}:${note || ""}:${Date.now()}`;
    } else {
      if (!text) return res.status(400).json({ error: "Text required" });
      rawText = text;
      amount = extractAmount(text);
      category = categorize(text);
      type = detectType(text);
      merchant = extractMerchant(text);
    }

    const transaction = await Transaction.create({
      text: rawText,
      amount,
      category,
      type,
      merchant,
      note: note || "",
      user: req.userId,
      date: date ? new Date(date) : new Date(),
    });
    res.json(transaction);
  } catch (error) {
    if (error.code === 11000) return res.json({ message: "Duplicate ignored" });
    res.status(500).json({ error: error.message });
  }
};

// BULK ADD
exports.bulkAddTransactions = async (req, res) => {
  try {
    const { texts } = req.body;
    if (!texts || !Array.isArray(texts))
      return res.status(400).json({ error: "texts[] required" });

    const data = texts
      .filter((t) => t && t.trim().length > 3)
      .map((text) => ({
        text,
        amount: extractAmount(text),
        category: categorize(text),
        type: detectType(text),
        merchant: extractMerchant(text),
        user: req.userId,
        date: new Date(),
      }));

    const result = await Transaction.insertMany(data, { ordered: false });
    res.json({ inserted: result.length });
  } catch (error) {
    if (error.writeErrors)
      return res.json({
        message: "Partial insert",
        inserted: error.result?.nInserted || 0,
      });
    res.status(500).json({ error: error.message });
  }
};

// GET ALL TRANSACTIONS
exports.getTransactions = async (req, res) => {
  try {
    const { category, type, from, to } = req.query;
    const filter = { user: req.userId };
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }
    const data = await Transaction.find(filter).sort({ date: -1 }).limit(500);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// INSIGHTS
exports.getInsights = async (req, res) => {
  try {
    const extra = periodFilter(req.query.period);
    const transactions = await Transaction.find({ user: req.userId, ...extra });
    const totalExpense = transactions
      .filter((t) => t.type === "expense")
      .reduce((a, t) => a + t.amount, 0);
    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((a, t) => a + t.amount, 0);
    const byCategory = {};
    transactions.forEach((t) => {
      if (!byCategory[t.category]) byCategory[t.category] = 0;
      byCategory[t.category] += t.amount;
    });
    res.json({
      totalExpense,
      totalIncome,
      balance: totalIncome - totalExpense,
      byCategory,
      count: transactions.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// WEEKLY REPORT
exports.getWeeklyReport = async (req, res) => {
  try {
    const now = new Date();
    const thisStart = new Date();
    thisStart.setDate(now.getDate() - 7);
    const lastStart = new Date();
    lastStart.setDate(now.getDate() - 14);
    const [thisWeek, lastWeek] = await Promise.all([
      Transaction.find({
        user: req.userId,
        date: { $gte: thisStart },
        type: "expense",
      }),
      Transaction.find({
        user: req.userId,
        date: { $gte: lastStart, $lt: thisStart },
        type: "expense",
      }),
    ]);
    const thisWeekTotal = thisWeek.reduce((a, b) => a + b.amount, 0);
    const lastWeekTotal = lastWeek.reduce((a, b) => a + b.amount, 0);
    const change =
      lastWeekTotal > 0
        ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100
        : 0;
    res.json({ thisWeekTotal, lastWeekTotal, change: change.toFixed(2) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// BUDGET ALERTS — compares CURRENT MONTH spending only
exports.getBudgetAlerts = async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const budgetDocs = await Budget.find({ user: req.userId });
    const budgets = {
      Food: 4000,
      Travel: 2000,
      Shopping: 3000,
      Bills: 5000,
      Entertainment: 1500,
    };
    budgetDocs.forEach((b) => {
      budgets[b.category] = b.limit;
    });

    const transactions = await Transaction.find({
      user: req.userId,
      type: "expense",
      date: { $gte: monthStart },
    });
    const spending = {};
    transactions.forEach((t) => {
      spending[t.category] = (spending[t.category] || 0) + t.amount;
    });

    const alerts = [];
    for (const cat in spending) {
      if (budgets[cat] && spending[cat] > budgets[cat]) {
        alerts.push({
          category: cat,
          spent: spending[cat],
          limit: budgets[cat],
          over: spending[cat] - budgets[cat],
        });
      }
    }
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET BUDGETS
exports.getBudgets = async (req, res) => {
  try {
    const docs = await Budget.find({ user: req.userId });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// SET BUDGET
exports.setBudget = async (req, res) => {
  try {
    const { category, limit } = req.body;
    if (!category || !limit)
      return res.status(400).json({ error: "category and limit required" });
    const b = await Budget.findOneAndUpdate(
      { user: req.userId, category },
      { limit: parseFloat(limit) },
      { upsert: true, new: true },
    );
    res.json(b);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// MERCHANT SUMMARY
exports.getMerchantSummary = async (req, res) => {
  try {
    const data = await Transaction.aggregate([
      { $match: { user: uid(req.userId), type: "expense" } },
      {
        $group: {
          _id: "$merchant",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// MONTHLY DATA
exports.getMonthlyData = async (req, res) => {
  try {
    const data = await Transaction.aggregate([
      { $match: { user: uid(req.userId) } },
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" } },
          income: {
            $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
          },
          expense: {
            $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// CATEGORY SUMMARY
exports.getCategorySummary = async (req, res) => {
  try {
    const extra = periodFilter(req.query.period);
    const data = await Transaction.aggregate([
      { $match: { user: uid(req.userId), type: "expense", ...extra } },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// AI CONTEXT
exports.getAIContext = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.userId })
      .sort({ date: -1 })
      .limit(300);

    const totalExpense = transactions
      .filter((t) => t.type === "expense")
      .reduce((a, t) => a + t.amount, 0);
    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((a, t) => a + t.amount, 0);

    const byCategory = {};
    const byMerchant = {};
    transactions.forEach((t) => {
      if (t.type === "expense") {
        byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
        byMerchant[t.merchant] = (byMerchant[t.merchant] || 0) + t.amount;
      }
    });

    const monthly = {};
    transactions.forEach((t) => {
      const key = `${new Date(t.date).getFullYear()}-${new Date(t.date).getMonth() + 1}`;
      if (!monthly[key]) monthly[key] = { income: 0, expense: 0 };
      monthly[key][t.type] += t.amount;
    });

    res.json({
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      transactionCount: transactions.length,
      topCategories: Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, amount]) => ({ name, amount })),
      topMerchants: Object.entries(byMerchant)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, amount]) => ({ name, amount })),
      recentTransactions: transactions.slice(0, 15).map((t) => ({
        merchant: t.merchant,
        amount: t.amount,
        category: t.category,
        type: t.type,
        date: t.date,
        note: t.note,
      })),
      monthlyTrend: monthly,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
