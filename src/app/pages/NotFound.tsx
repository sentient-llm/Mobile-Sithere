import { useNavigate, useLocation } from "react-router";
import { W97, W97Button } from "../components/Win97Window";

export function NotFound() {
  const navigate  = useNavigate();
  const location  = useLocation();

  return (
    <div
      className="h-full flex flex-col items-center justify-center"
      style={{ background: W97.teal, fontFamily: W97.font }}
    >
      {/* BSOD-style error dialog */}
      <div
        style={{
          ...W97.raised,
          width: "85%",
          maxWidth: 340,
          boxShadow: "3px 3px 0 #000",
        }}
      >
        {/* Title bar */}
        <div
          style={{
            background: W97.titlebarGrad,
            color: "#FFF",
            padding: "3px 6px",
            display: "flex",
            alignItems: "center",
            gap: 4,
            minHeight: 22,
          }}
        >
          <span>⚠️</span>
          <span style={{ fontWeight: "bold", fontSize: 12, flex: 1 }}>
            Sit-Here — Page Not Found
          </span>
          <button
            className="w97-titlebar-btn"
            style={W97.titlebarBtnStyle}
            onClick={() => navigate("/")}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 16px", background: W97.gray }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
            <span style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>🐕❓</span>
            <div>
              <p style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>
                Error 404 — Page Not Found
              </p>
              <p style={{ fontSize: 11, color: "#000080", lineHeight: 1.5 }}>
                The page{" "}
                <span
                  style={{
                    fontFamily: "VT323, monospace",
                    fontSize: 13,
                    color: "#800000",
                  }}
                >
                  {location.pathname}
                </span>{" "}
                does not exist. Max sniffed everywhere but couldn't find it.
              </p>
            </div>
          </div>

          {/* Sunken details panel */}
          <div
            style={{
              ...W97.sunken,
              padding: "6px 8px",
              marginBottom: 14,
              fontFamily: "VT323, monospace",
              fontSize: 13,
              color: "#800000",
              lineHeight: 1.6,
            }}
          >
            KERNEL_DOG_FETCH_FAILED (0x00000404)<br />
            at Sit-Here.exe :: RouteResolver<br />
            A required component was not found.
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <W97Button isDefault onClick={() => navigate("/")}>
              🐾 Go Home
            </W97Button>
            <W97Button onClick={() => navigate("/owner")}>
              🐕 Dog Owner
            </W97Button>
            <W97Button onClick={() => navigate("/walker")}>
              🦮 Dog Walker
            </W97Button>
          </div>
        </div>

        {/* Status bar */}
        <div
          style={{
            background: W97.gray,
            borderTop: `1px solid ${W97.grayDark}`,
            padding: "2px 6px",
          }}
        >
          <span
            style={{
              ...W97.inset,
              padding: "0 6px",
              fontSize: 11,
              display: "block",
              lineHeight: "16px",
            }}
          >
            HTTP 404 · Route not registered in routes.tsx
          </span>
        </div>
      </div>
    </div>
  );
}
