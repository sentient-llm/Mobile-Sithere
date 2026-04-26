import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { W97, W97Button } from "../../components/Win97Window";
import { WALKER_SCHEDULE } from "../../data/mockData";
import { useAuth } from "../../context/AuthContext";
import { walkStore } from "../../data/walkStore";
import { apiGet, apiPost, apiPut } from "../../lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

type AvailStatus = "available" | "busy" | "on_walk";
type BookingStatus = "pending" | "accepted" | "in_progress" | "completed" | "declined" | "cancelled";

interface Booking {
  dogName:    string;
  ownerName:  string;
  ownerId:    string;
  time:       string;
  date:       string;
  duration:   string;
  status:     BookingStatus;
  ts:         number;
  walkerPrice?: number;
  walkerAvatar?: string;
}

interface EarningsStats {
  rate:          number;
  today:         { walks: number; earnings: number };
  week:          { walks: number; earnings: number };
  month:         { walks: number; earnings: number };
  totalWalks:    number;
  totalEarnings: number;
  avgRating:     number;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function GroupBox({ label, children, accent }: { label: string; children: ReactNode; accent?: boolean }) {
  return (
    <fieldset style={{
      border:           "2px solid",
      borderTopColor:   accent ? "#800000" : "#808080",
      borderLeftColor:  accent ? "#800000" : "#808080",
      borderBottomColor:"#FFF", borderRightColor: "#FFF",
      padding:          "8px 8px 6px", background: W97.gray, margin: "0 0 8px 0",
    }}>
      <legend style={{ fontFamily: W97.font, fontSize: 11, fontWeight: "bold", padding: "0 4px", color: accent ? "#800000" : "#000" }}>
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

const AVAIL_OPTS: { id: AvailStatus; label: string; dot: string; bg: string }[] = [
  { id: "available", label: "Available",  dot: "🟢", bg: "#006400" },
  { id: "on_walk",   label: "On Walk",    dot: "🔴", bg: "#800000" },
  { id: "busy",      label: "Off Duty",   dot: "🔘", bg: "#808080" },
];

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending:     "#806000",
  accepted:    "#005000",
  in_progress: "#000080",
  completed:   "#006400",
  declined:    "#800000",
  cancelled:   "#808080",
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending:     "⏳ Pending",
  accepted:    "✓ Accepted",
  in_progress: "🔴 In Progress",
  completed:   "✅ Complete",
  declined:    "✗ Declined",
  cancelled:   "✗ Cancelled",
};

// ── Component ──────────────────────────────────────────────────────────────

export function WalkerDashboard() {
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const displayName = user?.name ?? "Walker";

  // ── Availability ────────────────────────────────────────────────────────
  const [avail,       setAvail]       = useState<AvailStatus>("available");
  const [availSaving, setAvailSaving] = useState(false);

  // ── Assignments ─────────────────────────────────────────────────────────
  const [bookings,    setBookings]    = useState<Booking[]>([]);
  const [bLoading,    setBLoading]    = useState(true);
  const [actionBusy,  setActionBusy]  = useState<number | null>(null); // ts of booking being actioned

  // ── Earnings (from walker-stats) ─────────────────────────────────────────
  const [stats,       setStats]       = useState<EarningsStats | null>(null);
  const [sLoading,    setSLoading]    = useState(true);

  // ── Load all data ────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setBLoading(true); setSLoading(true);
    try {
      const [walksData, statsData, availData] = await Promise.allSettled([
        apiGet<{ walks: Booking[] }>("/walker-walks"),
        apiGet<{ stats: EarningsStats }>("/walker-stats"),
        apiGet<{ availability: { status: AvailStatus } }>("/walker-availability"),
      ]);

      if (walksData.status === "fulfilled")  setBookings(walksData.value.walks ?? []);
      if (statsData.status === "fulfilled")  setStats(statsData.value.stats);
      if (availData.status === "fulfilled")  setAvail(availData.value.availability.status);
    } catch (e) { console.error("Dashboard load error:", e); }
    finally { setBLoading(false); setSLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Availability toggle ──────────────────────────────────────────────────
  async function setAvailability(status: AvailStatus) {
    setAvailSaving(true);
    try {
      await apiPut("/walker-availability", { status });
      setAvail(status);
    } catch (e) { console.error("Availability update:", e); }
    finally { setAvailSaving(false); }
  }

  // ── Accept / Decline / Start / Complete booking ──────────────────────────
  async function updateBookingStatus(booking: Booking, status: BookingStatus) {
    setActionBusy(booking.ts);
    try {
      await apiPut("/walks/status", { ts: booking.ts, ownerId: booking.ownerId, status });
      // Optimistically update local state
      setBookings(prev => prev.map(b => b.ts === booking.ts ? { ...b, status } : b));

      // If accepting → set available; if starting → set on_walk
      if (status === "accepted")     setAvail("available");
      if (status === "in_progress") { await setAvailability("on_walk"); }
      if (status === "completed")   { await setAvailability("available"); }

    } catch (e) { console.error("Booking status update:", e); alert("Failed to update booking. Please try again."); }
    finally { setActionBusy(null); }
  }

  // ── Start Walk — loads booking context into walkStore ────────────────────
  function startWalk(booking: Booking) {
    walkStore.reset();
    walkStore.loadBooking({
      dogName:   booking.dogName,
      ownerName: booking.ownerName,
      ownerId:   booking.ownerId,
      bookingId: `booking:${booking.ownerId}:${booking.ts}`,
      bookingTs: booking.ts,
    });
    if (user?.name) walkStore.update({ walkerName: user.name });
    // Mark as in_progress
    updateBookingStatus(booking, "in_progress");
    navigate("/walker/live-walk");
  }

  // ── Partition bookings ────────────────────────────────────────────────────
  const pending   = bookings.filter(b => b.status === "pending");
  const active    = bookings.filter(b => ["accepted", "in_progress"].includes(b.status));
  const past      = bookings.filter(b => ["completed", "declined", "cancelled"].includes(b.status));

  // ── Fallback earnings (when no real stats yet) ────────────────────────────
  const earnings = stats
    ? { today: stats.today.earnings, week: stats.week.earnings, month: stats.month.earnings }
    : { today: 0, week: 0, month: 0 };

  const currentAvail = AVAIL_OPTS.find(a => a.id === avail) ?? AVAIL_OPTS[0];

  // ── Booking card renderer ─────────────────────────────────────────────────
  function BookingCard({ booking, showActions = true }: { booking: Booking; showActions?: boolean }) {
    const isActioning = actionBusy === booking.ts;
    return (
      <div style={{ ...W97.raised, marginBottom: 6, padding: 8 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, background: "#C0C0C0", ...W97.raised, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🐕</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: "bold", fontSize: 12, marginBottom: 1 }}>{booking.dogName}</p>
            <p style={{ fontSize: 11 }}>👤 {booking.ownerName}</p>
            <p style={{ fontSize: 11 }}>⏰ {booking.time} · {booking.duration} · {booking.date}</p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <span style={{ fontSize: 10, padding: "1px 5px", background: STATUS_COLORS[booking.status], color: "#FFF", display: "block", marginBottom: 2 }}>
              {STATUS_LABELS[booking.status]}
            </span>
            {booking.walkerPrice && (
              <span style={{ fontFamily: "VT323, monospace", fontSize: 18, color: "#000080" }}>
                ${booking.walkerPrice}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {showActions && (
          <div style={{ borderTop: `1px solid ${W97.grayDark}`, paddingTop: 5, display: "flex", gap: 3 }}>
            {booking.status === "pending" && (
              <>
                <W97Button small fullWidth onClick={() => updateBookingStatus(booking, "accepted")} disabled={isActioning}
                  style={{ fontWeight: "bold", color: "#006400" }}>
                  ✓ {isActioning ? "..." : "Accept"}
                </W97Button>
                <W97Button small fullWidth onClick={() => updateBookingStatus(booking, "declined")} disabled={isActioning} danger>
                  ✗ {isActioning ? "..." : "Decline"}
                </W97Button>
                <W97Button small onClick={() => navigate("/walker/chat")}>💬</W97Button>
              </>
            )}
            {booking.status === "accepted" && (
              <>
                <W97Button small fullWidth isDefault onClick={() => startWalk(booking)} disabled={isActioning}
                  style={{ fontWeight: "bold" }}>
                  ▶ {isActioning ? "..." : "Start Walk"}
                </W97Button>
                <W97Button small fullWidth onClick={() => navigate("/walker/chat")}>💬 Chat</W97Button>
                <W97Button small onClick={() => updateBookingStatus(booking, "cancelled")} disabled={isActioning} danger>✗</W97Button>
              </>
            )}
            {booking.status === "in_progress" && (
              <>
                <W97Button small fullWidth isDefault onClick={() => navigate("/walker/live-walk")}
                  style={{ fontWeight: "bold", color: "#800000" }}>
                  🔴 Live Map
                </W97Button>
                <W97Button small fullWidth onClick={() => navigate("/walker/chat")}>💬 Chat</W97Button>
                <W97Button small fullWidth onClick={() => navigate("/walker/report-card")} style={{ fontWeight: "bold" }}>
                  📋 Report
                </W97Button>
              </>
            )}
            {booking.status === "completed" && (
              <W97Button small fullWidth onClick={() => navigate("/walker/report-card")}>📋 View Report</W97Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: W97.gray, fontFamily: W97.font, color: "#000" }}>

      {/* Title Bar */}
      <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, minHeight: 22, userSelect: "none", flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>🦮</span>
        <span style={{ flex: 1, fontWeight: "bold", fontSize: 12 }}>Walker Console — {displayName}</span>
        {pending.length > 0 && (
          <span style={{ background: "#800000", color: "#FFF", fontSize: 9, padding: "0 4px", fontWeight: "bold" }}>
            {pending.length} NEW
          </span>
        )}
        <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>_</button>
        <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>□</button>
        <button className="w97-titlebar-btn" style={{ ...W97.titlebarBtnStyle, fontWeight: "bold" }} onClick={() => navigate("/")}>✕</button>
      </div>

      {/* Menu Bar */}
      <div style={{ background: W97.gray, borderBottom: `1px solid ${W97.grayDark}`, display: "flex", padding: "1px 2px", flexShrink: 0, minHeight: 20 }}>
        {["File", "Walk", "Earnings", "Help"].map(item => (
          <span key={item} className="w97-menuitem" style={{ padding: "2px 6px", fontSize: 11, cursor: "default" }}>
            <u>{item[0]}</u>{item.slice(1)}
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ background: W97.gray, borderBottom: `1px solid ${W97.grayDark}`, padding: "3px 4px", display: "flex", gap: 3, flexShrink: 0, alignItems: "center" }}>
        <W97Button small onClick={() => navigate("/walker/chat")} style={{ fontSize: 11 }}>💬 Chat</W97Button>
        <W97Button small onClick={() => navigate("/walker/report-card")} style={{ fontSize: 11 }}>📋 Report</W97Button>
        <W97Button small onClick={() => navigate("/walker/earnings")} style={{ fontSize: 11 }}>💰 Earnings</W97Button>
        <div style={{ width: 1, height: 18, background: "#808080", margin: "0 2px" }} />
        {/* Availability selector */}
        <div style={{ display: "flex", gap: 2 }}>
          {AVAIL_OPTS.map(opt => (
            <button
              key={opt.id}
              className="w97-btn"
              onClick={() => !availSaving && setAvailability(opt.id)}
              disabled={availSaving}
              style={{
                fontSize: 10, padding: "1px 6px",
                background: avail === opt.id ? opt.bg : W97.gray,
                color:      avail === opt.id ? "#FFF"  : "#000",
                fontWeight: avail === opt.id ? "bold"  : "normal",
                minHeight:  20,
              }}
            >
              {opt.dot} {opt.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <W97Button small onClick={() => navigate("/profile")} style={{ fontSize: 11 }}>⚙️</W97Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto w97-scroll" style={{ background: W97.gray, padding: "6px 8px 4px" }}>

        {/* Earnings strip */}
        <GroupBox label={sLoading ? "Earnings (loading…)" : `Earnings · $${(stats?.rate ?? 22)}/walk`}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
            {[
              { label: "Today",  value: `$${earnings.today}`,  icon: "💵" },
              { label: "Week",   value: `$${earnings.week}`,   icon: "📈" },
              { label: "Month",  value: `$${earnings.month}`,  icon: "🏆" },
            ].map(({ label, value, icon }) => (
              <div key={label} style={{ ...W97.sunken, padding: "6px 4px", textAlign: "center" }}>
                <div style={{ fontSize: 18 }}>{icon}</div>
                <div style={{ fontFamily: "VT323, monospace", fontSize: 20, color: "#000080", lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 10, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
          {stats && (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, padding: "3px 4px", background: "#DFDFDF", fontSize: 11 }}>
              <span>⭐ Avg rating: <strong>{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "—"}</strong></span>
              <span>🐾 Total walks: <strong>{stats.totalWalks}</strong></span>
              <button className="w97-btn" style={{ fontSize: 10, padding: "0 5px", minHeight: 16 }} onClick={() => navigate("/walker/earnings")}>
                View All →
              </button>
            </div>
          )}
        </GroupBox>

        {/* Pending Requests — highlighted */}
        {(bLoading || pending.length > 0) && (
          <GroupBox label={bLoading ? "New Requests (loading…)" : `⚡ New Requests (${pending.length})`} accent>
            {bLoading ? (
              <div>
                <div className="w97-progress-track" style={{ marginBottom: 4 }}><div className="w97-progress-fill" style={{ width: "55%" }} /></div>
                <p style={{ fontFamily: "VT323, monospace", fontSize: 13 }}>Checking for new bookings...</p>
              </div>
            ) : (
              <>
                {pending.map(b => <BookingCard key={b.ts} booking={b} />)}
              </>
            )}
          </GroupBox>
        )}

        {/* Confirmed / In-Progress Walks */}
        <GroupBox label={active.length > 0 ? `Today's Walks (${active.length})` : "Today's Walks"}>
          {bLoading ? (
            <div>
              <div className="w97-progress-track" style={{ marginBottom: 4 }}><div className="w97-progress-fill" style={{ width: "40%" }} /></div>
              <p style={{ fontFamily: "VT323, monospace", fontSize: 13 }}>Loading schedule...</p>
            </div>
          ) : active.length > 0 ? (
            active.map(b => <BookingCard key={b.ts} booking={b} />)
          ) : (
            // No real bookings yet — show mock schedule as demo
            <>
              {WALKER_SCHEDULE.filter(b => b.date === "Today").map(booking => (
                <div key={booking.id} style={{ ...W97.raised, marginBottom: 6, padding: 8 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 5 }}>
                    <img src={booking.dogAvatar} alt={booking.dog} style={{ width: 40, height: 40, objectFit: "cover", ...W97.raised }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: "bold", fontSize: 12 }}>{booking.dog} <span style={{ fontWeight: "normal", color: "#808080" }}>({booking.breed})</span></p>
                      <p style={{ fontSize: 11 }}>👤 {booking.owner}</p>
                      <p style={{ fontSize: 11 }}>⏰ {booking.time} · {booking.duration}</p>
                      <p style={{ fontSize: 10, color: "#808080" }}>📍 {booking.address}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: 9, padding: "1px 4px", background: "#000080", color: "#FFF", display: "block", marginBottom: 2 }}>DEMO</span>
                      <span style={{ fontSize: 10, color: "#006400", fontWeight: "bold" }}>✓ Confirmed</span>
                    </div>
                  </div>
                  <div style={{ borderTop: `1px solid ${W97.grayDark}`, paddingTop: 5, display: "flex", gap: 3 }}>
                    <W97Button small fullWidth onClick={() => {
                      walkStore.reset();
                      walkStore.update({ dogName: booking.dog, ownerName: booking.owner, walkerName: user?.name ?? "Walker" });
                      navigate("/walker/live-walk");
                    }} style={{ fontWeight: "bold", color: "#006400" }}>▶ Start Walk</W97Button>
                    <W97Button small fullWidth onClick={() => navigate("/walker/chat")}>💬 Chat</W97Button>
                    <W97Button small fullWidth onClick={() => navigate("/walker/report-card")}>📋 Report</W97Button>
                  </div>
                </div>
              ))}
              {bookings.length === 0 && pending.length === 0 && !bLoading && (
                <div style={{ ...W97.sunken, padding: "8px 10px", fontSize: 11 }}>
                  <p style={{ color: W97.grayDark, marginBottom: 4 }}>No real bookings yet — demo walk shown above.</p>
                  <p style={{ color: "#000080" }}>💡 When owners book you, their requests will appear here as "New Requests" for you to accept.</p>
                </div>
              )}
            </>
          )}
        </GroupBox>

        {/* Upcoming confirmed walks (tomorrow+) */}
        {!bLoading && active.length === 0 && WALKER_SCHEDULE.filter(b => b.date !== "Today").length > 0 && (
          <GroupBox label="Upcoming (Demo)">
            {WALKER_SCHEDULE.filter(b => b.date !== "Today").map(booking => (
              <div key={booking.id} style={{ ...W97.raised, marginBottom: 5, padding: "6px 8px", display: "flex", gap: 8, alignItems: "center" }}>
                <img src={booking.dogAvatar} alt={booking.dog} style={{ width: 32, height: 32, objectFit: "cover", ...W97.raised, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: "bold", fontSize: 12 }}>{booking.dog}</p>
                  <p style={{ fontSize: 11 }}>{booking.date} · {booking.time} · {booking.duration}</p>
                </div>
                <span style={{ fontSize: 10, padding: "1px 4px", background: "#008000", color: "#FFF" }}>✓</span>
              </div>
            ))}
          </GroupBox>
        )}

        {/* Recent completions */}
        {!bLoading && past.length > 0 && (
          <GroupBox label={`Recent Completions (${past.length})`}>
            {past.slice(0, 3).map(b => <BookingCard key={b.ts} booking={b} showActions={false} />)}
          </GroupBox>
        )}

        <div style={{ height: 4 }} />
      </div>

      {/* Status Bar */}
      <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "2px 4px", display: "flex", gap: 4, flexShrink: 0, minHeight: 20 }}>
        <span style={{ ...W97.inset, padding: "0 6px", flex: 1, fontSize: 11, lineHeight: "16px" }}>
          {currentAvail.dot} {currentAvail.label} | {pending.length} pending · {active.length} active
        </span>
        <span style={{ ...W97.inset, padding: "0 6px", fontSize: 11, lineHeight: "16px" }}>
          {displayName}
        </span>
      </div>
    </div>
  );
}
