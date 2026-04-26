import { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import { useAuth } from "./context/AuthContext";
import { Login } from "./pages/Login";
import { W97 } from "./components/Win97Window";
import { apiGet, apiPut } from "./lib/api";

const FONT = '"MS Sans Serif", Tahoma, Arial, sans-serif';

interface IconDef {
  icon: string;
  label: string;
  path?: string;
  system?: boolean;
}

const SYSTEM_ICONS: IconDef[] = [
  { icon: "🖥️", label: "My\nComputer",      system: true },
  { icon: "🗑️", label: "Recycle\nBin",      system: true },
  { icon: "📁", label: "My\nDocuments",     system: true },
  { icon: "🌐", label: "Internet\nExplorer", system: true },
];

const PAGE_TITLES: Record<string, string> = {
  "/":                    "🐾 Sit-Here — Home",
  "/profile":             "⚙️ Account Properties",
  "/owner":               "🐕 My Dog Manager",
  "/owner/schedule":      "📅 Schedule Walk",
  "/owner/chat":          "💬 Owner Chat",
  "/owner/report-card":   "📋 Report Card",
  "/owner/vet-finder":    "🏥 Vet Finder",
  "/owner/live-walk":     "🗺️ Live Walk",
  "/walker":              "🦮 Walker Console",
  "/walker/chat":         "💬 Walker Chat",
  "/walker/report-card":  "📋 Walker Report",
  "/walker/live-walk":    "🗺️ Live Walk",
  "/walker/earnings":     "💰 Earnings Ledger",
  "/launch":              "🚀 Launch Center",
};

// Build desktop app icons from user's role
function getAppIcons(role?: string): IconDef[] {
  const common: IconDef[] = [
    { icon: "🐾", label: "Sit-Here",       path: "/" },
    { icon: "⚙️", label: "Profile",         path: "/profile" },
    { icon: "🚀", label: "Launch\nCenter",  path: "/launch" },
  ];
  if (!role || role === "owner") {
    common.push(
      { icon: "🐕",  label: "Dog\nOwner",     path: "/owner"              },
      { icon: "📅",  label: "Schedule\nWalk", path: "/owner/schedule"     },
      { icon: "💬",  label: "Chat",            path: "/owner/chat"         },
      { icon: "📋",  label: "Report\nCard",   path: "/owner/report-card"  },
      { icon: "🏥",  label: "Vet\nFinder",    path: "/owner/vet-finder"   },
    );
  }
  if (!role || role === "walker") {
    common.push(
      { icon: "🦮",  label: "Dog\nWalker",    path: "/walker"              },
      { icon: "💰",  label: "Earnings",        path: "/walker/earnings"    },
      { icon: "📋",  label: "Report\nCard",   path: "/walker/report-card"  },
      { icon: "💬",  label: "Chat",            path: "/walker/chat"         },
    );
  }
  return common;
}

function DesktopIcon({
  icon, label, active, onClick,
}: {
  icon: string; label: string; active?: boolean; onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      style={{
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        gap:           3,
        width:         72,
        padding:       "4px 2px 3px",
        cursor:        "default",
        userSelect:    "none",
        background:    active || hover ? "rgba(0,0,128,0.45)" : "transparent",
        outline:       active ? "1px dotted rgba(255,255,255,0.8)" : "none",
        outlineOffset: -1,
      }}
    >
      <span style={{ fontSize: 30, lineHeight: 1, filter: "drop-shadow(1px 1px 1px rgba(0,0,0,0.5))" }}>
        {icon}
      </span>
      <span
        style={{
          fontFamily:  FONT,
          fontSize:    11,
          color:       "#ffffff",
          textAlign:   "center",
          lineHeight:  "13px",
          textShadow:  "1px 1px 2px #000, 0 0 4px #000",
          whiteSpace:  "pre-line",
          wordBreak:   "break-word",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────

export function Root() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { session, user, loading, signOut } = useAuth();

  const [time,           setTime]           = useState(new Date());
  const [showStart,      setShowStart]      = useState(false);
  const [showSignOut,    setShowSignOut]     = useState(false);
  const [activeIcon,     setActiveIcon]     = useState<string | null>(null);
  const [unreadNotifs,   setUnreadNotifs]   = useState(0);
  const [showNotifDot,   setShowNotifDot]   = useState(false);
  const startRef = useRef<HTMLDivElement>(null);

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auth redirect: after session loads, push to the right dashboard
  useEffect(() => {
    if (loading) return;
    if (session && user && location.pathname === "/") {
      navigate(user.role === "walker" ? "/walker" : "/owner", { replace: true });
    }
  }, [loading, session, user, location.pathname, navigate]);

  // Close start menu on outside click
  useEffect(() => {
    const handler = () => { setShowStart(false); setShowSignOut(false); };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  // Poll notifications every 30 s when logged in
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    async function poll() {
      try {
        const data = await apiGet<{ unreadCount: number }>("/notifications");
        if (!cancelled) {
          const count = data.unreadCount ?? 0;
          setUnreadNotifs(count);
          setShowNotifDot(count > 0);
        }
      } catch {
        // Silently ignore — notification badge is non-critical background work.
        // The retry logic in api.ts already handles expired tokens automatically.
      }
    }
    poll();
    const id = setInterval(poll, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [session]);

  // Mark notifications read when user opens tray popup
  function handleTrayClick(e: React.MouseEvent) {
    if (!session) return;
    e.stopPropagation();
    setShowSignOut(s => !s);
    if (unreadNotifs > 0) {
      setShowNotifDot(false);
      setUnreadNotifs(0);
      apiPut("/notifications/read", {}).catch(() => {});
    }
  }

  const currentTitle = PAGE_TITLES[location.pathname] ?? "Sit-Here";
  const appIcons     = getAppIcons(user?.role);

  // ── Auth gate: show spinner while loading, Login if no session ──────────
  const windowContent = loading ? (
    // Boot loading state
    <div
      className="h-full flex flex-col items-center justify-center"
      style={{ background: W97.gray, fontFamily: W97.font }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 10 }}>🐾</div>
        <p style={{ fontFamily: "VT323, monospace", fontSize: 20, marginBottom: 8, color: "#000" }}>
          SIT-HERE.EXE
        </p>
        <div className="w97-progress-track" style={{ width: 200, marginBottom: 8 }}>
          <div className="w97-progress-fill" style={{ width: "60%" }} />
        </div>
        <p style={{ fontFamily: "VT323, monospace", fontSize: 14, color: "#000" }}>
          Checking session...
        </p>
      </div>
    </div>
  ) : !session ? (
    <Login />
  ) : (
    <Outlet />
  );

  return (
    <div
      style={{
        width:           "100vw",
        height:          "100vh",
        background:      "#008080",
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.09) 1px, transparent 0)",
        backgroundSize:  "4px 4px",
        position:        "relative",
        overflow:        "hidden",
        fontFamily:      FONT,
        display:         "flex",
        flexDirection:   "column",
      }}
    >
      {/* ── Desktop work area ── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>

        {/* Icons column — hidden on phones ≤ 420px via CSS media query */}
        {session && (
          <div
            className="w97-desktop-icons w97-scroll"
            style={{
              display:       "flex",
              flexDirection: "column",
              padding:       "10px 4px",
              gap:           2,
              flexShrink:    0,
              width:         80,
              overflowY:     "auto",
              overflowX:     "hidden",
            }}
          >
            {SYSTEM_ICONS.map(({ icon, label }) => (
              <DesktopIcon
                key={label}
                icon={icon}
                label={label}
                active={activeIcon === label}
                onClick={() => setActiveIcon(label)}
              />
            ))}
            <div style={{ height: 1, background: "rgba(255,255,255,0.25)", margin: "6px 8px" }} />
            {appIcons.map(({ icon, label, path }) => (
              <DesktopIcon
                key={label + path}
                icon={icon}
                label={label}
                active={activeIcon === label || (!!path && location.pathname === path)}
                onClick={() => {
                  setActiveIcon(label);
                  if (path) navigate(path);
                }}
              />
            ))}
          </div>
        )}

        {/* Window area */}
        <div
          style={{
            flex:           1,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            padding:        session ? "10px 10px 6px 6px" : "16px",
            minWidth:       0,
          }}
        >
          <div
            style={{
              width:         "min(500px, 100%)",
              height:        "min(680px, 100%)",
              boxShadow:     "4px 4px 0 rgba(0,0,0,0.45), 0 0 0 1px #000000",
              display:       "flex",
              flexDirection: "column",
            }}
          >
            {windowContent}
          </div>
        </div>
      </div>

      {/* ── Taskbar ── */}
      <div
        style={{
          background:  "#C0C0C0",
          borderTop:   "2px solid #FFFFFF",
          display:     "flex",
          alignItems:  "center",
          padding:     "2px 4px",
          gap:         4,
          minHeight:   30,
          height:      30,
          flexShrink:  0,
          position:    "relative",
          zIndex:      200,
        }}
      >
        {/* Start button */}
        <button
          className="w97-start-btn"
          style={{ fontWeight: "bold", gap: 4 }}
          onClick={(e) => { e.stopPropagation(); setShowStart(s => !s); }}
        >
          <span style={{ fontSize: 14 }}>🐾</span>
          <span>Start</span>
        </button>

        {/* Divider */}
        <div style={{ width: 2, height: 20, borderLeft: "1px solid #808080", borderRight: "1px solid #fff", flexShrink: 0 }} />

        {/* Active window buttons */}
        {session && Object.entries(PAGE_TITLES).map(([path, title]) => {
          const isActive = location.pathname === path;
          if (!isActive) return null;
          return (
            <button
              key={path}
              className="w97-taskbar-btn active"
              style={{ minWidth: 110, maxWidth: 180, fontSize: 11, padding: "1px 6px" }}
              onClick={() => navigate(path)}
            >
              {title}
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        {/* System tray */}
        <div
          style={{
            display:           "flex",
            alignItems:        "center",
            gap:               6,
            padding:           "2px 8px",
            borderStyle:       "solid",
            borderWidth:       1,
            borderTopColor:    "#808080",
            borderLeftColor:   "#808080",
            borderBottomColor: "#FFFFFF",
            borderRightColor:  "#FFFFFF",
            fontSize:          11,
            fontFamily:        FONT,
            whiteSpace:        "nowrap",
            height:            22,
            cursor:            session ? "default" : undefined,
            position:          "relative",
          }}
          onClick={handleTrayClick}
        >
          {/* Notification badge dot */}
          {showNotifDot && (
            <div style={{
              position:    "absolute",
              top:          -2,
              right:        -2,
              width:        10,
              height:       10,
              background:   "#FF0000",
              border:       "1px solid #C0C0C0",
              borderRadius: "50%",
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
              fontSize:     8,
              color:        "#FFF",
              fontWeight:   "bold",
              lineHeight:   1,
              zIndex:       1,
            }} title={`${unreadNotifs} new notification${unreadNotifs !== 1 ? "s" : ""}`}>
              {unreadNotifs > 9 ? "!" : unreadNotifs}
            </div>
          )}
          {session && user && (
            <span style={{ color: "#000080", fontWeight: "bold" }}>
              {user.role === "walker" ? "🦮" : "🐕"} {user.name.split(" ")[0]}
            </span>
          )}
          <span>🔊</span>
          <span>{time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>

        {/* Sign-out popup from tray */}
        {showSignOut && session && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position:          "absolute",
              bottom:            32,
              right:             4,
              background:        "#C0C0C0",
              borderStyle:       "solid",
              borderWidth:       2,
              borderTopColor:    "#FFFFFF",
              borderLeftColor:   "#FFFFFF",
              borderBottomColor: "#808080",
              borderRightColor:  "#808080",
              boxShadow:         "3px 3px 6px rgba(0,0,0,0.5)",
              zIndex:            400,
              minWidth:          200,
              padding:           4,
            }}
          >
            <div style={{ padding: "6px 8px", borderBottom: "1px solid #808080", marginBottom: 4 }}>
              <p style={{ fontWeight: "bold", fontSize: 12, fontFamily: FONT }}>
                {user?.role === "walker" ? "🦮" : "🐕"} {user?.name}
              </p>
              <p style={{ fontSize: 10, color: "#808080", fontFamily: FONT }}>
                {user?.email} · {user?.role === "walker" ? "Dog Walker" : "Dog Owner"}
              </p>
              {unreadNotifs > 0 && (
                <div style={{ marginTop: 4, padding: "2px 4px", background: "#800000", color: "#FFF", fontSize: 10 }}>
                  🔔 {unreadNotifs} unread notification{unreadNotifs !== 1 ? "s" : ""}
                </div>
              )}
            </div>
            {[
              { icon: user?.role === "walker" ? "🦮" : "🐕", label: "My Dashboard", action: () => navigate(user?.role === "walker" ? "/walker" : "/owner") },
              { icon: "🔔", label: `Notifications${unreadNotifs > 0 ? ` (${unreadNotifs})` : ""}`, action: () => navigate(user?.role === "walker" ? "/walker" : "/owner/report-card") },
              { icon: "⚙️", label: "Profile & Settings", action: () => navigate("/profile") },
              { icon: "🚪", label: "Sign Out", action: async () => { setShowSignOut(false); await signOut(); } },
            ].map(({ icon, label, action }) => (
              <div key={label} className="w97-list-row"
                style={{ padding: "5px 8px", display: "flex", alignItems: "center", gap: 8 }}
                onClick={() => { setShowSignOut(false); action(); }}>
                <span>{icon}</span>
                <span style={{ fontSize: 12, fontFamily: FONT }}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Start Menu ── */}
      {showStart && (
        <div
          ref={startRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position:          "absolute",
            bottom:            30,
            left:              0,
            width:             220,
            background:        "#C0C0C0",
            borderStyle:       "solid",
            borderWidth:       2,
            borderTopColor:    "#FFFFFF",
            borderLeftColor:   "#FFFFFF",
            borderBottomColor: "#808080",
            borderRightColor:  "#808080",
            boxShadow:         "3px 3px 6px rgba(0,0,0,0.5)",
            zIndex:            300,
            overflow:          "hidden",
          }}
        >
          <div style={{ display: "flex" }}>
            {/* Vertical stripe */}
            <div
              style={{
                width:          24,
                flexShrink:     0,
                background:     "linear-gradient(180deg, #000080 0%, #1084D0 100%)",
                display:        "flex",
                alignItems:     "flex-end",
                justifyContent: "center",
                paddingBottom:  6,
              }}
            >
              <span
                style={{
                  color:         "#ffffff",
                  fontSize:      10,
                  fontFamily:    FONT,
                  fontWeight:    "bold",
                  letterSpacing: 1,
                  writingMode:   "vertical-rl",
                  transform:     "rotate(180deg)",
                  opacity:       0.9,
                  userSelect:    "none",
                }}
              >
                Sit-Here 97
              </span>
            </div>

            {/* Menu items */}
            <div style={{ flex: 1 }}>
              {/* User info header */}
              {session && user && (
                <div style={{ padding: "8px 8px 6px", borderBottom: "1px solid #808080" }}>
                  <p style={{ fontWeight: "bold", fontSize: 12, fontFamily: FONT }}>
                    {user.role === "walker" ? "🦮" : "🐕"} {user.name}
                  </p>
                  <p style={{ fontSize: 10, color: "#808080", fontFamily: FONT }}>
                    {user.role === "walker" ? "Dog Walker" : "Dog Owner"}
                  </p>
                </div>
              )}

              {[
                session ? { icon: user?.role === "walker" ? "🦮" : "🐕", label: "My Dashboard", path: user?.role === "walker" ? "/walker" : "/owner" } : null,
                { icon: "⚙️", label: "Profile & Settings", path: "/profile" },
                ...(user?.role !== "walker" ? [
                  { icon: "📅", label: "Schedule Walk", path: "/owner/schedule" },
                  { icon: "💬", label: "Chat",           path: "/owner/chat"         },
                  { icon: "📋", label: "Report Card",   path: "/owner/report-card"  },
                  { icon: "🏥", label: "Vet Finder",    path: "/owner/vet-finder"   },
                ] : [
                  { icon: "💰", label: "Earnings",       path: "/walker/earnings"    },
                  { icon: "💬", label: "Chat",            path: "/walker/chat"        },
                  { icon: "📋", label: "Report Card",    path: "/walker/report-card" },
                ]),
                null,
                { icon: "🚀", label: "Launch Center", path: "/launch" },
                null,
                session
                  ? { icon: "🚪", label: "Sign Out", path: null as unknown as string }
                  : null,
              ].map((item, i) => {
                if (!item) {
                  return (
                    <div
                      key={`sep-${i}`}
                      style={{ height: 1, background: "#808080", margin: "3px 6px", boxShadow: "0 1px 0 #fff" }}
                    />
                  );
                }
                return (
                  <div
                    key={item.label}
                    className="w97-list-row"
                    style={{ padding: "5px 8px", display: "flex", alignItems: "center", gap: 8, cursor: "default" }}
                    onClick={async () => {
                      setShowStart(false);
                      if (item.label === "Sign Out") {
                        await signOut();
                      } else if (item.path) {
                        navigate(item.path);
                      }
                    }}
                  >
                    <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{item.icon}</span>
                    <span style={{ fontSize: 12, fontFamily: FONT }}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}