import { useEffect, useState } from "react";
import API from "../services/api";
import { useTheme } from "../context/ThemeContext";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Users,
  CheckCircle2,
  Circle,
} from "lucide-react";

const fmt = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;

const COLORS = [
  "#16a34a",
  "#2563eb",
  "#dc2626",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#be185d",
  "#0f766e",
  "#b45309",
  "#4338ca",
];

function Avatar({ name, size = 36, color }) {
  const initials =
    name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color + "22",
        border: `2px solid ${color}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: size * 0.35, fontWeight: "700", color }}>
        {initials}
      </span>
    </div>
  );
}

function ProgressRing({ pct, size = 44, color }) {
  const r = (size - 5) / 2;
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
        strokeWidth={5}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Split() {
  const { t } = useTheme();
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({
    title: "",
    totalAmount: "",
    paidBy: "You",
    participants: "",
    note: "",
    date: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSplits();
  }, []);

  const fetchSplits = async () => {
    try {
      const r = await API.get("/transactions/splits");
      setSplits(r.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditItem(null);
    setForm({
      title: "",
      totalAmount: "",
      paidBy: "You",
      participants: "",
      note: "",
      date: "",
    });
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditItem(s);
    setForm({
      title: s.title,
      totalAmount: s.totalAmount,
      paidBy: s.paidBy,
      participants: s.participants.map((p) => p.name).join(", "),
      note: s.note || "",
      date: s.date ? s.date.slice(0, 10) : "",
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title || !form.totalAmount || !form.participants.trim()) return;
    setSaving(true);
    try {
      const names = form.participants
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      const total = parseFloat(form.totalAmount);
      const share = parseFloat((total / names.length).toFixed(2));
      const participants = names.map((name) => ({
        name,
        share,
        settled: false,
      }));
      const payload = {
        title: form.title,
        totalAmount: total,
        paidBy: form.paidBy,
        participants,
        note: form.note,
        date: form.date || undefined,
      };
      if (editItem)
        await API.put(`/transactions/splits/${editItem._id}`, payload);
      else await API.post("/transactions/splits", payload);
      setShowForm(false);
      setEditItem(null);
      fetchSplits();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const deleteSplit = async (id) => {
    if (!window.confirm("Delete this split?")) return;
    await API.delete(`/transactions/splits/${id}`);
    fetchSplits();
  };

  const toggleSettle = async (split, participantName) => {
    const updated = split.participants.map((p) =>
      p.name === participantName ? { ...p, settled: !p.settled } : p,
    );
    await API.put(`/transactions/splits/${split._id}`, {
      participants: updated,
    });
    fetchSplits();
  };

  // Summary
  const totalOwed = splits.reduce((sum, s) => {
    return (
      sum +
      s.participants
        .filter((p) => p.name !== s.paidBy && !p.settled)
        .reduce((a, p) => a + p.share, 0)
    );
  }, 0);
  const totalSplits = splits.length;
  const settledCount = splits.filter((s) =>
    s.participants.every((p) => p.settled || p.name === s.paidBy),
  ).length;

  const inp = (placeholder, key, type = "text") => (
    <input
      type={type}
      placeholder={placeholder}
      value={form[key]}
      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
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

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Header ─────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "22px",
          gap: "12px",
          flexWrap: "wrap",
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
            Split Expenses
          </h1>
          <p style={{ color: t.textSub, fontSize: "13px", marginTop: "3px" }}>
            Track who owes what with friends
          </p>
        </div>
        <button
          onClick={openNew}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: t.green,
            color: "#fff",
            border: "none",
            padding: "9px 16px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: "700",
            cursor: "pointer",
          }}
        >
          <Plus size={15} /> New Split
        </button>
      </div>

      {/* ── Summary cards ──────────────────────────────── */}
      <div
        className="grid grid-1 grid-md-3"
        style={{
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        {[
          {
            label: "Total Splits",
            value: totalSplits,
            sub: "created",
            color: t.text,
            icon: "📋",
          },
          {
            label: "Pending Amount",
            value: fmt(totalOwed),
            sub: "owed to you",
            color: "#f59e0b",
            icon: "⏳",
          },
          {
            label: "Settled Splits",
            value: settledCount,
            sub: "fully paid",
            color: t.green,
            icon: "✅",
          },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              background: t.surface,
              borderRadius: "16px",
              padding: "18px",
              border: `1px solid ${t.border}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: "11px",
                    color: t.textSub,
                    marginBottom: "6px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {s.label}
                </p>
                <p
                  style={{
                    fontSize: "22px",
                    fontWeight: "800",
                    color: s.color,
                    letterSpacing: "-0.5px",
                  }}
                >
                  {s.value}
                </p>
                <p
                  style={{
                    fontSize: "11px",
                    color: t.textSub,
                    marginTop: "3px",
                  }}
                >
                  {s.sub}
                </p>
              </div>
              <span style={{ fontSize: "22px" }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Add / Edit Form ─────────────────────────────── */}
      {showForm && (
        <div
          style={{
            background: t.surface,
            borderRadius: "16px",
            padding: "22px",
            border: `1px solid ${t.border}`,
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "18px",
            }}
          >
            <div>
              <p style={{ fontSize: "15px", fontWeight: "700", color: t.text }}>
                {editItem ? "Edit Split" : "New Split Expense"}
              </p>
              <p
                style={{ fontSize: "12px", color: t.textSub, marginTop: "2px" }}
              >
                Amount is divided equally among all participants
              </p>
            </div>
            <button
              onClick={() => {
                setShowForm(false);
                setEditItem(null);
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: t.textSub,
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div
            className="formGrid formGrid-md-2"
            style={{ gap: "12px" }}
          >
            <div style={{ gridColumn: "1 / -1" }}>
              <label
                style={{
                  fontSize: "11px",
                  color: t.textSub,
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "600",
                }}
              >
                WHAT'S THE EXPENSE? *
              </label>
              {inp("e.g. Dinner at Barbeque Nation", "title")}
            </div>
            <div>
              <label
                style={{
                  fontSize: "11px",
                  color: t.textSub,
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "600",
                }}
              >
                TOTAL AMOUNT (₹) *
              </label>
              {inp("1200", "totalAmount", "number")}
            </div>
            <div>
              <label
                style={{
                  fontSize: "11px",
                  color: t.textSub,
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "600",
                }}
              >
                WHO PAID?
              </label>
              {inp("You", "paidBy")}
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label
                style={{
                  fontSize: "11px",
                  color: t.textSub,
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "600",
                }}
              >
                PARTICIPANTS (comma-separated, include yourself) *
              </label>
              {inp("You, Ravi, Priya, Arun", "participants")}
            </div>
            <div>
              <label
                style={{
                  fontSize: "11px",
                  color: t.textSub,
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "600",
                }}
              >
                NOTE (optional)
              </label>
              {inp("Farewell dinner", "note")}
            </div>
            <div>
              <label
                style={{
                  fontSize: "11px",
                  color: t.textSub,
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "600",
                }}
              >
                DATE (optional)
              </label>
              {inp("", "date", "date")}
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                background: saving ? "#86efac" : t.green,
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: "700",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving
                ? "Saving..."
                : editItem
                  ? "Update Split"
                  : "Create Split"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditItem(null);
              }}
              style={{
                background: "none",
                border: `1px solid ${t.border}`,
                color: t.textMuted,
                padding: "10px 16px",
                borderRadius: "10px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: t.textSub }}>
          Loading...
        </div>
      ) : splits.length === 0 ? (
        <div
          style={{
            background: t.surface,
            borderRadius: "20px",
            padding: "60px 40px",
            border: `1px solid ${t.border}`,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: t.greenBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 18px",
            }}
          >
            <Users size={32} color={t.green} />
          </div>
          <p
            style={{
              fontSize: "18px",
              fontWeight: "700",
              color: t.text,
              marginBottom: "8px",
            }}
          >
            No splits yet
          </p>
          <p
            style={{
              color: t.textSub,
              fontSize: "14px",
              marginBottom: "24px",
              lineHeight: "1.6",
            }}
          >
            Create your first split to track
            <br />
            shared expenses with friends
          </p>
          <button
            onClick={openNew}
            style={{
              background: t.green,
              color: "#fff",
              border: "none",
              padding: "11px 24px",
              borderRadius: "12px",
              fontSize: "14px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            + Create First Split
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {splits.map((s, si) => {
            const allSettled = s.participants.every(
              (p) => p.settled || p.name === s.paidBy,
            );
            const settledPct =
              s.participants.length > 0
                ? (s.participants.filter(
                    (p) => p.settled || p.name === s.paidBy,
                  ).length /
                    s.participants.length) *
                  100
                : 0;

            return (
              <div
                key={s._id}
                style={{
                  background: t.surface,
                  borderRadius: "18px",
                  border: `1px solid ${allSettled ? t.green + "55" : t.border}`,
                  overflow: "hidden",
                  transition: "box-shadow 0.15s",
                }}
              >
                {/* Card header */}
                <div
                  style={{
                    padding: "18px 20px",
                    background: allSettled ? t.greenBg : "transparent",
                    borderBottom: `1px solid ${t.border}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "4px",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "16px",
                            fontWeight: "800",
                            color: t.text,
                          }}
                        >
                          {s.title}
                        </p>
                        {allSettled && (
                          <span
                            style={{
                              fontSize: "11px",
                              background: t.green,
                              color: "#fff",
                              padding: "2px 8px",
                              borderRadius: "20px",
                              fontWeight: "600",
                            }}
                          >
                            SETTLED
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <span style={{ fontSize: "12px", color: t.textSub }}>
                          💳 Paid by{" "}
                          <strong style={{ color: t.text }}>{s.paidBy}</strong>
                        </span>
                        {s.date && (
                          <span style={{ fontSize: "12px", color: t.textSub }}>
                            📅{" "}
                            {new Date(s.date).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        )}
                        {s.note && (
                          <span style={{ fontSize: "12px", color: t.textSub }}>
                            📝 {s.note}
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      {/* Progress ring */}
                      <div style={{ position: "relative" }}>
                        <ProgressRing
                          pct={settledPct}
                          color={allSettled ? t.green : "#f59e0b"}
                        />
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
                              fontSize: "10px",
                              fontWeight: "700",
                              color: t.text,
                            }}
                          >
                            {Math.round(settledPct)}%
                          </span>
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <p
                          style={{
                            fontSize: "20px",
                            fontWeight: "800",
                            color: t.text,
                            letterSpacing: "-0.5px",
                          }}
                        >
                          {fmt(s.totalAmount)}
                        </p>
                        <p style={{ fontSize: "11px", color: t.textSub }}>
                          {fmt(s.totalAmount / (s.participants.length || 1))}{" "}
                          each
                        </p>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <button
                          onClick={() => openEdit(s)}
                          style={{
                            background: t.hover,
                            border: `1px solid ${t.border}`,
                            borderRadius: "8px",
                            padding: "5px 8px",
                            cursor: "pointer",
                            color: t.textMuted,
                          }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => deleteSplit(s._id)}
                          style={{
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: "8px",
                            padding: "5px 8px",
                            cursor: "pointer",
                            color: t.red,
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Participants */}
                <div style={{ padding: "16px 20px" }}>
                  <p
                    style={{
                      fontSize: "11px",
                      fontWeight: "600",
                      color: t.textSub,
                      marginBottom: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    PARTICIPANTS
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {s.participants.map((p, i) => {
                      const isPayer = p.name === s.paidBy;
                      const personColor = COLORS[i % COLORS.length];
                      const isSettled = p.settled || isPayer;

                      return (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "10px 14px",
                            borderRadius: "12px",
                            background: isSettled ? t.greenBg : t.hover,
                            border: `1px solid ${isSettled ? t.green + "33" : t.border}`,
                            opacity: isSettled && !isPayer ? 0.7 : 1,
                            transition: "all 0.15s",
                          }}
                        >
                          <Avatar name={p.name} size={36} color={personColor} />

                          <div style={{ flex: 1 }}>
                            <p
                              style={{
                                fontWeight: "600",
                                color: t.text,
                                fontSize: "13px",
                                textDecoration:
                                  isSettled && !isPayer
                                    ? "line-through"
                                    : "none",
                              }}
                            >
                              {p.name}
                            </p>
                            <p
                              style={{
                                fontSize: "11px",
                                color: t.textSub,
                                marginTop: "1px",
                              }}
                            >
                              {isPayer
                                ? "💰 Paid for everyone"
                                : isSettled
                                  ? "✓ Settled"
                                  : "Owes you"}
                            </p>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <p
                              style={{
                                fontWeight: "700",
                                fontSize: "14px",
                                color: isPayer
                                  ? t.green
                                  : isSettled
                                    ? t.textSub
                                    : t.text,
                              }}
                            >
                              {isPayer
                                ? `+${fmt(s.totalAmount - p.share)}`
                                : fmt(p.share)}
                            </p>

                            {!isPayer && (
                              <button
                                onClick={() => toggleSettle(s, p.name)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: "2px",
                                  color: p.settled ? t.green : t.border,
                                  transition: "color 0.15s",
                                }}
                                title={
                                  p.settled
                                    ? "Mark as unsettled"
                                    : "Mark as settled"
                                }
                              >
                                {p.settled ? (
                                  <CheckCircle2 size={22} />
                                ) : (
                                  <Circle size={22} />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Settle summary */}
                  {!allSettled && (
                    <div
                      style={{
                        marginTop: "14px",
                        padding: "10px 14px",
                        background: "#fffbeb",
                        borderRadius: "10px",
                        border: "1px solid #fde68a",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#92400e",
                          fontWeight: "500",
                        }}
                      >
                        ⏳ Still pending
                      </span>
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: "700",
                          color: "#d97706",
                        }}
                      >
                        {fmt(
                          s.participants
                            .filter((p) => !p.settled && p.name !== s.paidBy)
                            .reduce((a, p) => a + p.share, 0),
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
