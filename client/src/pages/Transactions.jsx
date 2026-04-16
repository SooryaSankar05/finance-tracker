// FILE: client/src/pages/Transactions.jsx
// Changes from original:
// 1. Added delete button (trash icon) on each transaction row
// 2. PDF upload shows bank name detected
// 3. Preview shows up to 8 transactions instead of 5

import { useEffect, useState, useRef } from "react";
import API from "../services/api";
import { useTheme } from "../context/ThemeContext";
import {
  Search,
  ArrowUpCircle,
  ArrowDownCircle,
  MessageSquare,
  PenLine,
  FileText,
  X,
  Upload,
  CheckCircle,
  Trash2,
  LayoutList,
  Table2,
  Download,
} from "lucide-react";

const CAT_COLORS = {
  Food: "#15803d",
  Travel: "#7c3aed",
  Shopping: "#be185d",
  Bills: "#1d4ed8",
  Income: "#166534",
  Entertainment: "#0e7490",
  Healthcare: "#b91c1c",
  Education: "#92400e",
  Savings: "#065f46",
  Transfer: "#4338ca",
  Others: "#374151",
};
const CATS = [
  "Food",
  "Travel",
  "Shopping",
  "Bills",
  "Entertainment",
  "Healthcare",
  "Education",
  "Savings",
  "Transfer",
  "Others",
  "Income",
];
const fmt = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;

