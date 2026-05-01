import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Receipt,
  Tags,
  LogOut,
  TrendingUp,
  Bot,
  Users,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useOnlineStatus } from "../hooks/useOffline";

function ThemeSlider() {
  const { dark, toggle, t } = useTheme();
  return (
    <button
      onClick={toggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
      }}
      title="Toggle dark/light mode"
    >
      <Sun size={14} color={dark ? t.textMuted : "#f59e0b"} />
      <div
        style={{
          width: "40px",
          height: "21px",
          borderRadius: "99px",
          background: dark ? t.green : "#e2e8f0",
          position: "relative",
          transition: "background 0.25s",
          border: `1.5px solid ${dark ? t.green : "#d1d5db"}`,
        }}
      >
        <div
          style={{
            width: "15px",
            height: "15px",
            borderRadius: "50%",
            background: "#fff",
            position: "absolute",
            top: "1px",
            left: dark ? "20px" : "1px",
            transition: "left 0.25s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </div>
      <Moon size={14} color={dark ? "#818cf8" : t.textMuted} />
    </button>
  );
}

export default function MainLayout() {
  const { t } = useTheme();
  const { online, serverReachable } = useOnlineStatus();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileNavOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: t.bg }}>
      <Sidebar mobileOpen={mobileNavOpen} setMobileOpen={setMobileNavOpen} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "visible",
          minWidth: 0,
        }}
      >
        {/* Offline banner */}
        {(!online || !serverReachable) && (
          <div
            style={{
              background: !online ? "#fef2f2" : "#fffbeb",
              borderBottom: `1px solid ${!online ? "#fecaca" : "#fde68a"}`,
              padding: "8px 20px",
              fontSize: "12px",
              color: !online ? "#dc2626" : "#92400e",
            }}
          >
            {!online
              ? "📵 You're offline — showing cached data"
              : "⚠️ Server unreachable — check that your backend is running"}
          </div>
        )}
        {/* Top bar */}
        <div
          className="topbarFixed"
          style={{
            minHeight: "52px",
            background: t.surface,
            borderBottom: `1px solid ${t.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px",
            flexShrink: 0,
            gap: "16px",
            /* solid background + avoid bleed-through */
            boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
          }}
        >
          {/* Mobile hamburger */}
          <button
            className="tapTarget topbarHamburger"
            onClick={() => setMobileNavOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: `1px solid ${t.border}`,
              borderRadius: "10px",
              padding: "8px",
              cursor: "pointer",
              color: t.text,
            }}
            title="Open menu"
          >
            <Menu size={18} />
          </button>

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: serverReachable ? t.green : t.red,
              }}
            />
            <span style={{ fontSize: "11px", color: t.textSub }}>
              {serverReachable ? "Live" : "Offline"}
            </span>
          </div>
          <ThemeSlider />
        </div>
        {/* Page content */}
        <div style={{ flex: 1 }} className="topbarSpacer">
          <div
            className="container"
            style={{ paddingTop: "18px", paddingBottom: "18px" }}
          >
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ mobileOpen, setMobileOpen }) {
  const location = useLocation();
  const { t } = useTheme();

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Transactions", path: "/transactions", icon: Receipt },
    { name: "Categories", path: "/categories", icon: Tags },
    { name: "Split", path: "/split", icon: Users },
    { name: "AI Assistant", path: "/ai", icon: Bot },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="sidebarOverlay"
          style={{
            cursor: "pointer",
          }}
        />
      )}

      <div
        className="sidebarDrawer"
        style={{
          width: "240px",
          maxWidth: "82vw",
          background: t.surface,
          borderRight: `1px solid ${t.border}`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "18px 12px",
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          zIndex: 1001,
          transform: mobileOpen ? "translateX(0)" : "translateX(-105%)",
          transition: "transform 0.2s ease",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              marginBottom: "18px",
              paddingLeft: "7px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <TrendingUp size={19} color={t.green} strokeWidth={2.5} />
              <span
                style={{
                  fontSize: "17px",
                  fontWeight: "800",
                  color: t.text,
                  letterSpacing: "-0.5px",
                }}
              >
                MoneyMind
              </span>
            </div>
            <button
              className="tapTarget"
              onClick={() => setMobileOpen(false)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: `1px solid ${t.border}`,
                borderRadius: "10px",
                padding: "8px",
                cursor: "pointer",
                color: t.text,
              }}
              title="Close menu"
            >
              <X size={18} />
            </button>
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    padding: "10px 10px",
                    borderRadius: "10px",
                    textDecoration: "none",
                    fontSize: "13px",
                    fontWeight: active ? "600" : "500",
                    background: active ? t.greenBg : "transparent",
                    color: active ? t.green : t.textMuted,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = t.hover;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <button
          onClick={() => {
            localStorage.removeItem("token");
            window.location.href = "/login";
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 10px",
            borderRadius: "10px",
            border: "none",
            background: "transparent",
            color: t.red,
            fontSize: "13px",
            fontWeight: "500",
            cursor: "pointer",
            width: "100%",
            textAlign: "left",
          }}
        >
          <LogOut size={14} /> Log Out
        </button>
      </div>

      {/* Desktop static sidebar */}
      <div
        className="sidebarDesktop"
        style={{
          width: "240px",
          background: t.surface,
          borderRight: `1px solid ${t.border}`,
          display: "none",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "22px 12px",
          position: "sticky",
          top: 0,
          height: "100vh",
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "30px",
              paddingLeft: "7px",
            }}
          >
            <TrendingUp size={19} color={t.green} strokeWidth={2.5} />
            <span
              style={{
                fontSize: "17px",
                fontWeight: "800",
                color: t.text,
                letterSpacing: "-0.5px",
              }}
            >
              MoneyMind
            </span>
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    padding: "9px 10px",
                    borderRadius: "10px",
                    textDecoration: "none",
                    fontSize: "13px",
                    fontWeight: active ? "600" : "500",
                    background: active ? t.greenBg : "transparent",
                    color: active ? t.green : t.textMuted,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = t.hover;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem("token");
            window.location.href = "/login";
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 10px",
            borderRadius: "10px",
            border: "none",
            background: "transparent",
            color: t.red,
            fontSize: "13px",
            fontWeight: "500",
            cursor: "pointer",
            width: "100%",
          }}
        >
          <LogOut size={14} /> Log Out
        </button>
      </div>

    </>
  );
}
