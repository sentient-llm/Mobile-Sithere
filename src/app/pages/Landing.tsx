import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { W97, W97Button } from "../components/Win97Window";
import { useAuth } from "../context/AuthContext";

// Landing is only ever rendered when there IS a session (Root.tsx shows Login otherwise).
// Its job: show the boot sequence, then redirect to the correct dashboard.

export function Landing() {
  const navigate        = useNavigate();
  const { user }        = useAuth();
  const [progress,  setProgress]  = useState(0);
  const [booting,   setBooting]   = useState(true);
  const [bootMsg,   setBootMsg]   = useState("Initializing Sit-Here v1.0...");

  // Animated boot then redirect to role dashboard
  useEffect(() => {
    const msgs = [
      "Initializing Sit-Here v1.0...",
      "Loading dog database...",
      "Sniffing out walkers...",
      user ? `Welcome back, ${user.name.split(" ")[0]}!` : "Fetching good boys...",
      "Ready.",
    ];
    let step = 0;
    const id = setInterval(() => {
      step++;
      setProgress(step * 20);
      setBootMsg(msgs[Math.min(step, msgs.length - 1)]);
      if (step >= 5) {
        clearInterval(id);
        setTimeout(() => {
          setBooting(false);
          // Auto-redirect after a short beat
          setTimeout(() => {
            navigate(user?.role === "walker" ? "/walker" : "/owner", { replace: true });
          }, 800);
        }, 400);
      }
    }, 380);
    return () => clearInterval(id);
  }, [user]);

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: W97.teal, fontFamily: W97.font, position: "relative" }}
    >
      {/* Title Bar */}
      <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 4px 3px 6px", display: "flex", alignItems: "center", gap: 6, minHeight: 22, userSelect: "none", flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>🐾</span>
        <span style={{ flex: 1, fontWeight: "bold", fontSize: 12 }}>Sit-Here — Dog Walking v1.0</span>
        <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>_</button>
        <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>□</button>
        <button className="w97-titlebar-btn" style={{ ...W97.titlebarBtnStyle, fontWeight: "bold" }}>✕</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ ...W97.raised, width: "100%", maxWidth: 360, boxShadow: "2px 2px 0 #000" }}>
          {/* Inner title bar */}
          <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 4px 3px 6px", display: "flex", alignItems: "center", gap: 6, minHeight: 22, userSelect: "none" }}>
            <span style={{ fontSize: 14 }}>🐾</span>
            <span style={{ flex: 1, fontWeight: "bold", fontSize: 12 }}>
              {booting ? "Sit-Here.exe — Loading" : `Welcome, ${user?.name?.split(" ")[0] ?? "there"}!`}
            </span>
          </div>

          {/* Body */}
          <div style={{ padding: "14px 16px", background: W97.gray }}>
            {booting ? (
              // Boot sequence
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 52, marginBottom: 10 }}>🐕</div>
                <p style={{ fontFamily: "VT323, monospace", fontSize: 20, marginBottom: 4, color: "#000" }}>SIT-HERE.EXE</p>
                <p style={{ fontSize: 11, color: "#000080", marginBottom: 12 }}>Drop-In Dog Walking Software</p>
                <div className="w97-progress-track" style={{ marginBottom: 6 }}>
                  <div className="w97-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <p style={{ fontFamily: "VT323, monospace", fontSize: 14, color: "#000" }}>{bootMsg}</p>
              </div>
            ) : (
              // Post-boot: redirect message
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                <p style={{ fontWeight: "bold", fontSize: 14, marginBottom: 4 }}>Welcome back, {user?.name?.split(" ")[0]}!</p>
                <p style={{ fontSize: 11, color: "#000080", marginBottom: 10 }}>
                  Loading your {user?.role === "walker" ? "Walker Console" : "Dog Manager"}…
                </p>
                <div className="w97-progress-track" style={{ marginBottom: 4 }}>
                  <div className="w97-progress-fill" style={{ width: "90%" }} />
                </div>
              </div>
            )}
          </div>

          {/* Status bar */}
          <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "2px 8px", fontSize: 11, display: "flex", gap: 8 }}>
            <span style={{ ...W97.inset, padding: "0 6px", flex: 1, lineHeight: "16px" }}>
              {booting ? bootMsg : "Redirecting…"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