export default function Transactions() {
  const { t } = useTheme();
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState(null);
  const fileRef = useRef(null);

  // Delete state
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // tx._id to confirm

  // SMS state
  const [smsText, setSmsText] = useState("");
  const [smsAdding, setSmsAdding] = useState(false);

  // Manual state
  const [mAmt, setMAmt] = useState("");
  const [mCat, setMCat] = useState("Food");
  const [mNote, setMNote] = useState("");
  const [mType, setMType] = useState("expense");
  const [mDate, setMDate] = useState("");
  const [mAdding, setMAdding] = useState(false);

  // PDF state
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfLoadingMsg, setPdfLoadingMsg] = useState("Parsing your bank statement...");
  const [pdfResult, setPdfResult] = useState(null);
  const [pdfError, setPdfError] = useState("");
  const [pdfErrorType, setPdfErrorType] = useState("generic"); // "generic" | "scanned"

  // View mode: "cards" | "table"
  const [viewMode, setViewMode] = useState("cards");

  useEffect(() => {
    fetchData();
  }, []);

  // After 5 s of loading, hint that OCR may be running
  useEffect(() => {
    if (!pdfLoading) {
      setPdfLoadingMsg("Parsing your bank statement...");
      return;
    }
    const timer = setTimeout(() => {
      setPdfLoadingMsg("Attempting OCR scan...");
    }, 5000);
    return () => clearTimeout(timer);
  }, [pdfLoading]);

  useEffect(() => {
    let r = data;
    if (search)
      r = r.filter(
        (tx) =>
          (tx.merchant || "").toLowerCase().includes(search.toLowerCase()) ||
          (tx.category || "").toLowerCase().includes(search.toLowerCase()) ||
          (tx.note || "").toLowerCase().includes(search.toLowerCase()),
      );
    if (typeFilter !== "all") r = r.filter((tx) => tx.type === typeFilter);
    setFiltered(r);
  }, [search, typeFilter, data]);

  const fetchData = async () => {
    try {
      const res = await API.get("/transactions/all");
      setData(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── DELETE TRANSACTION ────────────────────────────────────
  const deleteTransaction = async (id) => {
    setDeletingId(id);
    try {
      await API.delete(`/transactions/${id}`);
      setData((prev) => prev.filter((tx) => tx._id !== id));
      setConfirmDelete(null);
    } catch (e) {
      console.error(e);
      alert("Failed to delete. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const addSMS = async () => {
    if (!smsText.trim()) return;
    setSmsAdding(true);
    try {
      const blocks = smsText
        .split(/\n{2,}|---+/)
        .map((b) => b.trim())
        .filter(Boolean);
      if (blocks.length > 1)
        await API.post("/transactions/bulk", { texts: blocks });
      else await API.post("/transactions/add", { text: smsText.trim() });
      setSmsText("");
      setAddMode(null);
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setSmsAdding(false);
    }
  };

  const addManual = async () => {
    if (!mAmt || parseFloat(mAmt) <= 0) return;
    setMAdding(true);
    try {
      await API.post("/transactions/add", {
        manual: true,
        amount: parseFloat(mAmt),
        category: mCat,
        note: mNote,
        type: mType,
        date: mDate || undefined,
      });
      setMAmt("");
      setMNote("");
      setMDate("");
      setAddMode(null);
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setMAdding(false);
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfResult(null);
    setPdfError("");
    setPdfErrorType("generic");
    setPdfLoading(true);
    try {
      const formData = new FormData();
      formData.append("statement", file);
      const token = localStorage.getItem("token");
      const baseUrl =
        process.env.REACT_APP_API_URL || "http://localhost:5000/api";
      const response = await fetch(`${baseUrl}/pdf/upload`, {
        method: "POST",
        headers: { authorization: token },
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        setPdfError(result.error || "Upload failed");
        setPdfErrorType(response.status === 422 ? "scanned" : "generic");
        return;
      }
      setPdfResult(result);
      fetchData();
    } catch (err) {
      setPdfError("Upload failed: " + err.message);
    } finally {
      setPdfLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const displayName = (tx) => {
    if (
      tx.merchant &&
      tx.merchant !== "Unknown" &&
      tx.merchant !== "Personal Transfer"
    )
      return tx.merchant;
    return tx.note || tx.category || "Transaction";
  };

  const totalIncome = data
    .filter((tx) => tx.type === "income")
    .reduce((a, b) => a + b.amount, 0);
  const totalExpense = data
    .filter((tx) => tx.type === "expense")
    .reduce((a, b) => a + b.amount, 0);

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const escape = (s) => `"${String(s || "").replace(/"/g, '""')}"`;
    const headers = ["Date", "Merchant", "Note", "Category", "Type", "Amount (₹)"];
    const rows = filtered.map((tx) => [
      tx.date ? new Date(tx.date).toLocaleDateString("en-IN") : "",
      escape(tx.merchant || ""),
      escape(tx.note || ""),
      escape(tx.category || ""),
      tx.type || "",
      tx.amount ?? 0,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    const label =
      typeFilter !== "all" ? `_${typeFilter}` : "";
    a.download = `transactions${label}_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inp = (placeholder, val, setVal, type = "text") => (
    <input
      type={type}
      placeholder={placeholder}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      style={{
        width: "100%",
        padding: "9px 11px",
        border: `1.5px solid ${t.border}`,
        borderRadius: "9px",
        fontSize: "13px",
        outline: "none",
        background: t.inputBg,
        color: t.text,
        boxSizing: "border-box",
        fontFamily: "inherit",
      }}
      onFocus={(e) => (e.target.style.borderColor = t.green)}
      onBlur={(e) => (e.target.style.borderColor = t.border)}
    />
  );

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Confirm delete modal */}
      {confirmDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: t.surface,
              borderRadius: "16px",
              padding: "24px 28px",
              border: `1px solid ${t.border}`,
              maxWidth: "360px",
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "#fef2f2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trash2 size={18} color="#dc2626" />
              </div>
              <p style={{ fontWeight: "700", fontSize: "15px", color: t.text }}>
                Delete transaction?
              </p>
            </div>
            <p
              style={{
                fontSize: "13px",
                color: t.textSub,
                marginBottom: "20px",
              }}
            >
              This will permanently remove the transaction. This action cannot
              be undone.
            </p>
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "9px",
                  fontSize: "13px",
                  border: `1px solid ${t.border}`,
                  background: t.surface,
                  color: t.text,
                  cursor: "pointer",
                  fontWeight: "500",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTransaction(confirmDelete)}
                disabled={deletingId === confirmDelete}
                style={{
                  padding: "8px 16px",
                  borderRadius: "9px",
                  fontSize: "13px",
                  border: "none",
                  background:
                    deletingId === confirmDelete ? "#fca5a5" : "#dc2626",
                  color: "#fff",
                  cursor:
                    deletingId === confirmDelete ? "not-allowed" : "pointer",
                  fontWeight: "600",
                }}
              >
                {deletingId === confirmDelete ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: "800",
              color: t.text,
              letterSpacing: "-0.5px",
            }}
          >
            Transactions
          </h1>
          <p style={{ color: t.textSub, fontSize: "13px", marginTop: "3px" }}>
            {data.length} total
          </p>
        </div>
        <div style={{ display: "flex", gap: "7px" }}>
          {[
            { mode: "sms", label: "Paste SMS", Icon: MessageSquare },
            { mode: "manual", label: "Manual", Icon: PenLine },
            { mode: "pdf", label: "Upload PDF", Icon: FileText },
          ].map(({ mode, label, Icon }) => (
            <button
              key={mode}
              onClick={() => {
                setAddMode(addMode === mode ? null : mode);
                setPdfResult(null);
                setPdfError("");
                setPdfErrorType("generic");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                background: addMode === mode ? t.green : t.surface,
                color: addMode === mode ? "#fff" : t.textMuted,
                border: `1.5px solid ${addMode === mode ? t.green : t.border}`,
                padding: "7px 13px",
                borderRadius: "9px",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}

          {/* Export CSV */}
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            title={
              filtered.length === 0
                ? "No transactions to export"
                : `Export ${filtered.length} transactions as CSV`
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              background: t.surface,
              color: filtered.length === 0 ? t.textSub : t.textMuted,
              border: `1.5px solid ${t.border}`,
              padding: "7px 13px",
              borderRadius: "9px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: filtered.length === 0 ? "not-allowed" : "pointer",
              opacity: filtered.length === 0 ? 0.5 : 1,
            }}
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* SMS Panel */}
      {addMode === "sms" && (
        <div
          style={{
            background: t.surface,
            borderRadius: "14px",
            padding: "18px 20px",
            border: `1px solid ${t.border}`,
            marginBottom: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "10px",
            }}
          >
            <div>
              <p style={{ fontSize: "13px", fontWeight: "700", color: t.text }}>
                Paste Bank SMS
              </p>
              <p
                style={{ fontSize: "11px", color: t.textSub, marginTop: "2px" }}
              >
                Any Indian bank — HDFC, SBI, ICICI, Axis, Kotak, UPI. Separate
                multiple SMS with a blank line.
              </p>
            </div>
            <button
              onClick={() => setAddMode(null)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: t.textSub,
              }}
            >
              <X size={15} />
            </button>
          </div>
          <textarea
            value={smsText}
            onChange={(e) => setSmsText(e.target.value)}
            rows={5}
            placeholder={
              "Sent Rs.60.00\nFrom HDFC Bank A/C *xxxx\nTo JAYASUDHA S\nOn 03/04/26\n\nYour A/c XX1234 debited Rs.500 at SWIGGY on 04-Apr-26"
            }
            style={{
              width: "100%",
              padding: "10px 12px",
              border: `1.5px solid ${t.border}`,
              borderRadius: "9px",
              fontSize: "13px",
              outline: "none",
              background: t.inputBg,
              color: t.text,
              resize: "vertical",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = t.green)}
            onBlur={(e) => (e.target.style.borderColor = t.border)}
          />
          <button
            onClick={addSMS}
            disabled={smsAdding}
            style={{
              marginTop: "10px",
              background: smsAdding ? "#86efac" : t.green,
              color: "#fff",
              border: "none",
              padding: "8px 16px",
              borderRadius: "9px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: smsAdding ? "not-allowed" : "pointer",
            }}
          >
            {smsAdding ? "Adding..." : "Add Transaction(s)"}
          </button>
        </div>
      )}

      {/* Manual Panel */}
      {addMode === "manual" && (
        <div
          style={{
            background: t.surface,
            borderRadius: "14px",
            padding: "18px 20px",
            border: `1px solid ${t.border}`,
            marginBottom: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <div>
              <p style={{ fontSize: "13px", fontWeight: "700", color: t.text }}>
                Manual Entry
              </p>
              <p
                style={{ fontSize: "11px", color: t.textSub, marginTop: "2px" }}
              >
                e.g. 210 spent on food at canteen
              </p>
            </div>
            <button
              onClick={() => setAddMode(null)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: t.textSub,
              }}
            >
              <X size={15} />
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "10px",
              marginBottom: "10px",
            }}
          >
            <div>
              <label
                style={{
                  fontSize: "11px",
                  color: t.textSub,
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                AMOUNT (₹) *
              </label>
              {inp("210", mAmt, setMAmt, "number")}
            </div>
            <div>
              <label
                style={{
                  fontSize: "11px",
                  color: t.textSub,
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                TYPE
              </label>
              <select
                value={mType}
                onChange={(e) => setMType(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 11px",
                  border: `1.5px solid ${t.border}`,
                  borderRadius: "9px",
                  fontSize: "13px",
                  outline: "none",
                  background: t.inputBg,
                  color: t.text,
                }}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: "11px",
                  color: t.textSub,
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                CATEGORY
              </label>
              <select
                value={mCat}
                onChange={(e) => setMCat(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 11px",
                  border: `1.5px solid ${t.border}`,
                  borderRadius: "9px",
                  fontSize: "13px",
                  outline: "none",
                  background: t.inputBg,
                  color: t.text,
                }}
              >
                {CATS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: "11px",
                  color: t.textSub,
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                NOTE
              </label>
              {inp("Lunch at office", mNote, setMNote)}
            </div>
            <div>
              <label
                style={{
                  fontSize: "11px",
                  color: t.textSub,
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                DATE (optional)
              </label>
              {inp("", mDate, setMDate, "date")}
            </div>
          </div>
          <button
            onClick={addManual}
            disabled={mAdding}
            style={{
              background: mAdding ? "#86efac" : t.green,
              color: "#fff",
              border: "none",
              padding: "8px 16px",
              borderRadius: "9px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: mAdding ? "not-allowed" : "pointer",
            }}
          >
            {mAdding ? "Adding..." : "Add Transaction"}
          </button>
        </div>
      )}

      {/* PDF Panel */}
      {addMode === "pdf" && (
        <div
          style={{
            background: t.surface,
            borderRadius: "14px",
            padding: "18px 20px",
            border: `1px solid ${t.border}`,
            marginBottom: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <div>
              <p style={{ fontSize: "13px", fontWeight: "700", color: t.text }}>
                Upload Bank Statement PDF
              </p>
              <p
                style={{ fontSize: "11px", color: t.textSub, marginTop: "2px" }}
              >
                Supports HDFC, SBI, ICICI, Axis. Must be a text-based PDF (not a
                scanned image).
              </p>
            </div>
            <button
              onClick={() => {
                setAddMode(null);
                setPdfResult(null);
                setPdfError("");
                setPdfErrorType("generic");
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: t.textSub,
              }}
            >
              <X size={15} />
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            onChange={handlePdfUpload}
            style={{ display: "none" }}
          />

          {!pdfLoading && !pdfResult && (
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                border: `2px dashed ${t.border}`,
                borderRadius: "12px",
                padding: "24px 20px",
                background: t.hover,
                cursor: "pointer",
                color: t.textMuted,
                fontSize: "14px",
                fontWeight: "500",
                width: "100%",
                justifyContent: "center",
              }}
            >
              <Upload size={20} />
              Click to select your bank statement PDF
            </button>
          )}

          {pdfLoading && (
            <div
              style={{
                border: `2px dashed ${t.green}`,
                borderRadius: "12px",
                padding: "24px 20px",
                background: t.greenBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  border: `3px solid ${t.border}`,
                  borderTopColor: t.green,
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <span
                style={{ color: t.green, fontSize: "14px", fontWeight: "600" }}
              >
                {pdfLoadingMsg}
              </span>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {pdfError && (
            <div
              style={{
                background: pdfErrorType === "scanned" ? "#fffbeb" : "#fef2f2",
                border: `1.5px solid ${pdfErrorType === "scanned" ? "#fcd34d" : "#fca5a5"}`,
                borderRadius: "12px",
                padding: "16px 18px",
                marginBottom: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ fontSize: "20px", lineHeight: 1, flexShrink: 0 }}>
                  {pdfErrorType === "scanned" ? "🖼️" : "⚠️"}
                </span>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      color: pdfErrorType === "scanned" ? "#92400e" : "#dc2626",
                      fontSize: "13px",
                      fontWeight: "700",
                      marginBottom: "4px",
                    }}
                  >
                    {pdfErrorType === "scanned"
                      ? "Scanned / image-based PDF detected"
                      : "Upload failed"}
                  </p>
                  <p
                    style={{
                      color: pdfErrorType === "scanned" ? "#78350f" : "#b91c1c",
                      fontSize: "12px",
                      lineHeight: "1.5",
                    }}
                  >
                    {pdfError}
                  </p>
                  {pdfErrorType === "scanned" && (
                    <p style={{ fontSize: "11px", color: "#92400e", marginTop: "6px" }}>
                      Tip: Download the statement directly from your bank's internet banking
                      portal — those PDFs are text-based and will parse correctly.
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setPdfError("");
                  setPdfErrorType("generic");
                  fileRef.current?.click();
                }}
                style={{
                  marginTop: "12px",
                  background: pdfErrorType === "scanned" ? "#d97706" : "#dc2626",
                  color: "#fff",
                  border: "none",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Try a Different File
              </button>
            </div>
          )}

          {pdfResult && (
            <div>
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "12px",
                  padding: "16px 18px",
                  marginBottom: "14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "10px",
                  }}
                >
                  <CheckCircle size={18} color="#16a34a" />
                  <p
                    style={{
                      color: "#16a34a",
                      fontSize: "14px",
                      fontWeight: "700",
                    }}
                  >
                    {pdfResult.message}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "12px", color: "#166534" }}>
                    ✓ {pdfResult.inserted} added
                  </span>
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>
                    ↷ {pdfResult.skipped} duplicates skipped
                  </span>
                  <span style={{ fontSize: "12px", color: "#374151" }}>
                    📄 {pdfResult.parsed} found in PDF
                  </span>
                  {pdfResult.bank && (
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#1d4ed8",
                        fontWeight: "600",
                      }}
                    >
                      🏦 {pdfResult.bank} Bank
                    </span>
                  )}
                </div>
              </div>

              {pdfResult.preview?.length > 0 && (
                <div>
                  <p
                    style={{
                      fontSize: "11px",
                      fontWeight: "600",
                      color: t.textSub,
                      marginBottom: "8px",
                    }}
                  >
                    FIRST {pdfResult.preview.length} TRANSACTIONS IMPORTED
                  </p>
                  {pdfResult.preview.map((tx, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: t.hover,
                        borderRadius: "8px",
                        marginBottom: "6px",
                        border: `1px solid ${t.border}`,
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontSize: "13px",
                            fontWeight: "600",
                            color: t.text,
                          }}
                        >
                          {tx.merchant}
                        </p>
                        <p style={{ fontSize: "11px", color: t.textSub }}>
                          {tx.category} · {tx.date}
                        </p>
                      </div>
                      <p
                        style={{
                          fontWeight: "700",
                          fontSize: "13px",
                          color: tx.type === "income" ? t.green : t.red,
                        }}
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {fmt(tx.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  setPdfResult(null);
                  fileRef.current?.click();
                }}
                style={{
                  marginTop: "10px",
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  color: t.text,
                  padding: "8px 16px",
                  borderRadius: "9px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Upload Another Statement
              </button>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        {[
          {
            label: "Total",
            value: `${data.length} transactions`,
            color: t.text,
          },
          { label: "Income", value: fmt(totalIncome), color: t.green },
          { label: "Expenses", value: fmt(totalExpense), color: t.red },
          {
            label: "Net",
            value: fmt(totalIncome - totalExpense),
            color: totalIncome >= totalExpense ? t.green : t.red,
          },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              background: t.surface,
              borderRadius: "11px",
              padding: "12px 14px",
              border: `1px solid ${t.border}`,
            }}
          >
            <p
              style={{
                fontSize: "11px",
                color: t.textSub,
                marginBottom: "3px",
              }}
            >
              {s.label}
            </p>
            <p style={{ fontSize: "16px", fontWeight: "700", color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div
        style={{
          background: t.surface,
          borderRadius: "10px",
          padding: "9px 12px",
          border: `1px solid ${t.border}`,
          marginBottom: "12px",
          display: "flex",
          gap: "10px",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative", flex: 1 }}>
          <Search
            size={13}
            color={t.textSub}
            style={{
              position: "absolute",
              left: "9px",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          <input
            placeholder="Search merchant, category, note..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              paddingLeft: "28px",
              paddingRight: "10px",
              paddingTop: "7px",
              paddingBottom: "7px",
              border: `1.5px solid ${t.border}`,
              borderRadius: "8px",
              fontSize: "13px",
              outline: "none",
              background: t.inputBg,
              color: t.text,
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = t.green)}
            onBlur={(e) => (e.target.style.borderColor = t.border)}
          />
        </div>
        {["all", "income", "expense"].map((f) => (
          <button
            key={f}
            onClick={() => setTypeFilter(f)}
            style={{
              padding: "7px 12px",
              borderRadius: "7px",
              fontSize: "12px",
              fontWeight: "500",
              cursor: "pointer",
              border: `1.5px solid ${typeFilter === f ? t.green : t.border}`,
              background: typeFilter === f ? t.greenBg : t.surface,
              color: typeFilter === f ? t.green : t.textMuted,
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <div
          style={{
            display: "flex",
            border: `1.5px solid ${t.border}`,
            borderRadius: "7px",
            overflow: "hidden",
          }}
        >
          {[
            { mode: "cards", Icon: LayoutList },
            { mode: "table", Icon: Table2 },
          ].map(({ mode, Icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              title={mode === "cards" ? "Card view" : "Table view"}
              style={{
                padding: "7px 10px",
                border: "none",
                cursor: "pointer",
                background: viewMode === mode ? t.greenBg : t.surface,
                color: viewMode === mode ? t.green : t.textMuted,
                display: "flex",
                alignItems: "center",
              }}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>

      {/* Transaction list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "50px", color: t.textSub }}>
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            background: t.surface,
            borderRadius: "14px",
            padding: "50px",
            border: `1px solid ${t.border}`,
            textAlign: "center",
          }}
        >
          <p style={{ color: t.textSub }}>
            {search || typeFilter !== "all"
              ? "No matching transactions."
              : "No transactions yet. Add your first one!"}
          </p>
        </div>
      ) : viewMode === "table" ? (
        /* ── TABLE VIEW ─────────────────────────────────────────── */
        <div
          style={{
            background: t.surface,
            borderRadius: "14px",
            border: `1px solid ${t.border}`,
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: t.hover, borderBottom: `1px solid ${t.border}` }}>
                  {["Date", "Merchant / Note", "Category", "Type", "Amount", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        textAlign: h === "Amount" ? "right" : "left",
                        fontWeight: "700",
                        fontSize: "11px",
                        color: t.textSub,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx, idx) => (
                  <tr
                    key={tx._id}
                    style={{
                      borderBottom: idx < filtered.length - 1 ? `1px solid ${t.border}` : "none",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = t.hover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Date */}
                    <td style={{ padding: "10px 14px", color: t.textSub, whiteSpace: "nowrap" }}>
                      {tx.date
                        ? new Date(tx.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>

                    {/* Merchant / Note */}
                    <td style={{ padding: "10px 14px", maxWidth: "220px" }}>
                      <p
                        style={{
                          fontWeight: "600",
                          color: t.text,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          margin: 0,
                        }}
                      >
                        {displayName(tx)}
                      </p>
                      {tx.note && tx.note !== tx.merchant && (
                        <p
                          style={{
                            fontSize: "11px",
                            color: t.textSub,
                            margin: "2px 0 0",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {tx.note.slice(0, 50)}
                        </p>
                      )}
                    </td>

                    {/* Category */}
                    <td style={{ padding: "10px 14px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: "600",
                          padding: "2px 8px",
                          borderRadius: "20px",
                          background: (CAT_COLORS[tx.category] || "#374151") + "22",
                          color: CAT_COLORS[tx.category] || t.textMuted,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tx.category || "Others"}
                      </span>
                    </td>

                    {/* Type */}
                    <td style={{ padding: "10px 14px" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          color: tx.type === "income" ? t.green : t.red,
                          fontSize: "12px",
                          fontWeight: "600",
                        }}
                      >
                        {tx.type === "income" ? (
                          <ArrowUpCircle size={13} />
                        ) : (
                          <ArrowDownCircle size={13} />
                        )}
                        {tx.type === "income" ? "Income" : "Expense"}
                      </div>
                    </td>

                    {/* Amount */}
                    <td
                      style={{
                        padding: "10px 14px",
                        textAlign: "right",
                        fontWeight: "700",
                        fontSize: "14px",
                        color: tx.type === "income" ? t.green : t.red,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tx.type === "income" ? "+" : "-"}{fmt(tx.amount)}
                    </td>

                    {/* Delete */}
                    <td style={{ padding: "10px 10px", textAlign: "center" }}>
                      <button
                        onClick={() => setConfirmDelete(tx._id)}
                        title="Delete"
                        style={{
                          width: "26px",
                          height: "26px",
                          borderRadius: "6px",
                          border: `1px solid ${t.border}`,
                          background: "transparent",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: t.textSub,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#fef2f2";
                          e.currentTarget.style.borderColor = "#fca5a5";
                          e.currentTarget.querySelector("svg").style.color = "#dc2626";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.borderColor = t.border;
                          e.currentTarget.querySelector("svg").style.color = t.textSub;
                        }}
                      >
                        <Trash2 size={12} style={{ color: t.textSub, pointerEvents: "none" }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── CARD VIEW ──────────────────────────────────────────── */
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {filtered.map((tx) => (
            <div
              key={tx._id}
              style={{
                background: t.surface,
                borderRadius: "11px",
                padding: "12px 15px",
                border: `1px solid ${t.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = t.blue)}
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = t.border)
              }
            >
              {/* Left: icon + info */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "11px",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "9px",
                    background: tx.type === "income" ? t.greenBg : t.redBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {tx.type === "income" ? (
                    <ArrowUpCircle size={16} color={t.green} />
                  ) : (
                    <ArrowDownCircle size={16} color={t.red} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      fontWeight: "600",
                      color: t.text,
                      fontSize: "13px",
                      marginBottom: "2px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {displayName(tx)}
                    {tx.note &&
                      tx.merchant !== "Unknown" &&
                      tx.note !== tx.merchant && (
                        <span style={{ fontWeight: "400", color: t.textSub }}>
                          {" "}
                          — {tx.note.slice(0, 40)}
                        </span>
                      )}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: "600",
                        padding: "1px 7px",
                        borderRadius: "20px",
                        background:
                          (CAT_COLORS[tx.category] || "#374151") + "22",
                        color: CAT_COLORS[tx.category] || t.textMuted,
                      }}
                    >
                      {tx.category}
                    </span>
                    {tx.date && (
                      <span style={{ fontSize: "11px", color: t.textSub }}>
                        {new Date(tx.date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: amount + delete button */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  flexShrink: 0,
                }}
              >
                <p
                  style={{
                    fontWeight: "700",
                    fontSize: "14px",
                    color: tx.type === "income" ? t.green : t.red,
                  }}
                >
                  {tx.type === "income" ? "+" : "-"}
                  {fmt(tx.amount)}
                </p>

                {/* DELETE BUTTON */}
                <button
                  onClick={() => setConfirmDelete(tx._id)}
                  title="Delete transaction"
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "7px",
                    border: `1px solid ${t.border}`,
                    background: "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                    transition: "all 0.15s",
                    color: t.textSub,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#fef2f2";
                    e.currentTarget.style.borderColor = "#fca5a5";
                    e.currentTarget.querySelector("svg").style.color =
                      "#dc2626";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = t.border;
                    e.currentTarget.querySelector("svg").style.color =
                      t.textSub;
                  }}
                >
                  <Trash2
                    size={13}
                    style={{ color: t.textSub, pointerEvents: "none" }}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
