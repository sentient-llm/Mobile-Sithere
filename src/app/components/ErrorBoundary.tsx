/**
 * Win97 BSOD-style React error boundary.
 * Catches any uncaught render errors and shows a themed crash screen
 * instead of a blank white page.
 */
import React, { type ReactNode } from "react";

interface Props  { children: ReactNode; }
interface State  { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const code    = this.state.error?.name    ?? "UNKNOWN_EXCEPTION";
    const message = this.state.error?.message ?? "An unexpected error occurred.";

    // Convert error name to a fake Win97 STOP code
    const stopCode = code.toUpperCase().replace(/[^A-Z0-9_]/g, "_");

    return (
      <div
        style={{
          width:           "100vw",
          height:          "100vh",
          background:      "#0000AA",
          color:           "#FFFFFF",
          fontFamily:      '"Lucida Console", "Courier New", monospace',
          display:         "flex",
          flexDirection:   "column",
          alignItems:      "center",
          justifyContent:  "center",
          padding:         "24px",
          boxSizing:       "border-box",
          userSelect:      "none",
          overflow:        "hidden",
        }}
      >
        {/* BSOD header */}
        <div style={{ textAlign: "center", marginBottom: 24, maxWidth: 560 }}>
          <div style={{ background: "#AAAAAA", color: "#0000AA", padding: "2px 16px", display: "inline-block", fontWeight: "bold", fontSize: 14, marginBottom: 16 }}>
            Sit-Here v1.0
          </div>

          <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
            A fatal exception <strong style={{ color: "#FFFF55" }}>0x{Math.floor(Math.random() * 0xFFFFFFFF).toString(16).toUpperCase().padStart(8, "0")}</strong> has occurred
            at <strong>sit-here.exe</strong>. The current application will be terminated.
          </p>

          <div style={{ border: "1px solid #FFFFFF", padding: "10px 16px", textAlign: "left", marginBottom: 16, fontSize: 12, lineHeight: 1.8 }}>
            <p>* Press any key to terminate the current application.</p>
            <p>* Press CTRL+ALT+DEL to restart your computer.</p>
            <p>* If you need to use Safe Mode to remove or disable components,</p>
            <p style={{ paddingLeft: 16 }}>restart your computer, press F8 to select Advanced Startup Options, and then select Safe Mode.</p>
          </div>

          {/* STOP code */}
          <p style={{ fontSize: 13, fontWeight: "bold", marginBottom: 8, letterSpacing: 1 }}>
            *** STOP: 0x{Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, "0")} ({stopCode})
          </p>
          <p style={{ fontSize: 12, color: "#AAAAFF", marginBottom: 16, wordBreak: "break-all" }}>
            {message.slice(0, 120)}
          </p>

          {/* Restart button */}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop:        8,
              padding:          "6px 24px",
              background:       "#AAAAAA",
              color:            "#000000",
              border:           "2px solid",
              borderTopColor:   "#FFFFFF",
              borderLeftColor:  "#FFFFFF",
              borderBottomColor:"#404040",
              borderRightColor: "#404040",
              fontFamily:       '"MS Sans Serif", Tahoma, sans-serif',
              fontSize:         12,
              cursor:           "pointer",
              fontWeight:       "bold",
            }}
          >
            🔄 Restart Sit-Here
          </button>
        </div>

        {/* Blinking cursor */}
        <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", fontSize: 14 }}>
          Press any key to continue_ <span style={{ animation: "blink 1s step-end infinite" }}>█</span>
        </div>

        <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
      </div>
    );
  }
}
