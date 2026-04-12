import { useEffect, useState, useCallback } from "react";
import API from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { useAutoRefresh } from "../hooks/useOffline";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const PERIODS = [
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Quarter", value: "quarter" },
  { label: "Year", value: "year" },
  { label: "All", value: "all" },
];
const SHADES = [
  "#14532d",
  "#166534",
  "#15803d",
  "#16a34a",
  "#22c55e",
  "#4ade80",
  "#86efac",
  "#bbf7d0",
];
const fmt = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;

function Tip({ active, payload, label, t }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: "10px",
        padding: "10px 14px",
        fontSize: "13px",
      }}
    >
      <p style={{ color: t.textSub, marginBottom: "4px" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ fontWeight: "700", color: p.color || t.text }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

function CircleProgress({ pct, size = 54, stroke = 5, color }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * circ;
  return (
    <svg
      width={size}
      height={size}
      style={{ transform: "rotate(-90deg)", flexShrink: 0 }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Dashboard() {
  const { t } = useTheme();
  const [period, setPeriod] = useState("month");
  const [insights, setInsights] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [catData, setCatData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [weekly, setWeekly] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [gForm, setGForm] = useState({
    name: "",
    targetAmount: "",
    savedAmount: "",
    deadline: "",
    emoji: "🎯",
  });
  const [budgets, setBudgets] = useState({});
  const [editBudget, setEditBudget] = useState(null);
  const [budgetVal, setBudgetVal] = useState("");

  const DEFAULTS = {
    Food: 4000,
    Travel: 2000,
    Shopping: 3000,
    Bills: 5000,
    Entertainment: 1500,
  };

  const fetchAll = useCallback(async () => {
    try {
      const [r1, r2, r3, r4, r5, r6, r7] = await Promise.allSettled([
        API.get(`/transactions/insights?period=${period}`),
        API.get("/transactions/monthly"),
        API.get(`/transactions/category-summary?period=${period}`),
        API.get("/transactions/budget-alerts"),
        API.get("/transactions/weekly"),
        API.get("/transactions/goals"),
        API.get("/transactions/budgets"),
      ]);
      if (r1.status === "fulfilled") setInsights(r1.value.data);
      if (r2.status === "fulfilled") {
        setMonthly(
          r2.value.data.map((d) => ({
            name: MONTHS[(d._id?.month || 1) - 1],
            income: d.income || 0,
            expense: d.expense || 0,
          })),
        );
      }
      if (r3.status === "fulfilled") setCatData(r3.value.data || []);
      if (r4.status === "fulfilled") setAlerts(r4.value.data || []);
      if (r5.status === "fulfilled") setWeekly(r5.value.data);
      if (r6.status === "fulfilled") setGoals(r6.value.data || []);
      if (r7.status === "fulfilled") {
        const b = { ...DEFAULTS };
        r7.value.data.forEach((d) => {
          b[d.category] = d.limit;
        });
        setBudgets(b);
      }
    } catch (e) {
      console.warn("Dashboard error:", e.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  useAutoRefresh(fetchAll, 30000);

  const saveGoal = async () => {
    if (!gForm.name || !gForm.targetAmount) return;
    try {
      if (editGoal) await API.put(`/transactions/goals/${editGoal._id}`, gForm);
      else await API.post("/transactions/goals", gForm);
      setShowGoalForm(false);
      setEditGoal(null);
      setGForm({
        name: "",
        targetAmount: "",
        savedAmount: "",
        deadline: "",
        emoji: "🎯",
      });
      fetchAll();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteGoal = async (id) => {
    await API.delete(`/transactions/goals/${id}`);
    fetchAll();
  };

  const openEdit = (g) => {
    setEditGoal(g);
    setGForm({
      name: g.name,
      targetAmount: g.targetAmount,
      savedAmount: g.savedAmount,
      deadline: g.deadline ? g.deadline.slice(0, 10) : "",
      emoji: g.emoji || "🎯",
    });
    setShowGoalForm(true);
  };

  const saveBudget = async (cat) => {
    const val = parseFloat(budgetVal);
    if (!val || val <= 0) return;
    await API.post("/transactions/budgets", { category: cat, limit: val });
    setBudgets((prev) => ({ ...prev, [cat]: val }));
    setEditBudget(null);
  };

  const savingsRate =
    insights?.totalIncome > 0
      ? (
          ((insights.totalIncome - insights.totalExpense) /
            insights.totalIncome) *
          100
        ).toFixed(1)
      : 0;

  const inp = (placeholder, key, type = "text") => (
    <input
      type={type}
      placeholder={placeholder}
      value={gForm[key]}
      onChange={(e) => setGForm((f) => ({ ...f, [key]: e.target.value }))}
      style={{
        width: "100%",
        padding: "9px 12px",
        border: `1.5px solid ${t.border}`,
        borderRadius: "9px",
        fontSize: "13px",
        outline: "none",
        background: t.inputBg,
        color: t.text,
        boxSizing: "border-box",
        fontFamily: "inherit",
      }}
      onFocus={(e) => (e.target.style.borderColor = t.green)}
      onBlur={(e) => (e.target.style.borderColor = t.border)}
    />
  );

  if (loading && !insights)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              border: `3px solid ${t.border}`,
              borderTopColor: t.green,
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 12px",
            }}
          />
          <p style={{ color: t.textSub, fontSize: "14px" }}>Loading...</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );

  const card = (label, value, color, sub) => (
    <div
      style={{
        background: t.surface,
        borderRadius: "14px",
        padding: "18px",
        border: `1px solid ${t.border}`,
      }}
    >
      <p
        style={{
          fontSize: "11px",
          fontWeight: "600",
          color: t.textSub,
          marginBottom: "6px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "20px",
          fontWeight: "800",
          color,
          letterSpacing: "-0.5px",
        }}
      >
        {value}
      </p>
      <p style={{ fontSize: "11px", color: t.textSub, marginTop: "4px" }}>
        {sub}
      </p>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header + period toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "22px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: "800",
              color: t.text,
              letterSpacing: "-0.5px",
            }}
          >
            Dashboard
          </h1>
          <p style={{ color: t.textSub, fontSize: "13px", marginTop: "3px" }}>
            Your financial overview
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: "4px",
            background: t.surface,
            padding: "4px",
            borderRadius: "12px",
            border: `1px solid ${t.border}`,
          }}
        >
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "none",
                fontSize: "12px",
                fontWeight: "500",
                cursor: "pointer",
                background: period === p.value ? t.green : "transparent",
                color: period === p.value ? "#fff" : t.textMuted,
                transition: "all 0.15s",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Budget alerts */}
      {alerts.map((a, i) => (
        <div
          key={i}
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "10px",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "10px",
          }}
        >
          <AlertTriangle size={14} color="#d97706" />
          <span style={{ fontSize: "13px", color: "#92400e" }}>
            <strong>{a.category}</strong> over budget this month — spent{" "}
            {fmt(a.spent)} of {fmt(a.limit)} limit
          </span>
        </div>
      ))}

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        {card(
          "Balance",
          fmt(insights?.balance),
          t.text,
          insights?.balance >= 0 ? "Positive balance" : "Negative balance",
        )}
        {card(
          "Income",
          fmt(insights?.totalIncome),
          t.green,
          `${insights?.count || 0} transactions`,
        )}
        {card("Expenses", fmt(insights?.totalExpense), t.red, "This period")}
        {card(
          "Savings Rate",
          `${savingsRate}%`,
          parseFloat(savingsRate) >= 20 ? t.green : "#f59e0b",
          parseFloat(savingsRate) >= 20 ? "Healthy ✓" : "Below 20% ⚠",
        )}
      </div>

      {/* Weekly strip */}
      {weekly && (
        <div
          style={{
            background: t.surface,
            borderRadius: "14px",
            padding: "14px 20px",
            border: `1px solid ${t.border}`,
            marginBottom: "16px",
            display: "flex",
            gap: "28px",
            alignItems: "center",
          }}
        >
          <p
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: t.textSub,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Weekly
          </p>
          {[
            {
              label: "This Week",
              value: fmt(weekly.thisWeekTotal),
              color: t.text,
            },
            {
              label: "Last Week",
              value: fmt(weekly.lastWeekTotal),
              color: t.text,
            },
            {
              label: "Change",
              value: `${parseFloat(weekly.change) > 0 ? "+" : ""}${weekly.change}%`,
              color: parseFloat(weekly.change) > 0 ? t.red : t.green,
            },
          ].map((s, i) => (
            <div key={i}>
              <p
                style={{
                  fontSize: "11px",
                  color: t.textSub,
                  marginBottom: "2px",
                }}
              >
                {s.label}
              </p>
              <p
                style={{ fontSize: "17px", fontWeight: "700", color: s.color }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Charts row 1 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: "14px",
          marginBottom: "14px",
        }}
      >
        <div
          style={{
            background: t.surface,
            borderRadius: "14px",
            padding: "20px",
            border: `1px solid ${t.border}`,
          }}
        >
          <p
            style={{
              fontSize: "13px",
              fontWeight: "700",
              color: t.text,
              marginBottom: "16px",
            }}
          >
            Income vs Expenses
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} barGap={3}>
              <CartesianGrid
                stroke={t.border}
                strokeDasharray="4 4"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: t.textSub }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: t.textSub }}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<Tip t={t} />} />
              <Bar
                dataKey="income"
                fill={t.green}
                radius={[3, 3, 0, 0]}
                name="Income"
              />
              <Bar
                dataKey="expense"
                fill={t.red}
                radius={[3, 3, 0, 0]}
                name="Expense"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div
          style={{
            background: t.surface,
            borderRadius: "14px",
            padding: "20px",
            border: `1px solid ${t.border}`,
          }}
        >
          <p
            style={{
              fontSize: "13px",
              fontWeight: "700",
              color: t.text,
              marginBottom: "16px",
            }}
          >
            Spending by Category
          </p>
          {catData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={catData}
                  dataKey="total"
                  nameKey="_id"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={40}
                >
                  {catData.map((_, i) => (
                    <Cell key={i} fill={SHADES[i % SHADES.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => fmt(v)}
                  contentStyle={{
                    background: t.surface,
                    border: `1px solid ${t.border}`,
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: "11px", color: t.textSub }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{
                height: 220,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: t.textSub,
                fontSize: "13px",
              }}
            >
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "14px",
          marginBottom: "14px",
        }}
      >
        <div
          style={{
            background: t.surface,
            borderRadius: "14px",
            padding: "20px",
            border: `1px solid ${t.border}`,
          }}
        >
          <p
            style={{
              fontSize: "13px",
              fontWeight: "700",
              color: t.text,
              marginBottom: "16px",
            }}
          >
            Monthly Trend
          </p>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={monthly}>
              <CartesianGrid
                stroke={t.border}
                strokeDasharray="4 4"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: t.textSub }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: t.textSub }}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<Tip t={t} />} />
              <Line
                type="monotone"
                dataKey="expense"
                stroke={t.red}
                strokeWidth={2}
                dot={{ r: 3, fill: t.red, strokeWidth: 0 }}
                name="Expense"
              />
              <Line
                type="monotone"
                dataKey="income"
                stroke={t.green}
                strokeWidth={2}
                dot={{ r: 3, fill: t.green, strokeWidth: 0 }}
                name="Income"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div
          style={{
            background: t.surface,
            borderRadius: "14px",
            padding: "20px",
            border: `1px solid ${t.border}`,
          }}
        >
          <p
            style={{
              fontSize: "13px",
              fontWeight: "700",
              color: t.text,
              marginBottom: "16px",
            }}
          >
            Top Categories
          </p>
          {catData.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart
                data={catData.slice(0, 5)}
                layout="vertical"
                margin={{ left: 8 }}
              >
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: t.textSub }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  dataKey="_id"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: t.textSub }}
                  width={76}
                />
                <Tooltip content={<Tip t={t} />} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} name="Spent">
                  {catData.slice(0, 5).map((_, i) => (
                    <Cell key={i} fill={SHADES[i % SHADES.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{
                height: 190,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: t.textSub,
                fontSize: "13px",
              }}
            >
              No data
            </div>
          )}
        </div>
      </div>

      {/* Budget progress */}
      {catData.filter((c) => budgets[c._id]).length > 0 && (
        <div
          style={{
            background: t.surface,
            borderRadius: "14px",
            padding: "20px",
            border: `1px solid ${t.border}`,
            marginBottom: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "14px",
            }}
          >
            <p style={{ fontSize: "13px", fontWeight: "700", color: t.text }}>
              Budget Progress
            </p>
            <p style={{ fontSize: "11px", color: t.textSub }}>
              Click limit to edit · current month only
            </p>
          </div>
          {catData
            .filter((c) => budgets[c._id])
            .map((cat) => {
              const limit = budgets[cat._id] || 0;
              const pct =
                limit > 0 ? Math.min((cat.total / limit) * 100, 100) : 0;
              const over = cat.total > limit;
              return (
                <div key={cat._id} style={{ marginBottom: "14px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "5px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: "600",
                        color: t.text,
                      }}
                    >
                      {cat._id}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          color: over ? t.red : t.textSub,
                        }}
                      >
                        {fmt(cat.total)}
                      </span>
                      <span style={{ fontSize: "12px", color: t.textSub }}>
                        /
                      </span>
                      {editBudget === cat._id ? (
                        <div style={{ display: "flex", gap: "4px" }}>
                          <input
                            autoFocus
                            value={budgetVal}
                            onChange={(e) => setBudgetVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveBudget(cat._id);
                              if (e.key === "Escape") setEditBudget(null);
                            }}
                            style={{
                              width: "70px",
                              padding: "2px 6px",
                              fontSize: "12px",
                              border: `1px solid ${t.green}`,
                              borderRadius: "6px",
                              background: t.inputBg,
                              color: t.text,
                              outline: "none",
                            }}
                          />
                          <button
                            onClick={() => saveBudget(cat._id)}
                            style={{
                              fontSize: "11px",
                              background: t.green,
                              color: "#fff",
                              border: "none",
                              borderRadius: "5px",
                              padding: "2px 7px",
                              cursor: "pointer",
                            }}
                          >
                            ✓
                          </button>
                        </div>
                      ) : (
                        <span
                          onClick={() => {
                            setEditBudget(cat._id);
                            setBudgetVal(String(limit));
                          }}
                          style={{
                            fontSize: "12px",
                            color: t.green,
                            cursor: "pointer",
                            fontWeight: "600",
                          }}
                        >
                          {fmt(limit)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      background: t.border,
                      borderRadius: "99px",
                      height: "5px",
                    }}
                  >
                    <div
                      style={{
                        height: "5px",
                        borderRadius: "99px",
                        background: over
                          ? t.red
                          : pct > 80
                            ? "#f59e0b"
                            : t.green,
                        width: `${pct}%`,
                        transition: "width 0.5s",
                      }}
                    />
                  </div>
                  <p
                    style={{
                      fontSize: "11px",
                      color: t.textSub,
                      marginTop: "3px",
                    }}
                  >
                    {pct.toFixed(0)}% used{over ? " — OVER BUDGET" : ""}
                  </p>
                </div>
              );
            })}
        </div>
      )}

      {/* Financial Goals */}
      <div
        style={{
          background: t.surface,
          borderRadius: "14px",
          padding: "20px",
          border: `1px solid ${t.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <p style={{ fontSize: "13px", fontWeight: "700", color: t.text }}>
            Financial Goals
          </p>
          <button
            onClick={() => {
              setShowGoalForm(true);
              setEditGoal(null);
              setGForm({
                name: "",
                targetAmount: "",
                savedAmount: "",
                deadline: "",
                emoji: "🎯",
              });
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              background: t.green,
              color: "#fff",
              border: "none",
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            <Plus size={13} /> Add Goal
          </button>
        </div>

        {showGoalForm && (
          <div
            style={{
              background: t.hover,
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "16px",
              border: `1px solid ${t.border}`,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr 1fr 1fr 1fr",
                gap: "10px",
                alignItems: "end",
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: "11px",
                    color: t.textSub,
                    display: "block",
                    marginBottom: "5px",
                  }}
                >
                  EMOJI
                </label>
                <input
                  value={gForm.emoji}
                  onChange={(e) =>
                    setGForm((f) => ({ ...f, emoji: e.target.value }))
                  }
                  style={{
                    width: "48px",
                    padding: "8px",
                    border: `1.5px solid ${t.border}`,
                    borderRadius: "8px",
                    fontSize: "18px",
                    textAlign: "center",
                    background: t.inputBg,
                    outline: "none",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: "11px",
                    color: t.textSub,
                    display: "block",
                    marginBottom: "5px",
                  }}
                >
                  GOAL NAME *
                </label>
                {inp("e.g. iPhone 15", "name")}
              </div>
              <div>
                <label
                  style={{
                    fontSize: "11px",
                    color: t.textSub,
                    display: "block",
                    marginBottom: "5px",
                  }}
                >
                  TARGET (₹) *
                </label>
                {inp("100000", "targetAmount", "number")}
              </div>
              <div>
                <label
                  style={{
                    fontSize: "11px",
                    color: t.textSub,
                    display: "block",
                    marginBottom: "5px",
                  }}
                >
                  SAVED SO FAR
                </label>
                {inp("42000", "savedAmount", "number")}
              </div>
              <div>
                <label
                  style={{
                    fontSize: "11px",
                    color: t.textSub,
                    display: "block",
                    marginBottom: "5px",
                  }}
                >
                  DEADLINE
                </label>
                {inp("", "deadline", "date")}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <button
                onClick={saveGoal}
                style={{
                  background: t.green,
                  color: "#fff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                {editGoal ? "Update" : "Save Goal"}
              </button>
              <button
                onClick={() => {
                  setShowGoalForm(false);
                  setEditGoal(null);
                }}
                style={{
                  background: "none",
                  border: `1px solid ${t.border}`,
                  color: t.textMuted,
                  padding: "8px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {goals.length === 0 && !showGoalForm ? (
          <p
            style={{
              color: t.textSub,
              fontSize: "13px",
              textAlign: "center",
              padding: "20px 0",
            }}
          >
            No goals yet. Add one to start tracking!
          </p>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {goals.map((g) => {
              const pct =
                g.targetAmount > 0
                  ? Math.min((g.savedAmount / g.targetAmount) * 100, 100)
                  : 0;
              const remaining = g.targetAmount - g.savedAmount;
              return (
                <div
                  key={g._id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "12px 14px",
                    background: t.hover,
                    borderRadius: "12px",
                    border: `1px solid ${t.border}`,
                  }}
                >
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <CircleProgress pct={pct} color={t.green} />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: "700",
                          color: t.text,
                        }}
                      >
                        {Math.round(pct)}%
                      </span>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontWeight: "700",
                        color: t.text,
                        fontSize: "14px",
                        marginBottom: "2px",
                      }}
                    >
                      {g.emoji} {g.name}
                    </p>
                    {g.deadline && (
                      <p
                        style={{
                          fontSize: "11px",
                          color: t.textSub,
                          marginBottom: "2px",
                        }}
                      >
                        Deadline:{" "}
                        {new Date(g.deadline).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    )}
                    <p style={{ fontSize: "11px", color: t.textSub }}>
                      {remaining > 0
                        ? `${fmt(remaining)} remaining`
                        : "🎉 Goal reached!"}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: "11px", color: t.textSub }}>Saved</p>
                    <p
                      style={{
                        fontWeight: "700",
                        color: t.green,
                        fontSize: "14px",
                      }}
                    >
                      {fmt(g.savedAmount)}
                    </p>
                    <p
                      style={{
                        fontSize: "11px",
                        color: t.textSub,
                        marginTop: "2px",
                      }}
                    >
                      of {fmt(g.targetAmount)}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                    <button
                      onClick={() => openEdit(g)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: t.textMuted,
                        padding: "4px",
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => deleteGoal(g._id)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: t.red,
                        padding: "4px",
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
