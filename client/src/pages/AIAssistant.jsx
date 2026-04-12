import { useState, useRef, useEffect } from "react";
import API from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

const SUGGESTIONS = [
  "How can I reduce my spending?",
  "Give me budgeting tips",
  "How to save money?",
];

const buildSystemPrompt = (ctx) => {
  if (!ctx) {
    return "You are MoneyMind. The user has no transaction data yet. Help them with general financial advice.";
  }

  return `You are MoneyMind, a finance assistant.`;
};

export default function AIAssistant() {
  const { t } = useTheme();

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi 👋 I'm your AI assistant. Ask me anything about your finances.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState(null);
  const [ctxLoading, setCtxLoading] = useState(true);

  const bottomRef = useRef(null);

  // 🔥 FETCH CONTEXT
  useEffect(() => {
    API.get("/transactions/ai-context")
      .then((r) => {
        console.log("AI CONTEXT:", r.data);
        setContext(r.data);
        setCtxLoading(false);
      })
      .catch((err) => {
        console.error("AI ERROR:", err.response || err);
        setCtxLoading(false);
      });
  }, []);

  // 🔥 AUTO SCROLL
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
        messages: newMsgs,
        systemPrompt: buildSystemPrompt(context),
      });

      const reply = res.data?.content?.[0]?.text;

      setMessages([
        ...newMsgs,
        {
          role: "assistant",
          content: reply || "No response from AI",
        },
      ]);
    } catch (err) {
      const errMsg =
        err.response?.data?.error || err.message || "Something went wrong";

      setMessages([...newMsgs, { role: "assistant", content: `⚠️ ${errMsg}` }]);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 LOADING STATE (NO BLANK SCREEN)
  if (ctxLoading) {
    return <div style={{ padding: 20 }}>Loading AI...</div>;
  }

  return (
    <div
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        height: "calc(100vh - 110px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 🔥 EMPTY DATA MESSAGE */}
      {!context && (
        <div style={{ padding: 12, color: "gray" }}>
          No financial data yet. Add transactions or connect SMS.
        </div>
      )}

      {/* 🔥 SUGGESTIONS */}
      {messages.length === 1 && (
        <div style={{ padding: 10 }}>
          <strong>Try asking:</strong>
          <ul>
            {SUGGESTIONS.map((s, i) => (
              <li
                key={i}
                style={{ cursor: "pointer", marginBottom: 5 }}
                onClick={() => send(s)}
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 🔥 CHAT AREA */}
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
            }}
          >
            {msg.role === "assistant" && <Bot size={18} />}

            <div
              style={{
                maxWidth: "76%",
                background: msg.role === "user" ? t.green : t.surface,
                color: msg.role === "user" ? "#fff" : t.text,
                borderRadius: "10px",
                padding: "10px",
              }}
            >
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>

            {msg.role === "user" && <User size={18} />}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* 🔥 INPUT */}
      <div style={{ display: "flex", padding: 10 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something..."
          style={{ flex: 1, padding: 10 }}
        />
        <button onClick={() => send()}>Send</button>
      </div>
    </div>
  );
}
