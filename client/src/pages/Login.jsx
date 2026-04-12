import { useState } from "react";
import API from "../services/api";

export default function Login() {
  const [tab, setTab] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPass, setShowPass] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError("");
    setSuccess("");
    if (!form.email || !form.password)
      return setError("Please fill all required fields");
    setLoading(true);
    try {
      if (tab === "login") {
        const res = await API.post("/auth/login", {
          email: form.email,
          password: form.password,
        });
        localStorage.setItem("token", res.data.token);
        window.location.href = "/";
      } else {
        await API.post("/auth/signup", {
          email: form.email,
          password: form.password,
          name: form.name,
        });
        setSuccess("Account created! Signing you in...");
        const res = await API.post("/auth/login", {
          email: form.email,
          password: form.password,
        });
        localStorage.setItem("token", res.data.token);
        setTimeout(() => {
          window.location.href = "/";
        }, 800);
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Something went wrong. Check your server is running.",
      );
    } finally {
      setLoading(false);
    }
  };

  const inp = (placeholder, key, type = "text") => (
    <input
      type={type === "password" && showPass ? "text" : type}
      placeholder={placeholder}
      value={form[key]}
      onChange={(e) => set(key, e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && submit()}
      style={{
        width: "100%",
        padding: "12px 16px",
        borderRadius: "12px",
        border: "1.5px solid #e2e8f0",
        fontSize: "14px",
        outline: "none",
        background: "#fff",
        color: "#111",
        boxSizing: "border-box",
        fontFamily: "inherit",
        transition: "border 0.15s",
      }}
      onFocus={(e) => (e.target.style.border = "1.5px solid #16a34a")}
      onBlur={(e) => (e.target.style.border = "1.5px solid #e2e8f0")}
    />
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        fontFamily: "'Inter', system-ui, sans-serif",
        background: "#0d0f14",
      }}
    >
      {/* Left green panel */}
      <div
        style={{
          width: "48%",
          background:
            "linear-gradient(135deg, #14532d 0%, #166534 40%, #15803d 100%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {[
          { s: 300, t: -80, l: -80, o: 0.06 },
          { s: 200, b: 40, r: -60, o: 0.08 },
          { s: 100, t: "40%", r: 80, o: 0.1 },
        ].map((c, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: c.s,
              height: c.s,
              borderRadius: "50%",
              background: "#fff",
              opacity: c.o,
              top: c.t,
              left: c.l,
              bottom: c.b,
              right: c.r,
            }}
          />
        ))}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "48px",
            }}
          >
            <span style={{ fontSize: "26px" }}>📈</span>
            <span
              style={{
                fontSize: "22px",
                fontWeight: "800",
                color: "#fff",
                letterSpacing: "-0.5px",
              }}
            >
              MoneyMind
            </span>
          </div>
          <h1
            style={{
              fontSize: "34px",
              fontWeight: "800",
              color: "#fff",
              lineHeight: "1.2",
              marginBottom: "16px",
              letterSpacing: "-1px",
            }}
          >
            Take control of your
            <br />
            <span style={{ color: "#bbf7d0" }}>financial future.</span>
          </h1>
          <p
            style={{
              fontSize: "15px",
              color: "#86efac",
              lineHeight: "1.7",
              marginBottom: "36px",
            }}
          >
            Track every rupee. Understand your habits.
            <br />
            Reach your goals with AI-powered insights.
          </p>
          {[
            "Paste any bank SMS — auto-categorised",
            "AI that knows your spending patterns",
            "Goals, budgets, and split expenses",
          ].map((f, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "12px",
              }}
            >
              <span style={{ color: "#4ade80", fontSize: "10px" }}>✦</span>
              <span style={{ color: "#dcfce7", fontSize: "14px" }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px",
          background: "#f8fafc",
        }}
      >
        <div style={{ width: "100%", maxWidth: "400px" }}>
          {/* Tab switcher */}
          <div
            style={{
              display: "flex",
              background: "#e8ecf0",
              borderRadius: "12px",
              padding: "4px",
              marginBottom: "32px",
            }}
          >
            {["login", "signup"].map((tb) => (
              <button
                key={tb}
                onClick={() => {
                  setTab(tb);
                  setError("");
                  setSuccess("");
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "9px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  background: tab === tb ? "#fff" : "transparent",
                  color: tab === tb ? "#111" : "#6b7280",
                  boxShadow: tab === tb ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {tb === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <h2
            style={{
              fontSize: "22px",
              fontWeight: "800",
              color: "#111",
              marginBottom: "6px",
              letterSpacing: "-0.5px",
            }}
          >
            {tab === "login" ? "Welcome back 👋" : "Get started free ✨"}
          </h2>
          <p
            style={{ fontSize: "14px", color: "#6b7280", marginBottom: "24px" }}
          >
            {tab === "login"
              ? "Sign in to your MoneyMind account"
              : "Create your account in seconds"}
          </p>

          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "13px",
                marginBottom: "14px",
              }}
            >
              {error}
            </div>
          )}
          {success && (
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#16a34a",
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "13px",
                marginBottom: "14px",
              }}
            >
              {success}
            </div>
          )}

          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {tab === "signup" && inp("Your name (optional)", "name")}
            {inp("Email address", "email", "email")}
            <div style={{ position: "relative" }}>
              {inp("Password", "password", "password")}
              <button
                onClick={() => setShowPass((s) => !s)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#9ca3af",
                  fontSize: "12px",
                  fontFamily: "inherit",
                }}
              >
                {showPass ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          <button
            onClick={submit}
            disabled={loading}
            style={{
              width: "100%",
              marginTop: "18px",
              padding: "13px",
              background: loading ? "#86efac" : "#16a34a",
              color: "#fff",
              border: "none",
              borderRadius: "12px",
              fontSize: "15px",
              fontWeight: "700",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {loading
              ? "Please wait..."
              : tab === "login"
                ? "Sign In →"
                : "Create Account →"}
          </button>

          <p
            style={{
              textAlign: "center",
              fontSize: "13px",
              color: "#9ca3af",
              marginTop: "18px",
            }}
          >
            {tab === "login"
              ? "Don't have an account? "
              : "Already have an account? "}
            <button
              onClick={() => {
                setTab(tab === "login" ? "signup" : "login");
                setError("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#16a34a",
                fontWeight: "600",
                cursor: "pointer",
                fontSize: "13px",
                fontFamily: "inherit",
              }}
            >
              {tab === "login" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
