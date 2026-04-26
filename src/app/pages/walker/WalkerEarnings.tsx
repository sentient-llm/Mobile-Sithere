import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { W97, W97Button } from "../../components/Win97Window";
import { useAuth } from "../../context/AuthContext";
import { apiGet } from "../../lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface WalkRecord {
  dogName:     string;
  ownerName:   string;
  submittedAt: string;
  duration:    string;
  distance:    string;
  mood:        string;
  rating:      number;
  earnings:    number;
  notes?:      string;
}

interface Stats {
  rate:          number;
  totalWalks:    number;
  totalEarnings: number;
  avgRating:     number;
  today:         { walks: number; earnings: number };
  week:          { walks: number; earnings: number };
  month:         { walks: number; earnings: number };
  recentWalks:   WalkRecord[];
}

type Tab = "overview" | "history";

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  } catch { return iso; }
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ fontFamily: "VT323, monospace", fontSize: 14, color: rating >= 4 ? "#000080" : "#808080" }}>
      {"⭐".repeat(Math.round(rating || 0))}{"☆".repeat(Math.max(0, 5 - Math.round(rating || 0)))}
    </span>
  );
}

// Sparkline‑style bar for the weekly chart
function MiniBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{ width: "100%", height: 40, ...W97.sunken, position: "relative", background: "#FFF" }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#000080", height: `${pct}%`, transition: "height 0.4s" }} />
      </div>
      <span style={{ fontSize: 9, color: W97.grayDark, textAlign: "center", lineHeight: "11px" }}>{label}</span>
      <span style={{ fontFamily: "VT323, monospace", fontSize: 13, color: "#000080" }}>${value}</span>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function WalkerEarnings() {
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const [tab,      setTab]    = useState<Tab>("overview");
  const [stats,    setStats]  = useState<Stats | null>(null);
  const [loading,  setLoading]= useState(true);
  const [error,    setError]  = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const data = await apiGet<{ stats: Stats }>("/walker-stats");
        if (!cancelled) setStats(data.stats);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Failed to load earnings");
        console.error("Earnings load:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Demo data when no real walks yet ─────────────────────────────────
  const demoStats: Stats = {
    rate:          22,
    totalWalks:    0,
    totalEarnings: 0,
    avgRating:     0,
    today:         { walks: 0, earnings: 0 },
    week:          { walks: 0, earnings: 0 },
    month:         { walks: 0, earnings: 0 },
    recentWalks:   [],
  };
  const s = stats ?? demoStats;
  const hasData = s.totalWalks > 0;

  // ── 7-day bar chart data (last 7 days) ────────────────────────────────
  const barDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString([], { weekday: "short" });
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd   = dayStart + 86400000;
    const walks    = s.recentWalks.filter(w => {
      const t = new Date(w.submittedAt).getTime();
      return t >= dayStart && t < dayEnd;
    });
    return { label, earnings: walks.reduce((sum, w) => sum + (w.earnings ?? s.rate), 0) };
  });
  const maxEarnings = Math.max(...barDays.map(d => d.earnings), 1);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "📊 Overview" },
    { id: "history",  label: "📋 Walk History" },
  ];

  return (
    <div className="h-full flex flex-col" style={{ background: W97.gray, fontFamily: W97.font, color: "#000" }}>

      {/* Title Bar */}
      <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, minHeight: 22, userSelect: "none", flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>💰</span>
        <span style={{ flex: 1, fontWeight: "bold", fontSize: 12 }}>
          Earnings Ledger — {user?.name ?? "Walker"}
        </span>
        <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>_</button>
        <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>□</button>
        <button className="w97-titlebar-btn" style={{ ...W97.titlebarBtnStyle, fontWeight: "bold" }} onClick={() => navigate("/walker")}>✕</button>
      </div>

      {/* Menu bar */}
      <div style={{ background: W97.gray, borderBottom: `1px solid ${W97.grayDark}`, display: "flex", padding: "1px 2px", flexShrink: 0, minHeight: 20 }}>
        {["File", "View", "Export", "Help"].map(item => (
          <span key={item} className="w97-menuitem" style={{ padding: "2px 6px", fontSize: 11 }}>
            <u>{item[0]}</u>{item.slice(1)}
          </span>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ background: W97.gray, borderBottom: `1px solid ${W97.grayDark}`, display: "flex", padding: "3px 4px 0", gap: 2, flexShrink: 0 }}>
        {tabs.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{
            padding:           "3px 10px",
            fontSize:          11,
            fontWeight:        tab === t.id ? "bold" : "normal",
            background:        tab === t.id ? W97.gray : "#A0A0A0",
            border:            "2px solid",
            borderTopColor:    tab === t.id ? "#FFF" : "#808080",
            borderLeftColor:   tab === t.id ? "#FFF" : "#808080",
            borderBottomColor: tab === t.id ? W97.gray : "#404040",
            borderRightColor:  tab === t.id ? "#808080" : "#404040",
            marginBottom:      tab === t.id ? -2 : 0,
            cursor:            "default",
          }}>{t.label}</div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto w97-scroll" style={{ padding: "8px" }}>

        {/* Loading / error states */}
        {loading && (
          <div style={{ padding: 20, textAlign: "center" }}>
            <div className="w97-progress-track" style={{ width: 200, margin: "0 auto 8px" }}>
              <div className="w97-progress-fill" style={{ width: "60%" }} />
            </div>
            <p style={{ fontFamily: "VT323, monospace", fontSize: 14 }}>Loading earnings data...</p>
          </div>
        )}
        {error && !loading && (
          <div style={{ ...W97.raised, padding: "8px 10px", marginBottom: 8, background: "#FFFFC0", display: "flex", gap: 8 }}>
            <span>⚠️</span>
            <div>
              <p style={{ fontWeight: "bold", fontSize: 12 }}>Load Error</p>
              <p style={{ fontSize: 11, color: "#800000" }}>{error}</p>
            </div>
            <W97Button small onClick={() => window.location.reload()}>Retry</W97Button>
          </div>
        )}

        {!loading && tab === "overview" && (
          <>
            {/* All-time hero stat */}
            <div style={{ ...W97.raised, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 36 }}>💰</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: W97.grayDark }}>All-time total earnings</p>
                <p style={{ fontFamily: "VT323, monospace", fontSize: 36, color: "#000080", lineHeight: 1 }}>
                  ${s.totalEarnings.toLocaleString()}
                </p>
                <p style={{ fontSize: 11 }}>
                  {s.totalWalks} walk{s.totalWalks !== 1 ? "s" : ""} · ${s.rate}/walk
                  {s.avgRating > 0 && ` · ⭐ ${s.avgRating.toFixed(1)} avg`}
                </p>
              </div>
              {!hasData && (
                <div style={{ ...W97.sunken, padding: "4px 8px", fontSize: 10, color: "#808080", textAlign: "center" }}>
                  Complete walks<br />to see real data
                </div>
              )}
            </div>

            {/* Period breakdown */}
            <fieldset style={{ border: "2px solid", borderTopColor: "#808080", borderLeftColor: "#808080", borderBottomColor: "#FFF", borderRightColor: "#FFF", padding: "8px", marginBottom: 8 }}>
              <legend style={{ fontWeight: "bold", fontSize: 11, padding: "0 4px" }}>Period Summary</legend>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
                {[
                  { label: "Today",  data: s.today  },
                  { label: "Week",   data: s.week   },
                  { label: "Month",  data: s.month  },
                ].map(({ label, data }) => (
                  <div key={label} style={{ ...W97.sunken, padding: "8px 6px", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: W97.grayDark, marginBottom: 3 }}>{label}</div>
                    <div style={{ fontFamily: "VT323, monospace", fontSize: 24, color: "#000080", lineHeight: 1 }}>
                      ${data.earnings}
                    </div>
                    <div style={{ fontSize: 10, marginTop: 3 }}>
                      {data.walks} walk{data.walks !== 1 ? "s" : ""}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>

            {/* 7-day bar chart */}
            <fieldset style={{ border: "2px solid", borderTopColor: "#808080", borderLeftColor: "#808080", borderBottomColor: "#FFF", borderRightColor: "#FFF", padding: "8px", marginBottom: 8 }}>
              <legend style={{ fontWeight: "bold", fontSize: 11, padding: "0 4px" }}>Last 7 Days</legend>
              <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
                {barDays.map(d => (
                  <MiniBar key={d.label} value={d.earnings} max={maxEarnings} label={d.label} />
                ))}
              </div>
              {!hasData && (
                <p style={{ fontSize: 10, color: W97.grayDark, textAlign: "center", marginTop: 6 }}>
                  Complete walks to see your earnings chart
                </p>
              )}
            </fieldset>

            {/* Stats table */}
            <fieldset style={{ border: "2px solid", borderTopColor: "#808080", borderLeftColor: "#808080", borderBottomColor: "#FFF", borderRightColor: "#FFF", padding: "8px", marginBottom: 8 }}>
              <legend style={{ fontWeight: "bold", fontSize: 11, padding: "0 4px" }}>Performance Stats</legend>
              <div style={{ ...W97.sunken, background: "#FFF" }}>
                {[
                  ["🐾 Total Walks",      String(s.totalWalks)],
                  ["💵 Rate per Walk",    `$${s.rate}`],
                  ["⭐ Average Rating",   s.avgRating > 0 ? `${s.avgRating.toFixed(1)} / 5.0` : "No ratings yet"],
                  ["💰 All-time Earned",  `$${s.totalEarnings.toLocaleString()}`],
                  ["📅 This Week",        `$${s.week.earnings} (${s.week.walks} walks)`],
                  ["📆 This Month",       `$${s.month.earnings} (${s.month.walks} walks)`],
                ].map(([label, val], i) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", fontSize: 12, background: i % 2 === 0 ? "#FFF" : "#DFDFDF", borderBottom: i < 5 ? "1px solid #C0C0C0" : "none" }}>
                    <span>{label}</span>
                    <span style={{ fontWeight: "bold", color: "#000080" }}>{val}</span>
                  </div>
                ))}
              </div>
            </fieldset>

            {/* Rate editor hint */}
            <div style={{ ...W97.raised, padding: "6px 10px", display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 16 }}>💡</span>
              <p style={{ fontSize: 11, flex: 1 }}>
                Your rate is <strong>${s.rate}/walk</strong>. Update it in your{" "}
                <span style={{ color: "#000080", cursor: "default", textDecoration: "underline" }} onClick={() => navigate("/profile")}>
                  Profile → Walker Bio
                </span>.
              </p>
            </div>
          </>
        )}

        {!loading && tab === "history" && (
          <>
            {/* Column headers */}
            <div style={{ ...W97.raised, display: "grid", gridTemplateColumns: "80px 1fr 1fr 50px 50px 60px", gap: 0, marginBottom: 2 }}>
              {["Date", "Dog", "Owner", "Dur.", "Dist.", "$"].map(h => (
                <div key={h} style={{ padding: "3px 6px", fontWeight: "bold", fontSize: 11, borderRight: `1px solid ${W97.grayDark}` }}>
                  {h}
                </div>
              ))}
            </div>

            {/* Walk rows */}
            {s.recentWalks.length > 0 ? (
              <div style={{ ...W97.sunken, background: "#FFF" }}>
                {s.recentWalks.map((w, i) => (
                  <div key={i} style={{
                    display:       "grid",
                    gridTemplateColumns: "80px 1fr 1fr 50px 50px 60px",
                    background:    i % 2 === 0 ? "#FFF" : "#DFDFDF",
                    borderBottom:  i < s.recentWalks.length - 1 ? "1px solid #C0C0C0" : "none",
                    fontSize:      11,
                  }}>
                    <div style={{ padding: "4px 6px", borderRight: "1px solid #C0C0C0" }}>
                      <div>{fmtDate(w.submittedAt)}</div>
                      <div style={{ fontSize: 9, color: W97.grayDark }}>{fmtTime(w.submittedAt)}</div>
                    </div>
                    <div style={{ padding: "4px 6px", borderRight: "1px solid #C0C0C0" }}>
                      <div style={{ fontWeight: "bold" }}>{w.dogName}</div>
                      <div style={{ fontSize: 9 }}>{w.mood}</div>
                    </div>
                    <div style={{ padding: "4px 6px", borderRight: "1px solid #C0C0C0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {w.ownerName}
                    </div>
                    <div style={{ padding: "4px 6px", borderRight: "1px solid #C0C0C0", color: W97.grayDark }}>{w.duration}</div>
                    <div style={{ padding: "4px 6px", borderRight: "1px solid #C0C0C0", color: W97.grayDark }}>{w.distance}</div>
                    <div style={{ padding: "4px 6px", fontWeight: "bold", color: "#006400", fontFamily: "VT323, monospace", fontSize: 15 }}>
                      +${w.earnings ?? s.rate}
                    </div>
                  </div>
                ))}
                {/* Totals row */}
                <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 50px 50px 60px", background: "#C0C0C0", borderTop: "2px solid #808080" }}>
                  <div style={{ padding: "4px 6px", fontWeight: "bold", fontSize: 11, gridColumn: "1 / 6", borderRight: "1px solid #808080" }}>
                    TOTAL ({s.recentWalks.length} walks shown)
                  </div>
                  <div style={{ padding: "4px 6px", fontWeight: "bold", color: "#006400", fontFamily: "VT323, monospace", fontSize: 15 }}>
                    ${s.recentWalks.reduce((sum, w) => sum + (w.earnings ?? s.rate), 0)}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ ...W97.sunken, padding: "20px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                <p style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>No Walk History Yet</p>
                <p style={{ fontSize: 11, color: W97.grayDark, marginBottom: 10 }}>
                  Complete walks and submit report cards to see your history here.
                </p>
                <W97Button isDefault onClick={() => navigate("/walker/live-walk")}>
                  ▶ Start a Walk
                </W97Button>
              </div>
            )}
          </>
        )}

        <div style={{ height: 6 }} />
      </div>

      {/* Status bar */}
      <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "2px 4px", display: "flex", gap: 4, flexShrink: 0, minHeight: 20 }}>
        <span style={{ ...W97.inset, padding: "0 6px", flex: 1, fontSize: 11, lineHeight: "16px" }}>
          {loading ? "Loading…" : hasData ? `${s.totalWalks} walks · $${s.totalEarnings} earned · $${s.rate}/walk` : "No walks yet — complete a walk to start earning"}
        </span>
        <span style={{ ...W97.inset, padding: "0 6px", fontSize: 11, lineHeight: "16px" }}>
          Earnings.exe
        </span>
      </div>
    </div>
  );
}
