import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { W97, W97Button } from "../../components/Win97Window";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { projectId } from "/utils/supabase/info";
import { walkStore } from "../../data/walkStore";

// Haversine distance for [lng, lat] tuples (same format as walkStore.positions)
function haversine(a: [number, number], b: [number, number]): number {
  const R = 3959;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const sa = Math.sin(dLat / 2), sb = Math.sin(dLon / 2);
  return R * 2 * Math.atan2(
    Math.sqrt(sa*sa + Math.cos(a[1]*Math.PI/180)*Math.cos(b[1]*Math.PI/180)*sb*sb),
    Math.sqrt(1 - (sa*sa + Math.cos(a[1]*Math.PI/180)*Math.cos(b[1]*Math.PI/180)*sb*sb))
  );
}
function totalDist(pos: [number, number][]) {
  return pos.reduce((acc, p, i) => i === 0 ? 0 : acc + haversine(pos[i-1], p), 0);
}

const MOODS = [
  { emoji: "😄", label: "Super Happy" },
  { emoji: "😊", label: "Happy" },
  { emoji: "😐", label: "Neutral" },
  { emoji: "😴", label: "Tired" },
  { emoji: "😰", label: "Anxious" },
];

function GroupBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset style={{ border: "2px solid", borderTopColor: "#808080", borderLeftColor: "#808080", borderBottomColor: "#FFF", borderRightColor: "#FFF", padding: "8px", background: W97.gray, margin: "0 0 8px 0" }}>
      <legend style={{ fontFamily: W97.font, fontSize: 11, fontWeight: "bold", padding: "0 4px" }}>{label}</legend>
      {children}
    </fieldset>
  );
}

