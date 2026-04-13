import { useState, useEffect } from "react";
import API from "../services/api";
import { TrendingUp, Eye, EyeOff, ArrowRight, Check } from "lucide-react";

// Animated floating orbs for the left panel background
function Orbs() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        borderRadius: "inherit",
      }}
    >
      {[
        { w: 300, h: 300, top: "-80px", left: "-80px", delay: "0s", dur: "8s" },
        { w: 200, h: 200, top: "40%", left: "60%", delay: "2s", dur: "10s" },
        { w: 160, h: 160, top: "70%", left: "10%", delay: "4s", dur: "7s" },
        { w: 120, h: 120, top: "20%", left: "75%", delay: "1s", dur: "9s" },
      ].map((o, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: o.w,
            height: o.h,
            top: o.top,
            left: o.left,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.07)",
            animation: `float ${o.dur} ease-in-out infinite alternate`,
            animationDelay: o.delay,
          }}
        />
      ))}
    </div>
  );
}

// Stat pill shown on left panel
function StatPill({ icon, label, value, delay }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: "rgba(255,255,255,0.12)",
        backdropFilter: "blur(12px)",
        borderRadius: "14px",
        padding: "12px 16px",
        border: "1px solid rgba(255,255,255,0.18)",
        animation: `slideUp 0.6s ease both`,
        animationDelay: delay,
      }}
    >
      <span style={{ fontSize: "20px" }}>{icon}</span>
      <div>
        <p
          style={{
            color: "rgba(255,255,255,0.65)",
            fontSize: "11px",
            fontWeight: "500",
            marginBottom: "1px",
          }}
        >
          {label}
        </p>
        <p style={{ color: "#fff", fontSize: "14px", fontWeight: "700" }}>
          {value}
        </p>
      </div>
    </div>
  );
}

