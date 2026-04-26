import { ReactNode, CSSProperties } from "react";

// ─── Shared Win97 style constants ──────────────────────────────────────────
export const W97 = {
  font: '"MS Sans Serif", Tahoma, Arial, sans-serif' as CSSProperties["fontFamily"],
  gray:     "#C0C0C0",
  grayLight:"#DFDFDF",
  grayDark: "#808080",
  navy:     "#000080",
  teal:     "#008080",
  black:    "#000000",
  white:    "#FFFFFF",

  // Inline style helpers
  raised: {
    borderStyle:       "solid",
    borderWidth:       2,
    borderTopColor:    "#FFFFFF",
    borderLeftColor:   "#FFFFFF",
    borderBottomColor: "#808080",
    borderRightColor:  "#808080",
    background:        "#C0C0C0",
  } as CSSProperties,

  pressed: {
    borderStyle:       "solid",
    borderWidth:       2,
    borderTopColor:    "#808080",
    borderLeftColor:   "#808080",
    borderBottomColor: "#FFFFFF",
    borderRightColor:  "#FFFFFF",
    background:        "#C0C0C0",
  } as CSSProperties,

  sunken: {
    borderStyle:       "solid",
    borderWidth:       2,
    borderTopColor:    "#808080",
    borderLeftColor:   "#808080",
    borderBottomColor: "#FFFFFF",
    borderRightColor:  "#FFFFFF",
    background:        "#FFFFFF",
  } as CSSProperties,

  inset: {
    borderStyle:       "solid",
    borderWidth:       1,
    borderTopColor:    "#808080",
    borderLeftColor:   "#808080",
    borderBottomColor: "#FFFFFF",
    borderRightColor:  "#FFFFFF",
  } as CSSProperties,

  titlebarGrad: "linear-gradient(90deg, #000080 0%, #1084D0 100%)",

  titlebarBtnStyle: {
    background:        "#C0C0C0",
    borderStyle:       "solid",
    borderWidth:       2,
    borderTopColor:    "#FFFFFF",
    borderLeftColor:   "#FFFFFF",
    borderBottomColor: "#808080",
    borderRightColor:  "#808080",
    width:             18,
    height:            16,
    display:           "flex",
    alignItems:        "center",
    justifyContent:    "center",
    fontSize:          9,
    fontWeight:        "bold",
    color:             "#000000",
    cursor:            "default",
    flexShrink:        0,
    padding:           0,
    lineHeight:        "1",
    userSelect:        "none",
  } as CSSProperties,
};

// ─── Win97 reusable button ─────────────────────────────────────────────────
interface W97BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isDefault?: boolean;
  danger?: boolean;
  fullWidth?: boolean;
  small?: boolean;
}

export function W97Button({
  isDefault, danger, fullWidth, small, className = "", style, children, ...rest
}: W97BtnProps) {
  return (
    <button
      className={`w97-btn${isDefault ? " w97-btn-default" : ""}${danger ? " w97-btn-danger" : ""} ${className}`}
      style={{ width: fullWidth ? "100%" : undefined, fontSize: small ? 11 : 12, ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}

// ─── Win97 Window wrapper ──────────────────────────────────────────────────
interface Win97WindowProps {
  title:        string;
  icon?:        string;
  children:     ReactNode;
  onClose?:     () => void;
  menuItems?:   string[];
  statusText?:  string;
  /** If false, content area does NOT scroll (use for pages with custom scroll) */
  scrollable?:  boolean;
  /** Extra content rendered between status bar and taskbar (e.g. fixed input) */
  bottomExtra?: ReactNode;
}

export function Win97Window({
  title,
  icon,
  children,
  onClose,
  menuItems,
  statusText = "Ready",
  scrollable = true,
  bottomExtra,
}: Win97WindowProps) {
  return (
    <div
      className="h-full flex flex-col w97"
      style={{ background: W97.gray, fontFamily: W97.font, fontSize: 12, color: "#000" }}
    >
      {/* ── Title Bar ── */}
      <div
        style={{
          background:   W97.titlebarGrad,
          color:        "#FFFFFF",
          padding:      "3px 4px 3px 6px",
          display:      "flex",
          alignItems:   "center",
          gap:          4,
          userSelect:   "none",
          flexShrink:   0,
          minHeight:    22,
        }}
      >
        {icon && <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>}
        <span
          style={{
            flex:         1,
            fontWeight:   "bold",
            fontSize:     12,
            whiteSpace:   "nowrap",
            overflow:     "hidden",
            textOverflow: "ellipsis",
            fontFamily:   W97.font,
          }}
        >
          {title}
        </span>
        <div style={{ display: "flex", gap: 2 }}>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>_</button>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>□</button>
          <button
            className="w97-titlebar-btn"
            style={{ ...W97.titlebarBtnStyle, fontWeight: "bold" }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Menu Bar ── */}
      {menuItems && menuItems.length > 0 && (
        <div
          style={{
            background:   W97.gray,
            borderBottom: `1px solid ${W97.grayDark}`,
            display:      "flex",
            alignItems:   "center",
            padding:      "1px 2px",
            flexShrink:   0,
            minHeight:    20,
          }}
        >
          {menuItems.map((item) => (
            <span
              key={item}
              className="w97-menuitem"
              style={{
                padding:    "2px 6px",
                fontSize:   11,
                cursor:     "default",
                fontFamily: W97.font,
                color:      "#000",
              }}
            >
              <u style={{ textDecorationSkipInk: "none" }}>{item[0]}</u>
              {item.slice(1)}
            </span>
          ))}
        </div>
      )}

      {/* ── Scrollable Content ── */}
      <div
        className={`flex-1 min-h-0 w97-scroll ${scrollable ? "overflow-y-auto" : "overflow-hidden"}`}
        style={{ overflowX: "hidden" }}
      >
        {children}
      </div>

      {/* ── Extra bottom slot (e.g. chat input) ── */}
      {bottomExtra}

      {/* ── Status Bar ── */}
      <div
        style={{
          background:  W97.gray,
          borderTop:   `1px solid ${W97.grayDark}`,
          padding:     "2px 4px",
          display:     "flex",
          alignItems:  "center",
          gap:         4,
          flexShrink:  0,
          minHeight:   20,
        }}
      >
        <span
          style={{
            ...W97.inset,
            padding:    "0 6px",
            fontSize:   11,
            flex:       1,
            fontFamily: W97.font,
            lineHeight: "16px",
          }}
        >
          {statusText}
        </span>
      </div>
    </div>
  );
}
