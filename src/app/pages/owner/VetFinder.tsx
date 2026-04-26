import { useState } from "react";
import { useNavigate } from "react-router";
import { W97, W97Button } from "../../components/Win97Window";
import { VETS } from "../../data/mockData";

export function VetFinder() {
  const navigate = useNavigate();
  const [filter,      setFilter]      = useState<"all" | "emergency">("all");
  const [selectedVet, setSelectedVet] = useState<string | null>(null);
  const [search,      setSearch]      = useState("");

  const filtered = VETS
    .filter(v => filter === "emergency" ? v.emergency : true)
    .filter(v => v.name.toLowerCase().includes(search.toLowerCase()) || v.address.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-full flex flex-col" style={{ background: W97.gray, fontFamily: W97.font, color: "#000" }}>

      {/* Title Bar */}
      <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, minHeight: 22, userSelect: "none", flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>🏥</span>
        <span style={{ flex: 1, fontWeight: "bold", fontSize: 12 }}>VetSearch v1.0 — Emergency Vet Finder</span>
        <div style={{ display: "flex", gap: 2 }}>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>_</button>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>□</button>
          <button className="w97-titlebar-btn" style={{ ...W97.titlebarBtnStyle, fontWeight: "bold" }} onClick={() => navigate("/owner")}>✕</button>
        </div>
      </div>

      {/* Menu bar */}
      <div style={{ background: W97.gray, borderBottom: `1px solid ${W97.grayDark}`, display: "flex", padding: "1px 2px", flexShrink: 0, minHeight: 20 }}>
        {["File", "View", "Emergency", "Help"].map(item => (
          <span key={item} className="w97-menuitem" style={{ padding: "2px 6px", fontSize: 11, cursor: "default", fontFamily: W97.font }}>
            <u>{item[0]}</u>{item.slice(1)}
          </span>
        ))}
      </div>

      {/* Emergency dialog */}
      <div style={{ margin: "6px 6px 0", ...W97.raised, padding: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 24 }}>🚨</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: "bold", fontSize: 12, color: "#800000" }}>EMERGENCY? Call the nearest 24/7 vet immediately!</p>
            <p style={{ fontSize: 11 }}>Pawsome Animal Hospital · (555) 123-4567 · 0.4 mi</p>
          </div>
          <a href="tel:5551234567" style={{ textDecoration: "none" }}>
            <W97Button danger style={{ fontWeight: "bold", fontSize: 12 }}>
              📞 Call Now!
            </W97Button>
          </a>
        </div>
      </div>

      {/* Search + Filter Toolbar */}
      <div style={{ background: W97.gray, borderBottom: `1px solid ${W97.grayDark}`, padding: "4px 6px", display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 11 }}>Search:</span>
        <input
          className="w97-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Type vet name or address..."
          style={{ flex: 1 }}
        />
        <W97Button small onClick={() => setFilter("all")} style={{ background: filter === "all" ? "#000080" : W97.gray, color: filter === "all" ? "#FFF" : "#000" }}>
          All ({VETS.length})
        </W97Button>
        <W97Button small onClick={() => setFilter("emergency")} style={{ background: filter === "emergency" ? "#000080" : W97.gray, color: filter === "emergency" ? "#FFF" : "#800000" }}>
          🚨 24/7 Only
        </W97Button>
      </div>

      {/* Column headers */}
      <div style={{ background: "#A0A0A0", display: "flex", padding: "2px 6px", fontSize: 11, fontWeight: "bold", borderBottom: `1px solid ${W97.grayDark}`, flexShrink: 0 }}>
        <span style={{ flex: "0 0 24px" }} />
        <span style={{ flex: 3 }}>Name</span>
        <span style={{ flex: 2 }}>Address</span>
        <span style={{ flex: 2 }}>Hours</span>
        <span style={{ flex: 1, textAlign: "right" }}>Distance</span>
        <span style={{ flex: 1, textAlign: "right" }}>Rating</span>
      </div>

      {/* List view */}
      <div className="flex-1 overflow-y-auto w97-scroll" style={{ ...W97.sunken, margin: "0 6px 4px", background: "#FFF" }}>
        {filtered.map((vet, i) => (
          <div key={vet.id}>
            <div
              className="w97-list-row"
              onClick={() => setSelectedVet(selectedVet === vet.id ? null : vet.id)}
              style={{
                background:   selectedVet === vet.id ? "#000080" : i % 2 === 0 ? "#FFF" : "#DFDFDF",
                color:        selectedVet === vet.id ? "#FFF" : "#000",
                display:      "flex",
                alignItems:   "center",
                padding:      "4px 6px",
                cursor:       "default",
                whiteSpace:   "normal",
              }}
            >
              <span style={{ flex: "0 0 24px", fontSize: 16 }}>{vet.emergency ? "🚑" : "🏥"}</span>
              <span style={{ flex: 3, fontWeight: vet.emergency ? "bold" : "normal" }}>
                {vet.name}{vet.emergency && <span style={{ marginLeft: 4, fontSize: 10, background: "#800000", color: "#FFF", padding: "0 3px" }}>24/7</span>}
              </span>
              <span style={{ flex: 2, fontSize: 11 }}>📍 {vet.address}</span>
              <span style={{ flex: 2, fontSize: 11 }}>🕐 {vet.hours}</span>
              <span style={{ flex: 1, textAlign: "right", fontWeight: "bold", color: selectedVet === vet.id ? "#FFF" : "#000080" }}>{vet.distance}</span>
              <span style={{ flex: 1, textAlign: "right", fontSize: 11 }}>⭐ {vet.rating}</span>
            </div>

            {/* Expanded row */}
            {selectedVet === vet.id && (
              <div style={{ background: "#FFFFC0", padding: "6px 8px", borderBottom: `1px solid ${W97.grayDark}`, display: "flex", gap: 5 }}>
                <a href={`tel:${vet.phone.replace(/\D/g, "")}`} style={{ textDecoration: "none" }}>
                  <W97Button danger style={{ fontWeight: "bold" }}>📞 {vet.phone}</W97Button>
                </a>
                <W97Button onClick={() => {}}>🗺️ Get Directions</W97Button>
                <W97Button onClick={() => {}}>📋 Save to My Vets</W97Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tip */}
      <div style={{ margin: "0 6px 4px", ...W97.raised, padding: "5px 8px", display: "flex", gap: 6, alignItems: "flex-start" }}>
        <span style={{ fontSize: 16 }}>💡</span>
        <p style={{ fontSize: 11, color: "#000080" }}>
          <strong>Tip:</strong> Save your vet's number so your walker can contact them directly in an emergency.
        </p>
      </div>

      {/* Status bar */}
      <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "2px 4px", display: "flex", flexShrink: 0, minHeight: 20 }}>
        <span style={{ ...W97.inset, padding: "0 6px", flex: 1, fontSize: 11, lineHeight: "16px" }}>
          {VETS.filter(v => v.emergency).length} emergency vets available 24/7
        </span>
      </div>

    </div>
  );
}