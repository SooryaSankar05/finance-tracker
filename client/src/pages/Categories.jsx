import { useEffect, useState } from "react";
import API from "../services/api";
import { useTheme } from "../context/ThemeContext";
import {
  Search,
  ArrowLeft,
  ChevronRight,
  ShoppingBag,
  Utensils,
  Car,
  Zap,
  Heart,
  DollarSign,
  TrendingUp,
  Package,
  Film,
  GraduationCap,
  PiggyBank,
  ArrowLeftRight,
} from "lucide-react";

const CFG = {
  Food: { icon: Utensils, color: "#15803d", bg: "#f0fdf4" },
  Travel: { icon: Car, color: "#7c3aed", bg: "#f5f3ff" },
  Shopping: { icon: ShoppingBag, color: "#be185d", bg: "#fdf2f8" },
  Bills: { icon: Zap, color: "#1d4ed8", bg: "#eff6ff" },
  Income: { icon: TrendingUp, color: "#166534", bg: "#dcfce7" },
  Entertainment: { icon: Film, color: "#0e7490", bg: "#ecfeff" },
  Healthcare: { icon: Heart, color: "#b91c1c", bg: "#fef2f2" },
  Education: { icon: GraduationCap, color: "#92400e", bg: "#fffbeb" },
  Savings: { icon: PiggyBank, color: "#065f46", bg: "#ecfdf5" },
  Transfer: { icon: ArrowLeftRight, color: "#4338ca", bg: "#eef2ff" },
  Others: { icon: Package, color: "#374151", bg: "#f9fafb" },
};
const getCfg = (n) =>
  CFG[n] || { icon: DollarSign, color: "#374151", bg: "#f9fafb" };
const fmt = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const PERIODS = [
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Quarter", value: "quarter" },
  { label: "Year", value: "year" },
  { label: "All", value: "all" },
];

