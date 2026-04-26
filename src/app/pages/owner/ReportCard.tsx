/**
 * ReportCard — owner's view of walk reports.
 * Loads real reports from KV via GET /reports (ownerreport: prefix).
 * Supports prev/next navigation when multiple reports exist.
 * Owner can rate their walker (1–5 stars) which saves via PUT /owner-rating.
 * Falls back to REPORT_CARD mock data when no KV reports exist.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { W97, W97Button } from "../../components/Win97Window";
import { REPORT_CARD, WALKERS } from "../../data/mockData";
import { useAuth } from "../../context/AuthContext";
import { apiGet, apiPut } from "../../lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface KVReport {
  ts?:         number;
  dogName:     string;
  ownerName:   string;
  walkerName:  string;
  walkerId?:   string;
  mood:        string;
  peeCount:    number;
  poopCount:   number;
  ate:         boolean;
  drank:       boolean;
  energy:      string;
  notes:       string;
  rating:      number;       // walker's rating of owner
  ownerRating?: number;      // owner's rating of walker (editable)
  ownerComment?: string;
  photoCount:  number;
  duration:    string;
  distance:    string;
  submittedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }); }
  catch { return iso; }
}

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

const MOOD_MAP: Record<string, string> = {
  "😄": "Super Happy", "😊": "Happy", "😐": "Neutral", "😴": "Tired", "😰": "Anxious",
};

// ── Component ──────────────────────────────────────────────────────────────

export function ReportCard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── KV report data ───────────────────────────────────────────────────
  const [kvReports, setKvReports] = useState<KVReport[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [idx,       setIdx]       = useState(0);   // which report is shown

  // ── Owner rating ─────────────────────────────────────────────────────
  const [ownerRating,   setOwnerRating]   = useState(0);
  const [ownerComment,  setOwnerComment]  = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingSaving,    setRatingSaving]    = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────
  const [tipSent,  setTipSent]  = useState(false);
  const [printing, setPrinting] = useState(false);

  // Load reports from KV
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await apiGet<{ reports: KVReport[] }>("/reports");
        if (!cancelled) {
          setKvReports(data.reports ?? []);
        }
      } catch (e) { console.log("Report load error:", e); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // When switching reports, reset rating state
  const currentReport = kvReports[idx] ?? null;
  useEffect(() => {
    if (currentReport) {
      setOwnerRating(currentReport.ownerRating ?? 0);
      setOwnerComment(currentReport.ownerComment ?? "");
      setRatingSubmitted(!!currentReport.ownerRating);
    }
  }, [idx, kvReports.length]);

  // Decide which data to render — real KV or mock fallback
  const useKV = !loading && kvReports.length > 0;

  // Build a normalized display object from either source
  const rc = useKV && currentReport ? {
    dog:         currentReport.dogName,
    walker:      currentReport.walkerName,
    walkerAvatar:WALKERS[0].avatar, // no avatar in KV yet
    date:        fmtDate(currentReport.submittedAt),
    startTime:   fmtTime(currentReport.submittedAt),
    endTime:     "",
    duration:    currentReport.duration ?? "—",
    distance:    currentReport.distance ?? "—",
    mood:        `${currentReport.mood} ${MOOD_MAP[currentReport.mood] ?? ""}`,
    energy:      currentReport.energy ?? "—",
    ate:         currentReport.ate,
    drank:       currentReport.drank,
    notes:       currentReport.notes ?? "",
    photos:      [] as string[],
    pottyBreaks: { pee: currentReport.peeCount ?? 0, poop: currentReport.poopCount ?? 0 },
    ts:          currentReport.ts,
  } : {
    dog:         REPORT_CARD.dog,
    walker:      REPORT_CARD.walker,
    walkerAvatar:WALKERS[0].avatar,
    date:        REPORT_CARD.date,
    startTime:   REPORT_CARD.startTime,
    endTime:     REPORT_CARD.endTime,
    duration:    REPORT_CARD.duration,
    distance:    REPORT_CARD.distance,
    mood:        REPORT_CARD.mood,
    energy:      "High",
    ate:         REPORT_CARD.ate,
    drank:       REPORT_CARD.drank,
    notes:       REPORT_CARD.notes,
    photos:      REPORT_CARD.photos,
    pottyBreaks: REPORT_CARD.pottyBreaks,
    ts:          undefined as number | undefined,
  };

  const walkerFirstName = rc.walker.split(" ")[0];

  // ── Submit owner rating ───────────────────────────────────────────────
  async function submitRating() {
    if (!ownerRating || !rc.ts) return;
    setRatingSaving(true);
    try {
      await apiPut("/owner-rating", { ts: rc.ts, ownerRating, comment: ownerComment });
      // Update local state
      setKvReports(prev => prev.map((r, i) =>
        i === idx ? { ...r, ownerRating, ownerComment } : r
      ));
      setRatingSubmitted(true);
    } catch (e) { console.log("Rating save:", e); }
    finally { setRatingSaving(false); }
  }

  // ── Print ─────────────────────────────────────────────────────────────
  function handlePrint() {
    setPrinting(true);
    setTimeout(() => { setPrinting(false); window.print(); }, 300);
  }

  // ── Share ─────────────────────────────────────────────────────────────
  function handleShare() {
    const text = `Walk Report for ${rc.dog} by ${rc.walker} — ${rc.date}\n\n${rc.notes}`;
    if (navigator.share) {
      navigator.share({ title: `Walk Report — ${rc.dog}`, text });
    } else {
      navigator.clipboard?.writeText(text);
      alert("Report copied to clipboard!");
    }
  }

  return (
    <div className="h-full flex flex-col" style={{ background: W97.gray, fontFamily: W97.font, color: "#000", position: "relative" }}>

      {/* Title Bar */}
      <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, minHeight: 22, userSelect: "none", flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>📋</span>
        <span style={{ flex: 1, fontWeight: "bold", fontSize: 12 }}>
          Walk Report — {rc.dog} — {rc.date}
          {kvReports.length > 1 && ` (${idx + 1} of ${kvReports.length})`}
        </span>
        <div style={{ display: "flex", gap: 2 }}>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>_</button>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>□</button>
          <button className="w97-titlebar-btn" style={{ ...W97.titlebarBtnStyle, fontWeight: "bold" }} onClick={() => navigate("/owner")}>✕</button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ background: W97.gray, borderBottom: `1px solid ${W97.grayDark}`, padding: "3px 4px", display: "flex", gap: 3, flexShrink: 0 }}>
        <W97Button small onClick={handlePrint}>{printing ? "⏳ Printing…" : "🖨️ Print"}</W97Button>
        <W97Button small onClick={handleShare}>📤 Share</W97Button>
        {kvReports.length > 1 && (
          <>
            <div style={{ width: 1, height: 18, background: "#808080", margin: "0 2px" }} />
            <W97Button small onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>◀ Prev</W97Button>
            <W97Button small onClick={() => setIdx(i => Math.min(kvReports.length - 1, i + 1))} disabled={idx === kvReports.length - 1}>Next ▶</W97Button>
          </>
        )}
        <div style={{ flex: 1 }} />
        {!useKV && (
          <span style={{ fontSize: 10, color: "#808080", alignSelf: "center", fontStyle: "italic" }}>Demo data</span>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <div className="w97-progress-track" style={{ width: 200 }}>
            <div className="w97-progress-fill" style={{ width: "60%" }} />
          </div>
          <p style={{ fontFamily: "VT323, monospace", fontSize: 14 }}>Loading report cards…</p>
        </div>
      )}

      {/* No reports yet */}
      {!loading && !useKV && (
        <div style={{ background: "#000080", color: "#FFF", padding: "3px 8px", fontSize: 11, flexShrink: 0 }}>
          ℹ️ Showing demo report — real reports appear here after your first walk
        </div>
      )}

      {/* Document area */}
      {!loading && (
        <div className="flex-1 overflow-y-auto w97-scroll" style={{ background: "#A0A0A0", padding: 8 }}>
          <div style={{ background: "#FFF", margin: "0 auto", maxWidth: 380, padding: "16px 14px", boxShadow: "2px 2px 4px rgba(0,0,0,0.4)" }}>

            {/* Document header */}
            <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 10 }}>
              <p style={{ fontFamily: "VT323, monospace", fontSize: 26, color: "#000080", lineHeight: 1 }}>SIT-HERE DOG WALKING</p>
              <p style={{ fontSize: 11, color: W97.grayDark }}>Official Walk Report Card</p>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11 }}>
                <span>Walker: <strong>{rc.walker}</strong></span>
                <span>Date: <strong>{rc.date}</strong></span>
              </div>
            </div>

            {/* Walker + Dog row */}
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <img src={rc.walkerAvatar} alt={rc.walker} style={{ width: 48, height: 48, objectFit: "cover", ...W97.raised }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: "bold", fontSize: 13 }}>{rc.walker} walked {rc.dog}</p>
                <p style={{ fontSize: 11 }}>Drop-in Walk · {rc.startTime}{rc.endTime ? ` — ${rc.endTime}` : ""}</p>
                <p style={{ fontFamily: "VT323, monospace", fontSize: 18, color: "#000080" }}>
                  {"⭐".repeat(Math.round(ownerRating || 5))}{ownerRating ? "" : "⭐⭐⭐⭐⭐"}
                </p>
              </div>
            </div>

            {/* Stats table */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10, fontSize: 12 }}>
              <tbody>
                {[
                  ["⏱️ Duration", rc.duration,              "📍 Distance",  rc.distance],
                  ["🕐 Start",    rc.startTime,              "⚡ Energy",    rc.energy],
                  ["😊 Mood",     rc.mood,                   "📷 Photos",    `${rc.photos.length > 0 ? rc.photos.length : useKV && currentReport ? currentReport.photoCount : 3}`],
                  ["🍖 Ate",      rc.ate ? "Yes ✓" : "No",  "💧 Drank",    rc.drank ? "Yes ✓" : "No"],
                ].map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#DFDFDF" : "#FFF" }}>
                    <td style={{ fontWeight: "bold", padding: "3px 6px", width: "25%", borderRight: "1px solid #C0C0C0" }}>{row[0]}</td>
                    <td style={{ padding: "3px 6px", width: "25%", borderRight: "1px solid #C0C0C0" }}>{row[1]}</td>
                    <td style={{ fontWeight: "bold", padding: "3px 6px", width: "25%", borderRight: "1px solid #C0C0C0" }}>{row[2]}</td>
                    <td style={{ padding: "3px 6px", width: "25%" }}>{row[3]}</td>
                  </tr>
                ))}
                <tr style={{ background: "#DFDFDF" }}>
                  <td style={{ fontWeight: "bold", padding: "3px 6px", borderRight: "1px solid #C0C0C0" }}>💧 Pee</td>
                  <td style={{ padding: "3px 6px", borderRight: "1px solid #C0C0C0" }}>{rc.pottyBreaks.pee}x</td>
                  <td style={{ fontWeight: "bold", padding: "3px 6px", borderRight: "1px solid #C0C0C0" }}>💩 Poop</td>
                  <td style={{ padding: "3px 6px" }}>{rc.pottyBreaks.poop}x</td>
                </tr>
              </tbody>
            </table>

            {/* Walker Notes */}
            {rc.notes && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontWeight: "bold", fontSize: 12, marginBottom: 4, borderBottom: "1px solid #000", paddingBottom: 2 }}>
                  Walker Notes from {walkerFirstName}:
                </p>
                <div style={{ ...W97.sunken, padding: "6px 8px", lineHeight: 1.5, fontFamily: "VT323, monospace", fontSize: 14 }}>
                  {rc.notes}
                </div>
              </div>
            )}

            {/* Photos */}
            {rc.photos.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontWeight: "bold", fontSize: 12, marginBottom: 4, borderBottom: "1px solid #000", paddingBottom: 2 }}>
                  📸 Walk Photos ({rc.photos.length}):
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  {rc.photos.map((p, i) => (
                    <img key={i} src={p} alt={`Walk photo ${i + 1}`} style={{ flex: 1, height: 80, objectFit: "cover", ...W97.raised }} />
                  ))}
                </div>
              </div>
            )}

            {/* Owner rates walker */}
            <div style={{ marginBottom: 10, borderTop: "1px solid #C0C0C0", paddingTop: 8 }}>
              <p style={{ fontWeight: "bold", fontSize: 12, marginBottom: 6 }}>
                ⭐ Rate {walkerFirstName}'s walk:
              </p>
              {ratingSubmitted ? (
                <div style={{ ...W97.sunken, padding: "6px 8px", textAlign: "center" }}>
                  <p style={{ fontFamily: "VT323, monospace", fontSize: 20, color: "#000080" }}>
                    {"⭐".repeat(ownerRating)} {ownerRating}/5
                  </p>
                  {ownerComment && (
                    <p style={{ fontSize: 11, color: W97.grayDark, marginTop: 4, fontStyle: "italic" }}>"{ownerComment}"</p>
                  )}
                  <p style={{ fontSize: 10, color: "#006400", marginTop: 4 }}>✓ Rating submitted</p>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <button key={s} className="w97-btn" onClick={() => setOwnerRating(s)}
                        style={{ flex: 1, fontSize: 20, padding: "4px", background: s <= ownerRating ? "#000080" : W97.gray, color: s <= ownerRating ? "#FFF" : "#000" }}>
                        ⭐
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="w97-input"
                    value={ownerComment}
                    onChange={e => setOwnerComment(e.target.value)}
                    placeholder={`Optional: leave a note for ${walkerFirstName}…`}
                    rows={2}
                    style={{ width: "100%", resize: "none", fontFamily: W97.font, fontSize: 11, marginBottom: 6 }}
                  />
                  <W97Button
                    isDefault
                    onClick={submitRating}
                    disabled={!ownerRating || ratingSaving || !rc.ts}
                    style={{ width: "100%", fontWeight: "bold" }}
                  >
                    {ratingSaving ? "⏳ Saving…" : !rc.ts ? "⭐ Rate (demo only)" : `⭐ Submit ${ownerRating || "?"}/5 Rating`}
                  </W97Button>
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ borderTop: "1px solid #000", paddingTop: 6, color: W97.grayDark, textAlign: "center", fontFamily: "VT323, monospace", fontSize: 12 }}>
              Generated by Sit-Here v1.0 · sit-here.exe · {rc.date}
            </div>
          </div>
        </div>
      )}

      {/* Tip dialog */}
      {tipSent && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ ...W97.raised, width: 260, boxShadow: "3px 3px 0 #000" }}>
            <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, minHeight: 22 }}>
              <span>💰</span>
              <span style={{ fontWeight: "bold", fontSize: 12, flex: 1 }}>Tip Sent!</span>
              <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle} onClick={() => setTipSent(false)}>✕</button>
            </div>
            <div style={{ padding: "14px 16px", textAlign: "center", background: W97.gray }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
              <p style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>$5.00 tip sent to {walkerFirstName}!</p>
              <p style={{ fontSize: 11, color: "#000080", marginBottom: 12 }}>They'll be thrilled — {rc.dog} says thanks too 🐾</p>
              <W97Button isDefault onClick={() => setTipSent(false)} style={{ width: "100%" }}>OK</W97Button>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "5px 8px", display: "flex", justifyContent: "flex-end", gap: 5, flexShrink: 0 }}>
        <W97Button isDefault onClick={() => setTipSent(true)}>
          💰 Tip {walkerFirstName}
        </W97Button>
        <W97Button onClick={() => navigate("/owner/chat")}>💬 Chat</W97Button>
        <W97Button onClick={() => navigate("/owner")}>Close</W97Button>
      </div>

      {/* Status bar */}
      <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "2px 4px", display: "flex", flexShrink: 0, minHeight: 20 }}>
        <span style={{ ...W97.inset, padding: "0 6px", flex: 1, fontSize: 11, lineHeight: "16px" }}>
          {loading ? "Loading…" : useKV
            ? `${kvReports.length} real report${kvReports.length !== 1 ? "s" : ""} · Showing ${idx + 1} of ${kvReports.length}`
            : `Demo report · Book a real walk to see live data`}
        </span>
      </div>
    </div>
  );
}
