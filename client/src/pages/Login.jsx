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

    if (!form.email || !form.password) {
      return setError("Please fill all required fields");
    }

    setLoading(true);

    try {
      if (tab === "login") {
        const res = await API.post("/auth/login", {
          email: form.email,
          password: form.password,
        });

        console.log("LOGIN RESPONSE:", res.data);

        // ✅ STRICT VALIDATION
        if (!res.data || !res.data.token) {
          throw new Error(res.data?.message || "Invalid login response");
        }

        localStorage.setItem("token", res.data.token);
        window.location.href = "/";
      } else {
        // SIGNUP FLOW
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

        console.log("LOGIN RESPONSE:", res.data);

        if (!res.data || !res.data.token) {
          throw new Error(res.data?.message || "Invalid login response");
        }

        localStorage.setItem("token", res.data.token);

        setTimeout(() => {
          window.location.href = "/";
        }, 800);
      }
    } catch (err) {
      console.error("LOGIN ERROR:", err);

      setError(err.response?.data?.message || err.message || "Login failed");
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
      }}
    />
  );

  return (
    <div style={{ padding: "40px", maxWidth: "400px", margin: "auto" }}>
      <h2>{tab === "login" ? "Login" : "Signup"}</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>}

      {tab === "signup" && inp("Name", "name")}
      {inp("Email", "email")}
      {inp("Password", "password", "password")}

      <button onClick={submit} disabled={loading}>
        {loading ? "Loading..." : tab === "login" ? "Login" : "Signup"}
      </button>

      <p>
        {tab === "login" ? "No account?" : "Already have one?"}
        <button onClick={() => setTab(tab === "login" ? "signup" : "login")}>
          Switch
        </button>
      </p>
    </div>
  );
}
