import { useState, useRef, useEffect } from "react";
import API from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { Send, Bot, User, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown"; // ✅ ADDED

const SUGGESTIONS = [
  "How can I reduce my spending?",
  "Where did I spend the most this month?",
  "Am I saving enough?",
  "What spending patterns do you see?",
  "Give me a full spending summary",
  "Which category should I cut back on?",
  "How does my income compare to expenses?",
  "What are my top 3 expenses?",
];

const buildSystemPrompt = (ctx) => {
  if (!ctx)
    return "You are MoneyMind, a helpful personal finance assistant for Indian users.";
  const rate =
    ctx.totalIncome > 0
      ? (
          ((ctx.totalIncome - ctx.totalExpense) / ctx.totalIncome) *
          100
        ).toFixed(1)
      : 0;

  return `You are MoneyMind...`; // (kept same for brevity)
};

export default function AIAssistant() {
  const { t } = useTheme();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    API.get("/transactions/ai-context")
      .then((r) => {
        setContext(r.data);
        setCtxLoading(false);
      })
      .catch(() => setCtxLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput("");

    const newMsgs = [...messages, { role: "user", content: msg }];
    setMessages(newMsgs);
    setLoading(true);

    try {
      const res = await API.post("/transactions/chat", {
        messages: newMsgs.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        systemPrompt: buildSystemPrompt(context),
      });

      const reply = res.data?.content?.[0]?.text;
      if (!reply) throw new Error("Empty response");

      setMessages([...newMsgs, { role: "assistant", content: reply }]);
    } catch (err) {
      const errMsg =
        err.response?.data?.error || err.message || "Something went wrong";

      setMessages([...newMsgs, { role: "assistant", content: `⚠️ ${errMsg}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        height: "calc(100vh - 110px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* HEADER (unchanged) */}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          paddingBottom: "12px",
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              gap: "7px",
              alignItems: "flex-start",
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
                }}
              >
                <Bot size={14} color={t.green} />
              </div>
            )}

            <div
              style={{
                maxWidth: "76%",
                background: msg.role === "user" ? t.green : t.surface,
                color: msg.role === "user" ? "#fff" : t.text,
                borderRadius:
                  msg.role === "user"
                    ? "13px 13px 4px 13px"
                    : "13px 13px 13px 4px",
                padding: "10px 14px",
                fontSize: "13px",
                border: msg.role === "user" ? "none" : `1px solid ${t.border}`,
              }}
            >
              {/* ✅ MARKDOWN RENDERING ADDED HERE */}
              <div style={{ lineHeight: "1.7", color: t.text }}>
                <ReactMarkdown
                  components={{
                    p: ({ children }) => (
                      <p style={{ marginBottom: "8px" }}>{children}</p>
                    ),
                    strong: ({ children }) => (
                      <strong style={{ fontWeight: 600 }}>{children}</strong>
                    ),
                    li: ({ children }) => (
                      <li style={{ marginBottom: "4px" }}>{children}</li>
                    ),
                    ul: ({ children }) => (
                      <ul
                        style={{
                          paddingLeft: "20px",
                          marginBottom: "8px",
                        }}
                      >
                        {children}
                      </ul>
                    ),
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>

            {msg.role === "user" && (
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <User size={14} color={t.textSub} />
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* INPUT BOX (unchanged) */}
    </div>
  );
}
