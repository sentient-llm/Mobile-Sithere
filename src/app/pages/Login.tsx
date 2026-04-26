import { useState } from "react";
import { useAuth, type UserRole } from "../context/AuthContext";
import { W97, W97Button } from "../components/Win97Window";

type Tab = "signin" | "signup";

export function Login() {
  const { signIn, signUp } = useAuth();

  // ── Tab ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>("signin");

  // ── Sign In form ─────────────────────────────────────────────────────────
  const [siEmail,    setSiEmail]    = useState("");
  const [siPassword, setSiPassword] = useState("");

  // ── Create Account form ───────────────────────────────────────────────────
  const [suName,     setSuName]     = useState("");
  const [suEmail,    setSuEmail]    = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suRole,     setSuRole]     = useState<UserRole>("owner");

  // ── Shared state ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!siEmail.trim() || !siPassword.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await signIn(siEmail.trim(), siPassword);
    setLoading(false);
    if (error) setError(error);
    // on success Root.tsx re-renders with the session and shows the real app
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!suName.trim() || !suEmail.trim() || !suPassword.trim()) {
      setError("All fields are required.");
      return;
    }
    if (suPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await signUp(suName.trim(), suEmail.trim(), suPassword, suRole);
    setLoading(false);
    if (error) setError(error);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="h-full flex flex-col"
      style={{ background: W97.gray, fontFamily: W97.font, color: "#000" }}
    >
      {/* Title Bar */}
      <div
        style={{
          background:   W97.titlebarGrad,
          color:        "#FFF",
          padding:      "3px 6px",
          display:      "flex",
          alignItems:   "center",
          gap:          4,
          minHeight:    22,
          userSelect:   "none",
          flexShrink:   0,
        }}
      >
        <span style={{ fontSize: 14 }}>🔐</span>
        <span style={{ flex: 1, fontWeight: "bold", fontSize: 12 }}>
          Sit-Here — Login v1.0
        </span>
        <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>_</button>
        <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>□</button>
        <button className="w97-titlebar-btn" style={{ ...W97.titlebarBtnStyle, fontWeight: "bold" }}>✕</button>
      </div>

      {/* Tab bar */}
      <div
        style={{
          background:    W97.gray,
          borderBottom:  `1px solid ${W97.grayDark}`,
          display:       "flex",
          padding:       "3px 4px 0",
          gap:           2,
          flexShrink:    0,
        }}
      >
        {([["signin", "🔑 Sign In"], ["signup", "✨ Create Account"]] as [Tab, string][]).map(
          ([t, label]) => (
            <div
              key={t}
              onClick={() => { setTab(t); setError(null); }}
              style={{
                padding:           "3px 12px",
                fontSize:          11,
                fontWeight:        tab === t ? "bold" : "normal",
                background:        tab === t ? W97.gray : "#A0A0A0",
                border:            "2px solid",
                borderTopColor:    tab === t ? "#FFF" : "#808080",
                borderLeftColor:   tab === t ? "#FFF" : "#808080",
                borderBottomColor: tab === t ? W97.gray : "#404040",
                borderRightColor:  tab === t ? "#808080" : "#404040",
                marginBottom:      tab === t ? -2 : 0,
                cursor:            "default",
              }}
            >
              {label}
            </div>
          )
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto w97-scroll" style={{ padding: 12 }}>

        {/* App branding */}
        <div
          style={{
            ...W97.raised,
            padding:       "10px 12px",
            marginBottom:  10,
            display:       "flex",
            alignItems:    "center",
            gap:           10,
          }}
        >
          <span style={{ fontSize: 36, lineHeight: 1 }}>🐾</span>
          <div>
            <p style={{ fontFamily: "VT323, monospace", fontSize: 22, color: "#000080", lineHeight: 1 }}>
              SIT-HERE v1.0
            </p>
            <p style={{ fontSize: 11, color: W97.grayDark }}>
              Drop-In Dog Walking Platform
            </p>
          </div>
        </div>

        {/* Error dialog */}
        {error && (
          <div
            style={{
              ...W97.raised,
              marginBottom: 10,
              padding:      "6px 10px",
              display:      "flex",
              alignItems:   "flex-start",
              gap:          8,
              background:   "#FFFFC0",
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: "bold", fontSize: 12, marginBottom: 2 }}>
                Error
              </p>
              <p style={{ fontSize: 11, color: "#800000" }}>{error}</p>
            </div>
            <button
              className="w97-btn"
              style={{ fontSize: 10, padding: "1px 6px", minHeight: 18, flexShrink: 0 }}
              onClick={() => setError(null)}
            >
              OK
            </button>
          </div>
        )}

        {/* ── SIGN IN TAB ── */}
        {tab === "signin" && (
          <form onSubmit={handleSignIn}>
            <fieldset
              style={{
                border:         "2px solid",
                borderTopColor: "#808080",
                borderLeftColor:"#808080",
                borderBottomColor:"#FFF",
                borderRightColor:"#FFF",
                padding:        "10px 10px 12px",
                marginBottom:   10,
              }}
            >
              <legend style={{ fontWeight: "bold", fontSize: 11, padding: "0 4px" }}>
                Account Details
              </legend>

              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, display: "block", marginBottom: 3 }}>
                  Email Address:
                </label>
                <input
                  className="w97-input"
                  type="email"
                  value={siEmail}
                  onChange={e => setSiEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              <div style={{ marginBottom: 4 }}>
                <label style={{ fontSize: 12, display: "block", marginBottom: 3 }}>
                  Password:
                </label>
                <input
                  className="w97-input"
                  type="password"
                  value={siPassword}
                  onChange={e => setSiPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
            </fieldset>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 5 }}>
              <W97Button
                isDefault
                type="submit"
                disabled={loading}
                style={{ fontWeight: "bold" }}
              >
                {loading ? "⏳ Signing in..." : "🔑 Sign In"}
              </W97Button>
              <W97Button
                type="button"
                onClick={() => { setTab("signup"); setError(null); }}
                disabled={loading}
              >
                Create Account
              </W97Button>
            </div>
          </form>
        )}

        {/* ── CREATE ACCOUNT TAB ── */}
        {tab === "signup" && (
          <form onSubmit={handleSignUp}>
            <fieldset
              style={{
                border:           "2px solid",
                borderTopColor:   "#808080",
                borderLeftColor:  "#808080",
                borderBottomColor:"#FFF",
                borderRightColor: "#FFF",
                padding:          "10px 10px 12px",
                marginBottom:     10,
              }}
            >
              <legend style={{ fontWeight: "bold", fontSize: 11, padding: "0 4px" }}>
                Your Details
              </legend>

              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, display: "block", marginBottom: 3 }}>
                  Full Name:
                </label>
                <input
                  className="w97-input"
                  type="text"
                  value={suName}
                  onChange={e => setSuName(e.target.value)}
                  placeholder="Jane Smith"
                  autoComplete="name"
                  disabled={loading}
                />
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, display: "block", marginBottom: 3 }}>
                  Email Address:
                </label>
                <input
                  className="w97-input"
                  type="email"
                  value={suEmail}
                  onChange={e => setSuEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              <div style={{ marginBottom: 4 }}>
                <label style={{ fontSize: 12, display: "block", marginBottom: 3 }}>
                  Password (min 6 chars):
                </label>
                <input
                  className="w97-input"
                  type="password"
                  value={suPassword}
                  onChange={e => setSuPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
            </fieldset>

            {/* Role picker */}
            <fieldset
              style={{
                border:           "2px solid",
                borderTopColor:   "#808080",
                borderLeftColor:  "#808080",
                borderBottomColor:"#FFF",
                borderRightColor: "#FFF",
                padding:          "8px 10px 10px",
                marginBottom:     10,
              }}
            >
              <legend style={{ fontWeight: "bold", fontSize: 11, padding: "0 4px" }}>
                I am a…
              </legend>
              <div style={{ display: "flex", gap: 6 }}>
                {([
                  { value: "owner",  icon: "🐕", label: "Dog Owner",  desc: "Schedule walks & track your pup" },
                  { value: "walker", icon: "🦮", label: "Dog Walker", desc: "Manage bookings & earn" },
                ] as { value: UserRole; icon: string; label: string; desc: string }[]).map(r => (
                  <button
                    key={r.value}
                    type="button"
                    className="w97-btn"
                    onClick={() => setSuRole(r.value)}
                    disabled={loading}
                    style={{
                      flex:           1,
                      flexDirection:  "column",
                      gap:            3,
                      padding:        "8px 6px",
                      background:     suRole === r.value ? "#000080" : W97.gray,
                      color:          suRole === r.value ? "#FFF" : "#000",
                      outline:        suRole === r.value ? "2px solid #000" : undefined,
                      outlineOffset:  -4,
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{r.icon}</span>
                    <span style={{ fontWeight: "bold", fontSize: 12 }}>{r.label}</span>
                    <span style={{ fontSize: 10, whiteSpace: "normal", textAlign: "center", lineHeight: "12px" }}>
                      {r.desc}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 5 }}>
              <W97Button
                isDefault
                type="submit"
                disabled={loading}
                style={{ fontWeight: "bold" }}
              >
                {loading ? "⏳ Creating account..." : "✨ Create Account"}
              </W97Button>
              <W97Button
                type="button"
                onClick={() => { setTab("signin"); setError(null); }}
                disabled={loading}
              >
                Back to Sign In
              </W97Button>
            </div>
          </form>
        )}

        {/* Demo accounts hint */}
        <div
          style={{
            ...W97.raised,
            marginTop:  10,
            padding:    "6px 8px",
            fontSize:   11,
            color:      W97.grayDark,
            display:    "flex",
            gap:        6,
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
          <span>
            <strong>Beta testers:</strong> Create a free account above — no credit card required.
            Choose <em>Dog Owner</em> to schedule walks, or <em>Dog Walker</em> to manage bookings &amp; submit report cards.
          </span>
        </div>
      </div>

      {/* Status bar */}
      <div
        style={{
          background:  W97.gray,
          borderTop:   `1px solid ${W97.grayDark}`,
          padding:     "2px 4px",
          display:     "flex",
          flexShrink:  0,
          minHeight:   20,
        }}
      >
        <span style={{ ...W97.inset, padding: "0 6px", flex: 1, fontSize: 11, lineHeight: "16px" }}>
          {loading ? "⏳ Connecting to server..." : tab === "signin" ? "Enter your credentials to continue" : "Fill in your details to get started"}
        </span>
      </div>
    </div>
  );
}