export default function Categories() {
  const { t } = useTheme();
  const [categories, setCategories] = useState([]);
  const [insights, setInsights] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");
  const [selected, setSelected] = useState(null);
  const [catTxns, setCatTxns] = useState([]);
  const [txnLoading, setTxnLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [c, ins] = await Promise.all([
        API.get(`/transactions/category-summary?period=${period}`),
        API.get(`/transactions/insights?period=${period}`),
      ]);
      setCategories(c.data || []);
      setInsights(ins.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openCategory = async (name) => {
    setSelected(name);
    setTxnLoading(true);
    try {
      const res = await API.get(
        `/transactions/all?category=${encodeURIComponent(name)}`,
      );
      setCatTxns(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setTxnLoading(false);
    }
  };

  const filtered = categories.filter((c) =>
    (c._id || "").toLowerCase().includes(search.toLowerCase()),
  );
  const totalSpend = categories.reduce((a, b) => a + (b.total || 0), 0);
  const topByCount = [...categories].sort((a, b) => b.count - a.count)[0];

  // Drill-down view
  if (selected) {
    const { icon: Icon, color, bg } = getCfg(selected);
    const summary = categories.find((c) => c._id === selected);
    return (
      <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <button
          onClick={() => setSelected(null)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: t.textSub,
            fontSize: "13px",
            marginBottom: "18px",
            padding: 0,
          }}
        >
          <ArrowLeft size={15} /> Back to Categories
        </button>
        <div
          style={{
            background: t.surface,
            borderRadius: "14px",
            padding: "18px 20px",
            border: `1px solid ${t.border}`,
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "46px",
              height: "46px",
              borderRadius: "12px",
              background: bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon size={20} color={color} />
          </div>
          <div>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: "800",
                color: t.text,
                letterSpacing: "-0.5px",
              }}
            >
              {selected}
            </h2>
            <p style={{ fontSize: "13px", color: t.textSub, marginTop: "2px" }}>
              {summary?.count || 0} transactions · Total {fmt(summary?.total)}
            </p>
          </div>
        </div>
        {txnLoading ? (
          <div
            style={{ textAlign: "center", padding: "40px", color: t.textSub }}
          >
            Loading...
          </div>
        ) : catTxns.length === 0 ? (
          <div
            style={{
              background: t.surface,
              borderRadius: "14px",
              padding: "40px",
              border: `1px solid ${t.border}`,
              textAlign: "center",
            }}
          >
            <p style={{ color: t.textSub }}>
              No transactions in this category yet.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
            {catTxns.map((tx) => (
              <div
                key={tx._id}
                style={{
                  background: t.surface,
                  borderRadius: "12px",
                  padding: "13px 16px",
                  border: `1px solid ${t.border}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <p
                    style={{
                      fontWeight: "600",
                      color: t.text,
                      fontSize: "13px",
                    }}
                  >
                    {tx.merchant &&
                    tx.merchant !== "Unknown" &&
                    tx.merchant !== "Personal Transfer"
                      ? tx.merchant
                      : tx.note || selected}
                    {tx.note && tx.merchant !== "Unknown" && (
                      <span style={{ fontWeight: "400", color: t.textSub }}>
                        {" "}
                        — {tx.note}
                      </span>
                    )}
                  </p>
                  <p
                    style={{
                      fontSize: "11px",
                      color: t.textSub,
                      marginTop: "2px",
                    }}
                  >
                    {tx.date
                      ? new Date(tx.date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : ""}
                  </p>
                </div>
                <p
                  style={{
                    fontWeight: "700",
                    fontSize: "14px",
                    color: tx.type === "income" ? t.green : t.red,
                  }}
                >
                  {tx.type === "income" ? "+" : "-"}
                  {fmt(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
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
            Categories
          </h1>
          <p style={{ color: t.textSub, fontSize: "13px", marginTop: "3px" }}>
            Click any category to see all transactions
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: "4px",
            background: t.surface,
            padding: "4px",
            borderRadius: "10px",
            border: `1px solid ${t.border}`,
          }}
        >
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                padding: "5px 11px",
                borderRadius: "7px",
                border: "none",
                fontSize: "12px",
                fontWeight: "500",
                cursor: "pointer",
                background: period === p.value ? t.green : "transparent",
                color: period === p.value ? "#fff" : t.textMuted,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!loading && insights && (
        <div style={{ display: "flex", gap: "12px", marginBottom: "18px" }}>
          {[
            {
              label: "Total Income",
              value: fmt(insights.totalIncome),
              color: t.green,
            },
            {
              label: "Highest Spending",
              value: fmt(categories[0]?.total || 0),
              color: t.red,
              sub: categories[0]?._id || "—",
            },
            {
              label: "Most Used",
              value: topByCount?._id || "—",
              color: t.text,
              sub: `${topByCount?.count || 0} transactions`,
            },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: t.surface,
                borderRadius: "12px",
                padding: "14px 16px",
                border: `1px solid ${t.border}`,
              }}
            >
              <p
                style={{
                  fontSize: "11px",
                  color: t.textSub,
                  marginBottom: "4px",
                }}
              >
                {s.label}
              </p>
              <p
                style={{ fontSize: "16px", fontWeight: "700", color: s.color }}
              >
                {s.value}
              </p>
              {s.sub && (
                <p
                  style={{
                    fontSize: "11px",
                    color: t.textSub,
                    marginTop: "2px",
                  }}
                >
                  {s.sub}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          background: t.surface,
          borderRadius: "10px",
          padding: "9px 13px",
          border: `1px solid ${t.border}`,
          marginBottom: "14px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <Search size={13} color={t.textSub} />
        <input
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            border: "none",
            outline: "none",
            fontSize: "13px",
            color: t.text,
            flex: 1,
            background: "transparent",
          }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: t.textSub }}>
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            background: t.surface,
            borderRadius: "14px",
            padding: "50px",
            border: `1px solid ${t.border}`,
            textAlign: "center",
          }}
        >
          <p style={{ color: t.textSub }}>
            No categories yet. Add some transactions first!
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: "12px",
          }}
        >
          {filtered.map((item, i) => {
            const { icon: Icon, color, bg } = getCfg(item._id);
            const pct =
              totalSpend > 0 ? ((item.total / totalSpend) * 100).toFixed(1) : 0;
            return (
              <div
                key={i}
                onClick={() => openCategory(item._id)}
                style={{
                  background: t.surface,
                  borderRadius: "14px",
                  padding: "18px",
                  border: `1px solid ${t.border}`,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = color;
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = t.border;
                  e.currentTarget.style.transform = "none";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "9px",
                    }}
                  >
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "9px",
                        background: bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={15} color={color} />
                    </div>
                    <div>
                      <p
                        style={{
                          fontWeight: "700",
                          color: t.text,
                          fontSize: "13px",
                        }}
                      >
                        {item._id}
                      </p>
                      <p style={{ fontSize: "11px", color: t.textSub }}>
                        {item.count} transactions
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={14} color={t.textSub} />
                </div>
                <p
                  style={{
                    fontSize: "19px",
                    fontWeight: "800",
                    color: t.text,
                    letterSpacing: "-0.5px",
                    marginBottom: "8px",
                  }}
                >
                  {fmt(item.total)}
                </p>
                <div
                  style={{
                    background: t.border,
                    borderRadius: "99px",
                    height: "4px",
                  }}
                >
                  <div
                    style={{
                      height: "4px",
                      borderRadius: "99px",
                      background: color,
                      width: `${Math.min(pct, 100)}%`,
                    }}
                  />
                </div>
                <p
                  style={{
                    fontSize: "11px",
                    color: t.textSub,
                    marginTop: "4px",
                  }}
                >
                  {pct}% of total spend
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
