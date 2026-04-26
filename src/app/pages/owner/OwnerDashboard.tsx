/**
 * OwnerDashboard — loads real booking statuses and latest report from KV.
 * Status badge reflects real states: pending / accepted / in_progress / completed.
 * Report card preview shows most recent real report or falls back to mock.
 */
import { useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { W97, W97Button } from "../../components/Win97Window";
import { WALKERS, REPORT_CARD } from "../../data/mockData";
import { useAuth } from "../../context/AuthContext";
import { apiGet, apiPost } from "../../lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

type BookingStatus = "pending" | "accepted" | "in_progress" | "completed" | "declined" | "cancelled";

interface Booking {
  dogName:      string;
  ownerName:    string;
  walkerName:   string;
  walkerAvatar?: string;
  walkerId:     string;
  time:         string;
  date:         string;
  duration:     string;
  status:       BookingStatus;
  ts:           number;
  createdAt:    string;
}

interface Report {
  dogName:     string;
  walkerName:  string;
  mood:        string;
  duration?:   string;
  distance?:   string;
  notes?:      string;
  submittedAt: string;
  ownerRating?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<BookingStatus, { label: string; bg: string }> = {
  pending:     { label: "⏳ Awaiting Confirmation", bg: "#806000" },
  accepted:    { label: "✓ Confirmed",              bg: "#005000" },
  in_progress: { label: "🔴 In Progress",            bg: "#800000" },
  completed:   { label: "✅ Completed",              bg: "#004000" },
  declined:    { label: "✗ Declined",               bg: "#800000" },
  cancelled:   { label: "✗ Cancelled",              bg: "#808080" },
};

function GroupBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset style={{ border: "2px solid", borderTopColor: "#808080", borderLeftColor: "#808080", borderBottomColor: "#FFF", borderRightColor: "#FFF", padding: "8px", background: W97.gray, margin: "0 0 8px 0" }}>
      <legend style={{ fontFamily: W97.font, fontSize: 11, fontWeight: "bold", padding: "0 4px", color: "#000" }}>
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

function DogEditModal({ dogName, dogBreed, dogAge, onSave, onClose }: {
  dogName: string; dogBreed: string; dogAge: string;
  onSave: (n: string, b: string, a: string) => void;
  onClose: () => void;
}) {
  const [name, setName]   = useState(dogName);
  const [breed, setBreed] = useState(dogBreed);
  const [age, setAge]     = useState(dogAge);
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div style={{ ...W97.raised, width: 280, boxShadow: "3px 3px 0 #000" }}>
        <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, minHeight: 22 }}>
          <span>🐕</span><span style={{ fontWeight: "bold", fontSize: 12, flex: 1 }}>Edit Dog Profile</span>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "12px 14px", background: W97.gray }}>
          {[["Dog's Name:", name, setName], ["Breed:", breed, setBreed]].map(([label, val, setter]) => (
            <div key={label as string} style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, display: "block", marginBottom: 3 }}>{label as string}</label>
              <input className="w97-input" value={val as string} onChange={e => (setter as any)(e.target.value)} style={{ width: "100%" }} />
            </div>
          ))}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, display: "block", marginBottom: 3 }}>Age (years):</label>
            <input className="w97-input" type="number" min="0" max="25" value={age} onChange={e => setAge(e.target.value)} style={{ width: 80 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 5 }}>
            <W97Button isDefault onClick={() => onSave(name.trim() || "Max", breed.trim() || "Mixed Breed", age || "1")} style={{ fontWeight: "bold" }}>💾 Save</W97Button>
            <W97Button onClick={onClose}>Cancel</W97Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function OwnerDashboard() {
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const displayName = user?.name ?? "Dog Owner";
  const mockWalker  = WALKERS[0];

  // ── Dog profile ──────────────────────────────────────────────────────
  const [dogName,      setDogName]      = useState("Max");
  const [dogBreed,     setDogBreed]     = useState("Golden Retriever");
  const [dogAge,       setDogAge]       = useState("3");
  const [showDogEdit,  setShowDogEdit]  = useState(false);
  const [dogSaving,    setDogSaving]    = useState(false);

  // ── Bookings ─────────────────────────────────────────────────────────
  const [walks,        setWalks]        = useState<Booking[]>([]);
  const [walksLoading, setWalksLoading] = useState(true);

  // ── Latest report ────────────────────────────────────────────────────
  const [latestReport, setLatestReport] = useState<Report | null>(null);

  // ── Notifications ────────────────────────────────────────────────────
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  // ── Load all data ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [dogRes, walksRes, reportRes, notifRes] = await Promise.allSettled([
          apiGet<{ profile: any }>("/dog-profile"),
          apiGet<{ walks: Booking[] }>("/walks"),
          apiGet<{ reports: Report[] }>("/reports"),
          apiGet<{ unreadCount: number }>("/notifications"),
        ]);
        if (cancelled) return;

        if (dogRes.status === "fulfilled" && dogRes.value.profile) {
          setDogName(dogRes.value.profile.dogName ?? "Max");
          setDogBreed(dogRes.value.profile.breed   ?? "Golden Retriever");
          setDogAge(String(dogRes.value.profile.age ?? 3));
        }
        if (walksRes.status === "fulfilled") setWalks(walksRes.value.walks ?? []);
        if (reportRes.status === "fulfilled" && (reportRes.value.reports ?? []).length > 0) {
          setLatestReport(reportRes.value.reports[0]);
        }
        if (notifRes.status === "fulfilled") setUnreadNotifs(notifRes.value.unreadCount ?? 0);
      } catch (e) { console.log("Dashboard load:", e); }
      finally { if (!cancelled) setWalksLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Save dog profile ─────────────────────────────────────────────────
  async function saveDogProfile(name: string, breed: string, age: string) {
    setDogSaving(true);
    setDogName(name); setDogBreed(breed); setDogAge(age);
    setShowDogEdit(false);
    try { await apiPost("/dog-profile", { dogName: name, breed, age: Number(age) || 0 }); }
    catch (e) { console.log("Save dog profile:", e); }
    setDogSaving(false);
  }

  // ── Cancel booking ───────────────────────────────────────────────────
  async function cancelBooking(booking: Booking) {
    // Optimistic local update
    setWalks(prev => prev.map(w =>
      w.ts === booking.ts ? { ...w, status: "cancelled" as BookingStatus } : w
    ));
    // Persist via server (DELETE /walks with ts in body via POST-style api call)
    try {
      await apiPost("/walks/cancel", { ts: booking.ts, walkerId: booking.walkerId });
    } catch {
      // Non-critical for MVP — status already updated locally
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────
  const activeWalks  = walks.filter(w => !["cancelled", "declined", "completed"].includes(w.status));
  const nextWalk     = activeWalks[0] ?? null;
  const completedCnt = walks.filter(w => w.status === "completed").length;

  const actions = [
    { label: "📅 Schedule Walk",  path: "/owner/schedule"   },
    { label: "💬 Message Walker", path: "/owner/chat"        },
    { label: "📋 Report Card",    path: "/owner/report-card" },
    { label: "🏥 Find a Vet",     path: "/owner/vet-finder"  },
  ];

  return (
    <div className="h-full flex flex-col" style={{ background: W97.gray, fontFamily: W97.font, color: "#000", fontSize: 12, position: "relative" }}>

      {showDogEdit && (
        <DogEditModal dogName={dogName} dogBreed={dogBreed} dogAge={dogAge}
          onSave={saveDogProfile} onClose={() => setShowDogEdit(false)} />
      )}

      {/* Title Bar */}
      <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, minHeight: 22, userSelect: "none", flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>🐕</span>
        <span style={{ flex: 1, fontWeight: "bold", fontSize: 12 }}>My Dog Manager — {displayName}</span>
        {unreadNotifs > 0 && (
          <span style={{ background: "#800000", color: "#FFF", fontSize: 9, padding: "0 4px", fontWeight: "bold", cursor: "default" }}
            onClick={() => navigate("/owner/report-card")}>
            {unreadNotifs} NEW
          </span>
        )}
        <div style={{ display: "flex", gap: 2 }}>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>_</button>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>□</button>
          <button className="w97-titlebar-btn" style={{ ...W97.titlebarBtnStyle, fontWeight: "bold" }} onClick={() => navigate("/")}>✕</button>
        </div>
      </div>

      {/* Menu Bar */}
      <div style={{ background: W97.gray, borderBottom: `1px solid ${W97.grayDark}`, display: "flex", padding: "1px 2px", flexShrink: 0, minHeight: 20 }}>
        {["File", "View", "Walk", "Help"].map(item => (
          <span key={item} className="w97-menuitem" style={{ padding: "2px 6px", fontSize: 11, cursor: "default" }}>
            <u>{item[0]}</u>{item.slice(1)}
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ background: W97.gray, borderBottom: `1px solid ${W97.grayDark}`, padding: "3px 4px", display: "flex", gap: 3, flexShrink: 0 }}>
        {actions.map(({ label, path }) => (
          <W97Button key={label} small onClick={() => navigate(path)} style={{ fontSize: 11, padding: "2px 7px" }}>{label}</W97Button>
        ))}
        <div style={{ flex: 1 }} />
        <W97Button small onClick={() => navigate("/profile")} style={{ fontSize: 11, padding: "2px 7px" }}>⚙️ Profile</W97Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto w97-scroll" style={{ background: W97.gray, padding: "6px 8px" }}>

        {/* Dog Profile */}
        <GroupBox label={`My Dog — ${dogName}`}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src="https://images.unsplash.com/photo-1714247084434-49bbc3ebf577?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200"
              alt={dogName}
              style={{ width: 56, height: 56, objectFit: "cover", ...W97.raised }}
            />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: "bold", fontSize: 14 }}>{dogName}</p>
              <p style={{ fontSize: 11 }}>{dogBreed} · {dogAge} yr{dogAge !== "1" ? "s" : ""}</p>
              <p style={{ fontSize: 11, color: "#000080" }}>🐾 {completedCnt} walk{completedCnt !== 1 ? "s" : ""} completed</p>
            </div>
            <W97Button small onClick={() => setShowDogEdit(true)} disabled={dogSaving}>
              {dogSaving ? "⏳" : "✏️ Edit"}
            </W97Button>
          </div>
        </GroupBox>

        {/* Quick Actions */}
        <GroupBox label="Quick Actions">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
            {actions.map(({ label, path }) => (
              <W97Button key={label} fullWidth onClick={() => navigate(path)} style={{ justifyContent: "flex-start", padding: "6px 8px", fontSize: 12 }}>
                {label}
              </W97Button>
            ))}
          </div>
        </GroupBox>

        {/* Upcoming / Active Walk */}
        <GroupBox label={walksLoading ? "Upcoming Walk (loading…)" : nextWalk ? "Upcoming Walk" : "Upcoming Walk — None"}>
          {walksLoading ? (
            <div>
              <div className="w97-progress-track" style={{ marginBottom: 4 }}><div className="w97-progress-fill" style={{ width: "50%" }} /></div>
              <p style={{ fontSize: 11, fontFamily: "VT323, monospace" }}>Fetching scheduled walks…</p>
            </div>
          ) : nextWalk ? (
            <>
              <div style={{ ...W97.sunken, padding: 8, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {nextWalk.walkerAvatar
                    ? <img src={nextWalk.walkerAvatar} alt={nextWalk.walkerName} style={{ width: 40, height: 40, objectFit: "cover", ...W97.raised }} />
                    : <div style={{ width: 40, height: 40, ...W97.raised, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🦮</div>
                  }
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: "bold", fontSize: 12 }}>{nextWalk.walkerName}</p>
                    <p style={{ fontSize: 11 }}>Drop-in Walk · {nextWalk.duration}</p>
                    <p style={{ fontSize: 11, color: "#000080", fontWeight: "bold" }}>{nextWalk.date} at {nextWalk.time}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{
                      fontSize: 10, padding: "1px 4px", display: "block",
                      background: STATUS_BADGE[nextWalk.status]?.bg ?? "#808080",
                      color: "#FFF",
                    }}>
                      {STATUS_BADGE[nextWalk.status]?.label ?? nextWalk.status}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                <W97Button fullWidth onClick={() => navigate("/owner/chat")}>💬 Message</W97Button>
                {nextWalk.status === "in_progress" && (
                  <W97Button fullWidth onClick={() => navigate("/owner/live-walk")} style={{ fontWeight: "bold" }}>🗺️ Track Live 🔴</W97Button>
                )}
                <W97Button fullWidth onClick={() => navigate("/owner/schedule")}>📅 + New</W97Button>
                {["pending", "accepted"].includes(nextWalk.status) && (
                  <W97Button fullWidth onClick={() => cancelBooking(nextWalk)} danger>✗ Cancel</W97Button>
                )}
              </div>
            </>
          ) : (
            <div style={{ padding: "8px 0" }}>
              <p style={{ fontSize: 12, color: W97.grayDark, marginBottom: 8 }}>No walks scheduled. Book your first drop-in walk!</p>
              <W97Button isDefault onClick={() => navigate("/owner/schedule")} style={{ fontWeight: "bold" }}>📅 Schedule a Walk</W97Button>
            </div>
          )}
        </GroupBox>

        {/* Walk History */}
        {!walksLoading && walks.length > 1 && (
          <GroupBox label={`Walk History (${walks.length} total)`}>
            <div style={{ ...W97.sunken, background: "#FFF" }}>
              {walks.slice(0, 5).map((w, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: i % 2 === 0 ? "#FFF" : "#DFDFDF", borderBottom: i < 4 ? "1px solid #C0C0C0" : "none", fontSize: 11 }}>
                  <span>🐾 {w.walkerName} walked {w.dogName ?? dogName}</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ color: W97.grayDark }}>{w.date}</span>
                    <span style={{ fontSize: 10, padding: "0 3px", background: STATUS_BADGE[w.status]?.bg ?? "#808080", color: "#FFF" }}>
                      {w.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </GroupBox>
        )}

        {/* Latest Report Card */}
        <GroupBox label="Latest Report Card">
          {latestReport ? (
            <>
              <div style={{ ...W97.sunken, padding: 8, cursor: "default", marginBottom: 6 }}
                onClick={() => navigate("/owner/report-card")}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <img src={mockWalker.avatar} alt={latestReport.walkerName} style={{ width: 32, height: 32, objectFit: "cover", ...W97.raised }} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: "bold" }}>{latestReport.walkerName} walked {latestReport.dogName}</p>
                    <p style={{ fontSize: 11 }}>
                      {new Date(latestReport.submittedAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                      {latestReport.duration ? ` · ${latestReport.duration}` : ""}
                      {latestReport.distance ? ` · ${latestReport.distance}` : ""}
                      {latestReport.ownerRating ? ` · ⭐${latestReport.ownerRating}/5` : " · ⭐ Rate now"}
                    </p>
                  </div>
                </div>
                {latestReport.notes && (
                  <p style={{ fontFamily: "VT323, monospace", fontSize: 13, color: "#000080" }}>
                    "{latestReport.notes.slice(0, 80)}…"
                  </p>
                )}
                {latestReport.mood && (
                  <p style={{ fontSize: 11, marginTop: 4 }}>{latestReport.mood} mood · {latestReport.duration ?? "—"}</p>
                )}
              </div>
              {!latestReport.ownerRating && (
                <div style={{ ...W97.raised, padding: "4px 8px", background: "#FFFFC0", fontSize: 11, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>⭐ Rate your walker!</span>
                  <W97Button small onClick={() => navigate("/owner/report-card")}>Rate Now →</W97Button>
                </div>
              )}
            </>
          ) : (
            <div style={{ ...W97.sunken, padding: 8, cursor: "default", marginBottom: 6 }}
              onClick={() => navigate("/owner/report-card")}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <img src={mockWalker.avatar} alt={mockWalker.name} style={{ width: 32, height: 32, objectFit: "cover", ...W97.raised }} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: "bold" }}>{mockWalker.name} walked {dogName}</p>
                  <p style={{ fontSize: 11 }}>Yesterday · 32 min · 1.4 mi · ⭐⭐⭐⭐⭐ (demo)</p>
                </div>
              </div>
              <p style={{ fontFamily: "VT323, monospace", fontSize: 13, color: "#000080" }}>
                "{REPORT_CARD.notes.slice(0, 80)}…"
              </p>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <W97Button small onClick={() => navigate("/owner/report-card")}>View Full Report →</W97Button>
          </div>
        </GroupBox>

        <div style={{ height: 4 }} />
      </div>

      {/* Status Bar */}
      <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "2px 4px", display: "flex", gap: 4, flexShrink: 0, minHeight: 20 }}>
        <span style={{ ...W97.inset, padding: "0 6px", flex: 1, fontSize: 11, lineHeight: "16px" }}>
          Ready | {walks.length} walk{walks.length !== 1 ? "s" : ""} on file
          {unreadNotifs > 0 && ` | 🔔 ${unreadNotifs} new notification${unreadNotifs !== 1 ? "s" : ""}`}
        </span>
        <span style={{ ...W97.inset, padding: "0 6px", fontSize: 11, lineHeight: "16px" }}>
          {displayName}
        </span>
      </div>
    </div>
  );
}