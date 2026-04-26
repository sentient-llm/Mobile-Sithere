import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";

interface BottomNavProps {
  role: "owner" | "walker";
}

const ownerItems = [
  { icon: "🏠", label: "Home",     path: "/owner" },
  { icon: "📅", label: "Schedule", path: "/owner/schedule" },
  { icon: "💬", label: "Chat",     path: "/owner/chat" },
  { icon: "📋", label: "Reports",  path: "/owner/report-card" },
  { icon: "🏥", label: "Vets",     path: "/owner/vet-finder" },
];

const walkerItems = [
  { icon: "🏠", label: "Home",    path: "/walker" },
  { icon: "💬", label: "Chat",    path: "/walker/chat" },
  { icon: "📋", label: "Reports", path: "/walker/report-card" },
];

function useClock() {
  const [time, setTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  });
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 10000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export function BottomNav({ role }: BottomNavProps) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const clock     = useClock();
  const items     = role === "owner" ? ownerItems : walkerItems;

  return (
    <div
      style={{
        background:   "#C0C0C0",
        borderTop:    "2px solid #FFFFFF",
        display:      "flex",
        alignItems:   "center",
        padding:      "2px 4px",
        gap:          3,
        flexShrink:   0,
        fontFamily:   '"MS Sans Serif", Tahoma, Arial, sans-serif',
        minHeight:    30,
      }}
    >
      {/* Start button */}
      <button
        className="w97-start-btn"
        onClick={() => navigate(role === "owner" ? "/owner" : "/walker")}
        style={{ flexShrink: 0 }}
      >
        🐾 <span style={{ fontWeight: "bold", fontSize: 12 }}>Start</span>
      </button>

      {/* Separator */}
      <div style={{ width: 2, height: 22, borderLeft: "1px solid #808080", borderRight: "1px solid #FFFFFF", flexShrink: 0 }} />

      {/* Quick-launch nav buttons */}
      <div style={{ display: "flex", gap: 2, flex: 1, overflow: "hidden" }}>
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              className={`w97-taskbar-btn${isActive ? " active" : ""}`}
              onClick={() => navigate(item.path)}
              style={{ flex: 1, minWidth: 0, fontSize: 10 }}
            >
              <span>{item.icon}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Separator */}
      <div style={{ width: 2, height: 22, borderLeft: "1px solid #808080", borderRight: "1px solid #FFFFFF", flexShrink: 0 }} />

      {/* System tray clock */}
      <div
        style={{
          ...{
            borderStyle:       "solid",
            borderWidth:       1,
            borderTopColor:    "#808080",
            borderLeftColor:   "#808080",
            borderBottomColor: "#FFFFFF",
            borderRightColor:  "#FFFFFF",
          },
          padding:    "2px 6px",
          fontSize:   11,
          fontFamily: '"MS Sans Serif", Tahoma, Arial, sans-serif',
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {clock}
      </div>
    </div>
  );
}