export function WalkerReportCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const walkerLabel = user?.name ?? "Walker";
  const walk = walkStore.getSnapshot();
  const dogLabel   = walk.dogName   || "Max";
  const ownerLabel = walk.ownerName || "Dog Owner";
  const [mood,       setMood]       = useState<string | null>(null);
  const [peeCount,   setPeeCount]   = useState(0);
  const [poopCount,  setPoopCount]  = useState(0);
  const [ate,        setAte]        = useState(false);
  const [drank,      setDrank]      = useState(false);
  const [energy,     setEnergy]     = useState<string | null>(null);
  const [notes,      setNotes]      = useState("");
  const [rating,     setRating]     = useState(0);
  const [submitted,  setSubmitted]  = useState(false);
  const [photoAdded, setPhotoAdded] = useState(false);

  async function handleSubmit() {
    if (!mood) return;
    setSubmitted(true);

    // Save report to KV via server — ownerId MUST be included for dual-write
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const dist    = totalDist(walk.positions);
        const elapsed = walkStore.getElapsedMs();
        const mins    = Math.floor(elapsed / 60000);
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-f29bc816/reports`,
          {
            method:  "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
            body: JSON.stringify({
              dogName:    dogLabel,
              ownerName:  ownerLabel,
              ownerId:    walk.ownerId,      // ← critical: enables dual-write so owner sees report
              bookingId:  walk.bookingId,
              mood, peeCount, poopCount, ate, drank,
              energy:     energy ?? "Medium",
              notes:      notes.trim(),
              rating,
              photoCount: photoAdded ? 1 : 0,
              duration:   `${mins || 32} min`,
              distance:   `${dist > 0.01 ? dist.toFixed(2) : "1.40"} mi`,
              walkerName: walkerLabel,
            }),
          }
        );
      }
    } catch (e) {
      console.error("Failed to save report:", e);
    }

    setTimeout(() => navigate("/walker"), 2500);
  }

  if (submitted) {
    return (
      <div className="h-full flex flex-col items-center justify-center" style={{ background: W97.teal, fontFamily: W97.font }}>
        <div style={{ ...W97.raised, width: "80%", maxWidth: 320, boxShadow: "2px 2px 0 #000" }}>
          <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, minHeight: 22 }}>
            <span>📋</span>
            <span style={{ fontWeight: "bold", fontSize: 12, fontFamily: W97.font, flex: 1 }}>Report Sent!</span>
          </div>
          <div style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🐾</div>
            <p style={{ fontWeight: "bold", fontSize: 14, marginBottom: 4 }}>Report Card Sent!</p>
            <p style={{ fontSize: 11, color: "#000080", marginBottom: 12 }}>
              {ownerLabel} has been notified about {dogLabel}'s walk 🐕
            </p>
            <p style={{ fontFamily: "VT323, monospace", fontSize: 13, color: W97.grayDark }}>
              Returning to dashboard...
            </p>
          </div>
          <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "2px 4px" }}>
            <span style={{ ...W97.inset, padding: "0 6px", fontSize: 11, display: "block", lineHeight: "16px" }}>Report saved to cloud ✓</span>
          </div>
        </div>
      </div>
    );
  }

  const NOTES_MAX = 500;

  const statusMsg =
    submitted ? "Report card submitted successfully" :
    !mood      ? `⚠ Mood is required — how is ${dogLabel} feeling?` :
                 `Fill in ${dogLabel}'s walk details and submit · ${notes.length}/${NOTES_MAX} chars`;

  return (
    <div className="h-full flex flex-col" style={{ background: W97.gray, fontFamily: W97.font, color: "#000" }}>

      {/* Title Bar */}
      <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, minHeight: 22, userSelect: "none", flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>📋</span>
        <span style={{ flex: 1, fontWeight: "bold", fontSize: 12 }}>Submit Walk Report — {dogLabel} · {ownerLabel}</span>
        <div style={{ display: "flex", gap: 2 }}>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>_</button>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>□</button>
          <button className="w97-titlebar-btn" style={{ ...W97.titlebarBtnStyle, fontWeight: "bold" }} onClick={() => navigate("/walker")}>✕</button>
        </div>
      </div>

      {/* Dog info header */}
      <div style={{ ...W97.raised, margin: "4px 6px 0", padding: "6px 8px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <img
          src="https://images.unsplash.com/photo-1714247084434-49bbc3ebf577?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200"
          alt={dogLabel}
          style={{ width: 40, height: 40, objectFit: "cover", ...W97.raised }}
        />
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: "bold", fontSize: 13 }}>{dogLabel} — Golden Retriever · 3 yrs</p>
          <p style={{ fontSize: 11 }}>Owner: {ownerLabel}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontFamily: "VT323, monospace", fontSize: 20, color: "#006400" }}>COMPLETE</p>
          <p style={{ fontSize: 11 }}>32 min · 1.4 mi</p>
        </div>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto w97-scroll" style={{ padding: "6px 6px 0" }}>

        {/* Mood */}
        <GroupBox label="Mood (required *)">
          <div style={{ display: "flex", gap: 3 }}>
            {MOODS.map(m => (
              <button key={m.emoji} className="w97-btn" onClick={() => setMood(m.emoji)}
                style={{ flex: 1, flexDirection: "column", gap: 2, padding: "5px 2px", background: mood === m.emoji ? "#000080" : W97.gray, color: mood === m.emoji ? "#FFF" : "#000" }}>
                <span style={{ fontSize: 18 }}>{m.emoji}</span>
                <span style={{ fontSize: 9 }}>{m.label}</span>
              </button>
            ))}
          </div>
          {!mood && (
            <p style={{ fontSize: 10, color: "#800000", marginTop: 4, fontStyle: "italic" }}>
              ← Required: tap a mood before submitting
            </p>
          )}
        </GroupBox>

        {/* Potty breaks */}
        <GroupBox label="Potty Breaks">
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "💧 Pee", count: peeCount, setCount: setPeeCount },
              { label: "💩 Poop", count: poopCount, setCount: setPoopCount },
            ].map(({ label, count, setCount }) => (
              <div key={label} style={{ flex: 1, ...W97.sunken, padding: "6px 8px", textAlign: "center" }}>
                <p style={{ fontSize: 12, marginBottom: 6 }}>{label}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <W97Button small onClick={() => setCount(Math.max(0, count - 1))} style={{ width: 26, height: 22, padding: 0 }}>−</W97Button>
                  <span style={{ flex: 1, fontFamily: "VT323, monospace", fontSize: 28, color: "#000080", textAlign: "center" }}>{count}</span>
                  <W97Button small onClick={() => setCount(count + 1)} style={{ width: 26, height: 22, padding: 0 }}>+</W97Button>
                </div>
              </div>
            ))}
          </div>
        </GroupBox>

        {/* Food & Water */}
        <GroupBox label="Food & Water">
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { label: "🍖 Ate food",   state: ate,   setState: setAte   },
              { label: "💧 Drank water", state: drank, setState: setDrank },
            ].map(({ label, state, setState }) => (
              <button key={label} className="w97-btn" onClick={() => setState(!state)}
                style={{ flex: 1, background: state ? "#000080" : W97.gray, color: state ? "#FFF" : "#000", padding: "6px", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 20 }}>{label.split(" ")[0]}</span>
                <span style={{ fontSize: 11 }}>{label.split(" ").slice(1).join(" ")}</span>
                <span style={{ fontSize: 10 }}>{state ? "✓ Yes" : "No"}</span>
              </button>
            ))}
          </div>
        </GroupBox>

        {/* Energy */}
        <GroupBox label="Energy Level">
          <div style={{ display: "flex", gap: 3 }}>
            {["Low", "Medium", "High", "Wild! 🤪"].map(e => (
              <button key={e} className="w97-btn" onClick={() => setEnergy(e)}
                style={{ flex: 1, background: energy === e ? "#000080" : W97.gray, color: energy === e ? "#FFF" : "#000", fontSize: 11 }}>
                {e}
              </button>
            ))}
          </div>
        </GroupBox>

        {/* Photos */}
        <GroupBox label="Walk Photos">
          <div style={{ display: "flex", gap: 6 }}>
            {photoAdded && (
              <img
                src="https://images.unsplash.com/photo-1714247084434-49bbc3ebf577?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200"
                alt="Walk"
                style={{ width: 64, height: 64, objectFit: "cover", ...W97.raised }}
              />
            )}
            <button
              className="w97-btn"
              onClick={() => setPhotoAdded(true)}
              style={{ width: 64, height: 64, padding: 0, flexDirection: "column", gap: 2, fontSize: 11, border: "2px dashed #808080" }}
            >
              <span>📷</span>
              <span style={{ fontSize: 9 }}>{photoAdded ? "Add More" : "Add Photo"}</span>
            </button>
          </div>
        </GroupBox>

        {/* Notes */}
        <GroupBox label="Walker Notes">
          <textarea
            className="w97-input"
            value={notes}
            onChange={e => setNotes(e.target.value.slice(0, NOTES_MAX))}
            placeholder="Share anything from the walk — behavior, new friends, favorite spots..."
            rows={4}
            style={{ width: "100%", resize: "vertical", fontFamily: W97.font, fontSize: 12 }}
            maxLength={NOTES_MAX}
          />
          <p style={{ fontSize: 10, color: notes.length >= NOTES_MAX ? "#800000" : W97.grayDark, textAlign: "right", marginTop: 2 }}>
            {notes.length}/{NOTES_MAX}{notes.length >= NOTES_MAX ? " — limit reached" : ""}
          </p>
        </GroupBox>

        {/* Rate client */}
        <GroupBox label={`Rate this Client — ${ownerLabel}`}>
          <p style={{ fontSize: 11, marginBottom: 6 }}>How was your experience with {dogLabel} &amp; {ownerLabel.split(" ")[0]}?</p>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} className="w97-btn" onClick={() => setRating(s)}
                style={{ flex: 1, fontSize: 20, padding: "4px", background: s <= rating ? "#000080" : W97.gray, color: s <= rating ? "#FFF" : "#000" }}>
                ⭐
              </button>
            ))}
          </div>
        </GroupBox>

        <div style={{ height: 6 }} />
      </div>

      {/* Action buttons */}
      <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "5px 8px", display: "flex", justifyContent: "flex-end", gap: 5, flexShrink: 0 }}>
        <W97Button isDefault onClick={handleSubmit} disabled={!mood} style={{ fontWeight: "bold" }}>
          📤 Send Report Card to {ownerLabel.split(" ")[0]}
        </W97Button>
        <W97Button onClick={() => navigate("/walker")}>Cancel</W97Button>
      </div>

      {/* Status bar */}
      <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "2px 4px", display: "flex", flexShrink: 0, minHeight: 20 }}>
        <span style={{ ...W97.inset, padding: "0 6px", flex: 1, fontSize: 11, lineHeight: "16px", color: !mood && !submitted ? "#800000" : "#000" }}>
          {statusMsg}
        </span>
      </div>

    </div>
  );
}