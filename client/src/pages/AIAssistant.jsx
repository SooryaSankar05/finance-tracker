import { useState, useRef, useEffect } from "react";
import API from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { Bot, User, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

const SUGGESTIONS = [
  "How can I reduce my spending?",
  "Which category am I spending most on?",
  "Give me budgeting tips based on my data",
  "How to save more money this month?",
  "Show a summary of my recent transactions",
];

// ✅ FIX: buildSystemPrompt now actually injects real financial data
const buildSystemPrompt = (ctx) => {
  if (!ctx || ctx.transactionCount === 0) {
    return `You are MoneyMind, a helpful personal finance AI assistant.
The user has no transaction data yet. Give them friendly general financial advice and tips.
Keep responses concise and practical. Use Indian Rupee (₹) currency context.`;
  }

  const fmt = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;

  const topCats = (ctx.topCategories || [])
    .map((c) => `${c.name}: ${fmt(c.amount)}`)
    .join(", ");

  const topMerchants = (ctx.topMerchants || [])
    .map((m) => `${m.name}: ${fmt(m.amount)}`)
    .join(", ");

  const recent = (ctx.recentTransactions || [])
    .slice(0, 10)
    .map((t) => `${t.merchant} (${t.category}) - ${fmt(t.amount)} [${t.type}]`)
    .join("\n");

  return `You are MoneyMind, a smart personal finance AI assistant for an Indian user.

Here is their actual financial data:
- Total Income: ${fmt(ctx.totalIncome)}
- Total Expenses: ${fmt(ctx.totalExpense)}
- Net Balance: ${fmt(ctx.balance)}
- Total Transactions: ${ctx.transactionCount}

Top Spending Categories: ${topCats || "N/A"}
Top Merchants: ${topMerchants || "N/A"}

Recent Transactions:
${recent || "No recent transactions"}

Based on this real data, answer the user's finance questions with specific, actionable advice.
Keep responses concise, friendly, and practical. Use ₹ for currency.
If asked about something outside their data, give general financial wisdom.`;
};

export default function AIAssistant() {
  const { t } = useTheme();

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi 👋 I'm **MoneyMind**, your personal finance AI.\n\nI can analyze your spending, suggest savings tips, and answer any finance questions. What would you like to know?",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState(null);
  const [ctxLoading, setCtxLoading] = useState(true);

  const bottomRef = useRef(null);

  // Fetch AI context on mount
  useEffect(() => {
    API.get("/transactions/ai-context")
      .then((r) => {
        setContext(r.data);
        setCtxLoading(false);
      })
      .catch((err) => {
        console.error("AI context error:", err.response || err);
        setCtxLoading(false);
      });
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setInput("");

    const newMsgs = [...messages, { role: "user", content: msg }];
    setMessages(newMsgs);
    setLoading(true);

    try {
      const res = await API.post("/transactions/chat", {
        messages: newMsgs,
        systemPrompt: buildSystemPrompt(context),
      });

      // ✅ FIX: correct response path
      const reply =
        res.data?.content?.[0]?.text ||
        res.data?.reply ||
        "No response from AI";

      setMessages([...newMsgs, { role: "assistant", content: reply }]);
    } catch (err) {
      const errMsg =
        err.response?.data?.error || err.message || "Something went wrong";
      setMessages([...newMsgs, { role: "assistant", content: `⚠️ ${errMsg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Loading screen
  if (ctxLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "calc(100vh - 110px)",
          flexDirection: "column",
          gap: "12px",
          color: t.textSub,
        }}
      >
        <Bot size={32} color={t.green} />
        <p style={{ fontSize: "14px" }}>Loading AI Assistant...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 110px)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: t.surface,
          borderRadius: "14px",
          padding: "14px 18px",
          marginBottom: "14px",
          border: `1px solid ${t.border}`,
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: t.greenBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Bot size={18} color={t.green} />
        </div>
        <div>
          <p style={{ fontWeight: "700", fontSize: "14px", color: t.text }}>
            MoneyMind AI
          </p>
          <p style={{ fontSize: "11px", color: t.textSub }}>
            {context && context.transactionCount > 0
              ? `Analyzing ${context.transactionCount} transactions · Balance: ₹${(context.balance || 0).toLocaleString("en-IN")}`
              : "No transaction data yet — general advice mode"}
          </p>
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: t.greenBg,
            borderRadius: "20px",
            padding: "4px 10px",
          }}
        >
          <Sparkles size={11} color={t.green} />
          <span style={{ fontSize: "11px", color: t.green, fontWeight: "600" }}>
            Gemini AI
          </span>
        </div>
      </div>

      {/* Suggestion chips — only show on first message */}
      {messages.length === 1 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "14px",
          }}
        >
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => send(s)}
              style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: "20px",
                padding: "6px 12px",
                fontSize: "12px",
                color: t.textMuted,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = t.green;
                e.currentTarget.style.color = t.green;
                e.currentTarget.style.background = t.greenBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = t.border;
                e.currentTarget.style.color = t.textMuted;
                e.currentTarget.style.background = t.surface;
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Chat messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          paddingRight: "4px",
          paddingBottom: "8px",
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              alignItems: "flex-end",
              gap: "8px",
            }}
          >
            {msg.role === "assistant" && (
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  background: t.greenBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Bot size={14} color={t.green} />
              </div>
            )}

            <div
              style={{
                maxWidth: "72%",
                background: msg.role === "user" ? t.green : t.surface,
                color: msg.role === "user" ? "#fff" : t.text,
                borderRadius:
                  msg.role === "user"
                    ? "14px 14px 4px 14px"
                    : "14px 14px 14px 4px",
                padding: "10px 14px",
                fontSize: "13px",
                lineHeight: "1.6",
                border:
                  msg.role === "assistant" ? `1px solid ${t.border}` : "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
              }}
            >
              <ReactMarkdown
                components={{
                  p: ({ children }) => (
                    <p style={{ margin: "0 0 6px 0" }}>{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul style={{ margin: "4px 0", paddingLeft: "18px" }}>
                      {children}
                    </ul>
                  ),
                  li: ({ children }) => (
                    <li style={{ marginBottom: "2px" }}>{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong
                      style={{
                        color: msg.role === "user" ? "#fff" : t.text,
                        fontWeight: "700",
                      }}
                    >
                      {children}
                    </strong>
                  ),
                  code: ({ children }) => (
                    <code
                      style={{
                        background:
                          msg.role === "user"
                            ? "rgba(255,255,255,0.2)"
                            : t.inputBg,
                        borderRadius: "4px",
                        padding: "1px 5px",
                        fontSize: "12px",
                      }}
                    >
                      {children}
                    </code>
                  ),
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>

            {msg.role === "user" && (
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  background: t.green,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <User size={14} color="#fff" />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "8px",
                background: t.greenBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Bot size={14} color={t.green} />
            </div>
            <div
              style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: "14px 14px 14px 4px",
                padding: "12px 16px",
                display: "flex",
                gap: "4px",
                alignItems: "center",
              }}
            >
              {[0, 1, 2].map((d) => (
                <div
                  key={d}
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: t.green,
                    animation: `bounce 1.2s infinite ${d * 0.2}s`,
                    opacity: 0.7,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          marginTop: "12px",
          display: "flex",
          gap: "8px",
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: "14px",
          padding: "8px 8px 8px 14px",
          alignItems: "flex-end",
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about your finances... (Enter to send)"
          rows={1}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            color: t.text,
            fontSize: "13px",
            resize: "none",
            fontFamily: "inherit",
            lineHeight: "1.5",
            maxHeight: "100px",
            overflowY: "auto",
          }}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "10px",
            background: !input.trim() || loading ? t.border : t.green,
            border: "none",
            cursor: !input.trim() || loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background 0.15s",
          }}
        >
          <Send
            size={14}
            color={!input.trim() || loading ? t.textSub : "#fff"}
          />
        </button>
      </div>

      {/* Bounce animation */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}
