import { useState, useEffect } from "react";

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [serverReachable, setServerReachable] = useState(true);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => {
      setOnline(false);
      setServerReachable(false);
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    const checkServer = async () => {
      if (!navigator.onLine) {
        setServerReachable(false);
        return;
      }
      try {
        const base =
          process.env.REACT_APP_API_URL || "http://localhost:5000/api";
        const url = base.replace("/api", "/health");
        const res = await fetch(url, {
          method: "GET",
          signal: AbortSignal.timeout(3000),
        });
        setServerReachable(res.ok);
        if (res.ok) setOnline(true);
      } catch {
        setServerReachable(false);
      }
    };

    checkServer();
    const interval = setInterval(checkServer, 30000);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(interval);
    };
  }, []);

  return { online, serverReachable };
}

export function useAutoRefresh(callback, intervalMs = 30000) {
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine) callback();
    }, intervalMs);
    return () => clearInterval(interval);
  }, [callback, intervalMs]);
}