export default function Login() {
  const [tab, setTab] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
  }, []);

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
        if (!res.data?.token)
          throw new Error(res.data?.message || "Invalid login response");
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
        if (!res.data?.token)
          throw new Error(res.data?.message || "Invalid login response");
        localStorage.setItem("token", res.data.token);
        setTimeout(() => {
          window.location.href = "/";
        }, 800);
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  };

  const features = [
    "Track every rupee automatically",
    "AI-powered spending insights",
    "Smart budget alerts",
    "Split expenses with friends",
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "#f0f4f8",
        fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
        opacity: mounted ? 1 : 0,
        transition: "opacity 0.4s ease",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Syne:wght@700;800&display=swap');
        
        @keyframes float {
          from { transform: translateY(0px) scale(1); }
          to   { transform: translateY(-30px) scale(1.05); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .login-input {
          width: 100%;
          padding: 13px 16px;
          border-radius: 12px;
          border: 1.5px solid #e2e8f0;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          background: #fff;
          color: #1a202c;
          box-sizing: border-box;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .login-input:focus {
          border-color: #16a34a;
          box-shadow: 0 0 0 3px rgba(22,163,74,0.1);
        }
        .login-input::placeholder { color: #a0aec0; }
        .tab-btn {
          flex: 1;
          padding: 9px;
          border: none;
          background: transparent;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          border-radius: 9px;
          transition: all 0.2s;
          color: #718096;
        }
        .tab-btn.active {
          background: #fff;
          color: #1a202c;
          box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        }
        .submit-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
          color: #fff;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
          box-shadow: 0 4px 14px rgba(22,163,74,0.35);
        }
        .submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(22,163,74,0.45);
        }
        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
      `}</style>

      {/* ── LEFT PANEL ── */}
      <div
        style={{
          width: "45%",
          background:
            "linear-gradient(145deg, #15803d 0%, #166534 50%, #14532d 100%)",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px 52px",
          overflow: "hidden",
        }}
      >
        <Orbs />

        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "52px",
            position: "relative",
            animation: "slideUp 0.6s ease both",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          >
            <TrendingUp size={20} color="#fff" strokeWidth={2.5} />
          </div>
          <span
            style={{
              fontSize: "22px",
              fontFamily: "'Syne', sans-serif",
              fontWeight: "800",
              color: "#fff",
              letterSpacing: "-0.5px",
            }}
          >
            MoneyMind
          </span>
        </div>

        {/* Headline */}
        <div style={{ position: "relative", marginBottom: "36px" }}>
          <h1
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: "38px",
              fontWeight: "800",
              color: "#fff",
              lineHeight: "1.15",
              letterSpacing: "-1px",
              marginBottom: "14px",
              animation: "slideUp 0.6s ease 0.1s both",
            }}
          >
            Your money,
            <br />
            <span style={{ color: "#86efac" }}>finally smart.</span>
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: "15px",
              lineHeight: "1.6",
              animation: "slideUp 0.6s ease 0.2s both",
            }}
          >
            Track spending, analyse habits, and grow your savings with
            AI-powered insights tailored for India.
          </p>
        </div>

        {/* Feature list */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginBottom: "40px",
          }}
        >
          {features.map((f, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                animation: "slideUp 0.6s ease both",
                animationDelay: `${0.3 + i * 0.08}s`,
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "rgba(134,239,172,0.2)",
                  border: "1px solid rgba(134,239,172,0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Check size={11} color="#86efac" strokeWidth={3} />
              </div>
              <span
                style={{ color: "rgba(255,255,255,0.8)", fontSize: "14px" }}
              >
                {f}
              </span>
            </div>
          ))}
        </div>

        {/* Stat pills */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <StatPill
            icon="💸"
            label="Avg. tracked"
            value="₹45,000/mo"
            delay="0.7s"
          />
          <StatPill
            icon="📈"
            label="Savings boost"
            value="Up to 23%"
            delay="0.8s"
          />
        </div>

        {/* Bottom decorative bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, #86efac, #4ade80, #86efac)",
            backgroundSize: "200% 100%",
            animation: "shimmer 3s linear infinite",
          }}
        />
      </div>

      {/* ── RIGHT PANEL ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "400px",
            animation: "fadeIn 0.5s ease 0.2s both",
          }}
        >
          {/* Heading */}
          <div style={{ marginBottom: "28px" }}>
            <h2
              style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: "26px",
                fontWeight: "800",
                color: "#1a202c",
                letterSpacing: "-0.5px",
                marginBottom: "6px",
              }}
            >
              {tab === "login" ? "Welcome back 👋" : "Get started free"}
            </h2>
            <p style={{ color: "#718096", fontSize: "14px" }}>
              {tab === "login"
                ? "Sign in to your MoneyMind account"
                : "Create your account in seconds"}
            </p>
          </div>

          {/* Tab switcher */}
          <div
            style={{
              display: "flex",
              background: "#f0f4f8",
              borderRadius: "12px",
              padding: "4px",
              marginBottom: "24px",
            }}
          >
            {["login", "signup"].map((t) => (
              <button
                key={t}
                className={`tab-btn ${tab === t ? "active" : ""}`}
                onClick={() => {
                  setTab(t);
                  setError("");
                  setSuccess("");
                }}
              >
                {t === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Error / success banners */}
          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                padding: "10px 14px",
                marginBottom: "16px",
                fontSize: "13px",
                color: "#dc2626",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "10px",
                padding: "10px 14px",
                marginBottom: "16px",
                fontSize: "13px",
                color: "#16a34a",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              ✅ {success}
            </div>
          )}

          {/* Form fields */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              marginBottom: "20px",
            }}
          >
            {tab === "signup" && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#4a5568",
                    marginBottom: "6px",
                  }}
                >
                  FULL NAME
                </label>
                <input
                  className="login-input"
                  placeholder="Rahul Sharma"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
              </div>
            )}

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#4a5568",
                  marginBottom: "6px",
                }}
              >
                EMAIL ADDRESS
              </label>
              <input
                className="login-input"
                placeholder="you@example.com"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#4a5568",
                  marginBottom: "6px",
                }}
              >
                PASSWORD
              </label>
              <div style={{ position: "relative" }}>
                <input
                  className="login-input"
                  placeholder={
                    tab === "signup" ? "Min. 8 characters" : "Your password"
                  }
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  style={{ paddingRight: "44px" }}
                />
                <button
                  onClick={() => setShowPass((p) => !p)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#a0aec0",
                    padding: "4px",
                    display: "flex",
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Submit button */}
          <button className="submit-btn" onClick={submit} disabled={loading}>
            {loading ? (
              <>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid rgba(255,255,255,0.4)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                {tab === "login" ? "Signing in..." : "Creating account..."}
              </>
            ) : (
              <>
                {tab === "login" ? "Sign In" : "Create Account"}
                <ArrowRight size={16} strokeWidth={2.5} />
              </>
            )}
          </button>

          {/* Switch tab link */}
          <p
            style={{
              textAlign: "center",
              marginTop: "20px",
              fontSize: "13px",
              color: "#718096",
            }}
          >
            {tab === "login"
              ? "Don't have an account? "
              : "Already have an account? "}
            <button
              onClick={() => {
                setTab(tab === "login" ? "signup" : "login");
                setError("");
                setSuccess("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#16a34a",
                fontWeight: "700",
                cursor: "pointer",
                fontSize: "13px",
                fontFamily: "inherit",
                padding: 0,
              }}
            >
              {tab === "login" ? "Sign up free" : "Sign in"}
            </button>
          </p>

          {/* Trust badges */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "20px",
              marginTop: "32px",
              paddingTop: "24px",
              borderTop: "1px solid #e2e8f0",
            }}
          >
            {["🔒 Secure", "🇮🇳 Built for India", "⚡ Free to use"].map(
              (b, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: "11px",
                    color: "#a0aec0",
                    fontWeight: "500",
                  }}
                >
                  {b}
                </span>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
