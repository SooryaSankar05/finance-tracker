import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(
    () => localStorage.getItem("theme") === "dark",
  );

  useEffect(() => {
    localStorage.setItem("theme", dark ? "dark" : "light");
    document.body.style.background = dark ? "#0d0f14" : "#f4f6f9";
    document.body.style.color = dark ? "#e8eaf0" : "#111827";
  }, [dark]);

  const toggle = () => setDark((d) => !d);

  const t = dark
    ? {
        bg: "#0d0f14",
        surface: "#161a24",
        border: "#242836",
        text: "#e8eaf0",
        textMuted: "#64748b",
        textSub: "#94a3b8",
        green: "#22c55e",
        greenBg: "#14532d33",
        red: "#ef4444",
        redBg: "#7f1d1d33",
        blue: "#3b82f6",
        inputBg: "#1a1e2a",
        hover: "#1e2332",
      }
    : {
        bg: "#f4f6f9",
        surface: "#ffffff",
        border: "#e8ecf0",
        text: "#111827",
        textMuted: "#6b7280",
        textSub: "#9ca3af",
        green: "#16a34a",
        greenBg: "#f0fdf4",
        red: "#dc2626",
        redBg: "#fef2f2",
        blue: "#2563eb",
        inputBg: "#ffffff",
        hover: "#f8fafc",
      };

  return (
    <ThemeContext.Provider value={{ dark, toggle, t }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
