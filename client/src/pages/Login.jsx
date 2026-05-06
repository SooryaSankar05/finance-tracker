import { useState, useEffect } from "react";
import API from "../services/api";
import { TrendingUp, Eye, EyeOff, ArrowRight, Check } from "lucide-react";

function Orbs() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {[
        { w: 300, h: 300, top: "-80px", left: "-80px", delay: "0s", dur: "8s" },
        { w: 200, h: 200, top: "40%",  left: "60%",   delay: "2s", dur: "10s" },
        { w: 160, h: 160, top: "70%",  left: "10%",   delay: "4s", dur: "7s"  },
        { w: 120, h: 120, top: "20%",  left: "75%",   delay: "1s", dur: "9s"  },
      ].map((o, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: o.w, height: o.h, top: o.top, left: o.left,
            background: "rgba(255,255,255,0.07)",
            animation: `float ${o.dur} ease-in-out infinite alternate`,
            animationDelay: o.delay,
          }}
        />
      ))}
    </div>
  );
}

function StatPill({ icon, label, value, delay }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-2xl px-4 py-3"
      style={{
        background: "rgba(255,255,255,0.12)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.18)",
        animation: "slideUp 0.6s ease both",
        animationDelay: delay,
      }}
    >
      <span className="text-xl">{icon}</span>
      <div>
        <p className="text-[11px] font-medium mb-px" style={{ color: "rgba(255,255,255,0.65)" }}>
          {label}
        </p>
        <p className="text-sm font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

export default function Login() {
  const [tab, setTab]         = useState("login");
  const [form, setForm]       = useState({ email: "", password: "", name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [mounted, setMounted]   = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(""); setSuccess("");
    if (!form.email || !form.password) return setError("Please fill all required fields");
    setLoading(true);
    try {
      if (tab === "login") {
        const res = await API.post("/auth/login", { email: form.email, password: form.password });
        if (!res.data?.token) throw new Error(res.data?.message || "Invalid login response");
        localStorage.setItem("token", res.data.token);
        window.location.href = "/";
      } else {
        await API.post("/auth/signup", { email: form.email, password: form.password, name: form.name });
        setSuccess("Account created! Signing you in...");
        const res = await API.post("/auth/login", { email: form.email, password: form.password });
        if (!res.data?.token) throw new Error(res.data?.message || "Invalid login response");
        localStorage.setItem("token", res.data.token);
        setTimeout(() => { window.location.href = "/"; }, 800);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || "Something went wrong");
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
      className={`flex flex-col md:flex-row min-h-screen transition-opacity duration-300 ${mounted ? "opacity-100" : "opacity-0"}`}
      style={{ fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif" }}
    >
      {/* Keyframe animations only — cannot be expressed without tailwind.config changes */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Syne:wght@700;800&display=swap');
        @keyframes float   { from { transform: translateY(0px) scale(1); }      to { transform: translateY(-30px) scale(1.05); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); }  to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn  { from { opacity: 0; transform: translateY(8px); }   to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>

      {/* ── LEFT PANEL ── */}
      <div
        className="w-full md:w-1/2 flex flex-col justify-center relative overflow-hidden px-6 py-8 md:px-10 md:py-14"
        style={{ background: "linear-gradient(145deg, #15803d 0%, #166534 50%, #14532d 100%)" }}
      >
        <Orbs />

        {/* Logo — always visible */}
        <div
          className="flex items-center gap-2.5 relative mb-0 md:mb-14"
          style={{ animation: "slideUp 0.6s ease both" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}
          >
            <TrendingUp size={20} color="#fff" strokeWidth={2.5} />
          </div>
          <span
            className="text-[22px] font-extrabold text-white tracking-[-0.5px]"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            MoneyMind
          </span>
        </div>

        {/* Headline — desktop only */}
        <div className="hidden md:block relative mb-9">
          <h1
            className="font-extrabold text-white leading-[1.15] mb-3.5"
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: "clamp(28px, 3.5vw, 38px)",
              letterSpacing: "-1px",
              animation: "slideUp 0.6s ease 0.1s both",
            }}
          >
            Your money,<br />
            <span className="text-green-300">finally smart.</span>
          </h1>
          <p
            className="text-[15px] leading-relaxed"
            style={{ color: "rgba(255,255,255,0.7)", animation: "slideUp 0.6s ease 0.2s both" }}
          >
            Track spending, analyse habits, and grow your savings with
            AI-powered insights tailored for India.
          </p>
        </div>

        {/* Features — desktop only */}
        <div className="hidden md:flex flex-col gap-2.5 mb-10">
          {features.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5"
              style={{ animation: "slideUp 0.6s ease both", animationDelay: `${0.3 + i * 0.08}s` }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(134,239,172,0.2)", border: "1px solid rgba(134,239,172,0.4)" }}
              >
                <Check size={11} color="#86efac" strokeWidth={3} />
              </div>
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>{f}</span>
            </div>
          ))}
        </div>

        {/* Stat pills — desktop only */}
        <div className="hidden md:flex gap-2.5 flex-wrap">
          <StatPill icon="💸" label="Avg. tracked" value="₹45,000/mo" delay="0.7s" />
          <StatPill icon="📈" label="Savings boost" value="Up to 23%"  delay="0.8s" />
        </div>

        {/* Shimmer bar */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{
            background: "linear-gradient(90deg, #86efac, #4ade80, #86efac)",
            backgroundSize: "200% 100%",
            animation: "shimmer 3s linear infinite",
          }}
        />
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="w-full md:w-1/2 flex items-center justify-center bg-white px-6 py-10 md:px-12 md:py-14">
        <div className="w-full max-w-sm" style={{ animation: "fadeIn 0.5s ease 0.2s both" }}>

          {/* Heading */}
          <div className="mb-7">
            <h2
              className="text-[26px] font-extrabold text-gray-900 tracking-[-0.5px] mb-1.5"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              {tab === "login" ? "Welcome back 👋" : "Get started free"}
            </h2>
            <p className="text-sm text-slate-500">
              {tab === "login" ? "Sign in to your MoneyMind account" : "Create your account in seconds"}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
            {["login", "signup"].map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); setSuccess(""); }}
                className={`flex-1 py-2 text-[13px] font-semibold cursor-pointer rounded-lg border-0 transition-all [font-family:inherit] ${
                  tab === t ? "bg-white text-gray-900 shadow-sm" : "bg-transparent text-slate-500"
                }`}
              >
                {t === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 mb-4 text-[13px] text-red-600">
              ⚠️ {error}
            </div>
          )}

          {/* Success banner */}
          {success && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3.5 py-2.5 mb-4 text-[13px] text-green-700">
              ✅ {success}
            </div>
          )}

          {/* Form fields */}
          <div className="flex flex-col gap-3.5 mb-5">
            {tab === "signup" && (
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">FULL NAME</label>
                <input
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm [font-family:inherit] outline-none bg-white text-gray-900 transition-all placeholder:text-slate-400 focus:border-green-600 focus:shadow-[0_0_0_3px_rgba(22,163,74,0.1)]"
                  placeholder="Rahul Sharma"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
              </div>
            )}

            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">EMAIL ADDRESS</label>
              <input
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm [font-family:inherit] outline-none bg-white text-gray-900 transition-all placeholder:text-slate-400 focus:border-green-600 focus:shadow-[0_0_0_3px_rgba(22,163,74,0.1)]"
                placeholder="you@example.com"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">PASSWORD</label>
              <div className="relative">
                <input
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 text-sm [font-family:inherit] outline-none bg-white text-gray-900 transition-all placeholder:text-slate-400 focus:border-green-600 focus:shadow-[0_0_0_3px_rgba(22,163,74,0.1)]"
                  placeholder={tab === "signup" ? "Min. 8 characters" : "Your password"}
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
                <button
                  onClick={() => setShowPass((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer text-slate-400 flex p-1"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Submit button */}
          <button
            onClick={submit}
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-white font-bold text-[15px] [font-family:inherit] flex items-center justify-center gap-2 border-0 cursor-pointer transition-all hover:-translate-y-px disabled:opacity-70 disabled:cursor-not-allowed disabled:translate-y-0"
            style={{
              background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
              boxShadow: "0 4px 14px rgba(22,163,74,0.35)",
            }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
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
          <p className="text-center mt-5 text-[13px] text-slate-500">
            {tab === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setTab(tab === "login" ? "signup" : "login"); setError(""); setSuccess(""); }}
              className="bg-transparent border-0 text-green-600 font-bold cursor-pointer text-[13px] [font-family:inherit] p-0"
            >
              {tab === "login" ? "Sign up free" : "Sign in"}
            </button>
          </p>

          {/* Trust badges */}
          <div className="flex items-center justify-center flex-wrap gap-x-5 gap-y-3 mt-8 pt-6 border-t border-slate-200">
            {["🔒 Secure", "🇮🇳 Built for India", "⚡ Free to use"].map((b, i) => (
              <span key={i} className="text-[11px] text-slate-400 font-medium">{b}</span>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
