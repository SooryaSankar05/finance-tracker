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

  const [smsText, setSmsText] = useState("");
  const [smsAdding, setSmsAdding] = useState(false);
  const [mAmt, setMAmt] = useState("");
  const [mCat, setMCat] = useState("Food");
  const [mNote, setMNote] = useState("");
  const [mType, setMType] = useState("expense");
  const [mDate, setMDate] = useState("");
  const [mAdding, setMAdding] = useState(false);
  const [pdfParsed, setPdfParsed] = useState([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfAdding, setPdfAdding] = useState(false);
  const [pdfMsg, setPdfMsg] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

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

  const handlePdf = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfLoading(true);
    setPdfParsed([]);
    setPdfMsg("");
    try {
      const fileUrl = URL.createObjectURL(file);
      if (!window.pdfjsLib) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          s.onload = res;
          s.onerror = rej;
          document.head.appendChild(s);
        });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
      const pdf = await window.pdfjsLib.getDocument(fileUrl).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((s) => s.str).join(" ") + "\n";
      }
      const lines = fullText
        .split(/[\n\r]+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 5);
      const txnLines = lines.filter(
        (l) =>
          /(?:rs\.?|inr|₹)\s*\d+/i.test(l) ||
          /\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:cr|dr)/i.test(l) ||
          /(?:debited?|credited?|purchase|payment)\b/i.test(l),
      );
      if (!txnLines.length)
        setPdfMsg(
          "No transaction lines found. Try the SMS paste method instead.",
        );
      else {
        setPdfParsed(txnLines.slice(0, 100));
        setPdfMsg(`Found ${txnLines.length} transaction lines.`);
      }
      URL.revokeObjectURL(fileUrl);
    } catch (e) {
      console.error(e);
      setPdfMsg(
        "Could not read PDF. Make sure it's text-based, not a scanned image.",
      );
    } finally {
      setPdfLoading(false);
    }
  };

  const importPdf = async () => {
    if (!pdfParsed.length) return;
    setPdfAdding(true);
    try {
      await API.post("/transactions/bulk", { texts: pdfParsed });
      setPdfParsed([]);
      setPdfMsg("");
      setAddMode(null);
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setPdfAdding(false);
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
              onClick={() => setAddMode(addMode === mode ? null : mode)}
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
                Works with any Indian bank — HDFC, SBI, ICICI, Axis, Kotak, UPI
                etc. Separate multiple SMS with a blank line.
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
              marginBottom: "10px",
            }}
          >
            <div>
              <p style={{ fontSize: "13px", fontWeight: "700", color: t.text }}>
                Upload Bank Statement PDF
              </p>
              <p
                style={{ fontSize: "11px", color: t.textSub, marginTop: "2px" }}
              >
                Text-based PDFs only. Password-protected PDFs are not supported.
              </p>
            </div>
            <button
              onClick={() => {
                setAddMode(null);
                setPdfParsed([]);
                setPdfMsg("");
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
            onChange={handlePdf}
            style={{ display: "none" }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              border: `2px dashed ${t.border}`,
              borderRadius: "10px",
              padding: "18px 20px",
              background: t.hover,
              cursor: "pointer",
              color: t.textMuted,
              fontSize: "13px",
              width: "100%",
              justifyContent: "center",
              marginBottom: "10px",
            }}
          >
            <Upload size={16} />
            {pdfLoading ? "Reading PDF..." : "Click to select PDF file"}
          </button>
          {pdfMsg && (
            <p
              style={{
                fontSize: "12px",
                color: pdfParsed.length > 0 ? t.green : t.red,
                marginBottom: "8px",
              }}
            >
              {pdfMsg}
            </p>
          )}
          {pdfParsed.length > 0 && (
            <>
              <div
                style={{
                  maxHeight: "150px",
                  overflowY: "auto",
                  border: `1px solid ${t.border}`,
                  borderRadius: "8px",
                  padding: "8px",
                  marginBottom: "10px",
                  background: t.bg,
                }}
              >
                {pdfParsed.map((line, i) => (
                  <p
                    key={i}
                    style={{
                      fontSize: "11px",
                      color: t.textSub,
                      marginBottom: "3px",
                      fontFamily: "monospace",
                    }}
                  >
                    {line}
                  </p>
                ))}
              </div>
              <button
                onClick={importPdf}
                disabled={pdfAdding}
                style={{
                  background: pdfAdding ? "#86efac" : t.green,
                  color: "#fff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "9px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: pdfAdding ? "not-allowed" : "pointer",
                }}
              >
                {pdfAdding
                  ? "Importing..."
                  : `Import ${pdfParsed.length} Transactions`}
              </button>
            </>
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
      </div>

      {/* List */}
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
      ) : (
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
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "11px" }}
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
                <div>
                  <p
                    style={{
                      fontWeight: "600",
                      color: t.text,
                      fontSize: "13px",
                      marginBottom: "2px",
                    }}
                  >
                    {displayName(tx)}
                    {tx.note &&
                      tx.merchant !== "Unknown" &&
                      tx.note !== tx.merchant && (
                        <span style={{ fontWeight: "400", color: t.textSub }}>
                          {" "}
                          — {tx.note}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
