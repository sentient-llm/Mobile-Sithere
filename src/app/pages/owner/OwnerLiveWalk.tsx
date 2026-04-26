/**
 * OwnerLiveWalk — read-only live map for the dog owner.
 *
 * Priority:
 * 1. Poll GET /walk-live-position every 8s for real GPS data posted by walker.
 * 2. If no live data available, fall back to a simulated demo walk.
 *    The simulation is fully local and never touches walkStore.
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import Map, { Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { W97, W97Button } from "../../components/Win97Window";
import { useAuth } from "../../context/AuthContext";
import { apiGet } from "../../lib/api";

const MAP_STYLE  = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const DEFAULT_POS: [number, number] = [-73.9665, 40.7812];

// ── Helpers ────────────────────────────────────────────────────────────────

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
  return pos.reduce((acc, p, i) => i === 0 ? 0 : acc + haversine(pos[i - 1], p), 0);
}

function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function secAgo(updatedMs: number) {
  const d = Math.floor((Date.now() - updatedMs) / 1000);
  if (d < 60)  return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return "a while ago";
}

// ── Component ──────────────────────────────────────────────────────────────

export function OwnerLiveWalk() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Live data from KV ─────────────────────────────────────────────────
  interface LiveData {
    position:   [number, number];
    elapsedMs:  number;
    distance:   number;
    pottyCount: number;
    walkerName: string;
    dogName:    string;
    updatedMs:  number;
  }
  const [liveData,    setLiveData]    = useState<LiveData | null>(null);
  const [liveChecked, setLiveChecked] = useState(false);
  const [, setTick]                   = useState(0);

  // ── Simulated demo path (used when no live data) ───────────────────────
  const [demoPaths,    setDemoPaths]    = useState<[number, number][]>([DEFAULT_POS]);
  const [demoStart,    setDemoStart]    = useState<number | null>(null);
  const [demoRunning,  setDemoRunning]  = useState(false);
  const dirRef = useRef(Math.random() * 2 * Math.PI);

  // ── Map view ─────────────────────────────────────────────────────────
  const [viewState, setViewState] = useState({
    longitude: DEFAULT_POS[0], latitude: DEFAULT_POS[1], zoom: 15.5,
  });

  // ── Poll live position every 8 s ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const data = await apiGet<{ live: LiveData | null }>("/walk-live-position");
        if (cancelled) return;
        if (data.live) {
          setLiveData(data.live);
          setDemoRunning(false); // stop demo when real data arrives
          const pos = data.live.position;
          setViewState(v => ({ ...v, longitude: pos[0], latitude: pos[1] }));
        }
      } catch (e) { console.log("Live position poll:", e); }
      finally { if (!cancelled) setLiveChecked(true); }
    }
    poll();
    const id = setInterval(poll, 8000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // ── Timer tick ────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Demo simulation ───────────────────────────────────────────────────
  useEffect(() => {
    if (!demoRunning) return;
    const id = setInterval(() => {
      setDemoPaths(prev => {
        const last = prev[prev.length - 1];
        dirRef.current += (Math.random() - 0.5) * 0.45;
        const step = 0.00015 + Math.random() * 0.00007;
        const next: [number, number] = [
          last[0] + Math.cos(dirRef.current) * step,
          last[1] + Math.sin(dirRef.current) * step * 0.55,
        ];
        setViewState(v => ({ ...v, longitude: next[0], latitude: next[1] }));
        return [...prev, next];
      });
    }, 2500);
    return () => clearInterval(id);
  }, [demoRunning]);

  // ── Derived values ────────────────────────────────────────────────────
  const isLive      = !!liveData;
  const currentPos: [number, number]  = isLive ? liveData!.position  : (demoPaths[demoPaths.length - 1] ?? DEFAULT_POS);
  const startPos: [number, number]    = isLive ? liveData!.position  : (demoPaths[0] ?? DEFAULT_POS);
  const paths: [number, number][]     = isLive ? [liveData!.position] : demoPaths;
  const walkerName  = liveData?.walkerName ?? "Your walker";
  const dogName     = liveData?.dogName    ?? "your dog";
  const elapsedMs   = isLive
    ? (liveData?.elapsedMs ?? 0)
    : (demoRunning && demoStart ? Date.now() - demoStart : 0);
  const dist        = isLive
    ? (typeof liveData?.distance === "number" ? liveData.distance : 0)
    : totalDist(demoPaths);
  const pottyCount  = isLive ? (liveData?.pottyCount ?? 0) : 0;
  const lastUpdate  = isLive && liveData ? secAgo(liveData.updatedMs) : null;

  const geoPath = {
    type: "Feature" as const,
    geometry: { type: "LineString" as const, coordinates: paths },
    properties: {},
  };

  // ── Waiting state (checked KV, no live walk running yet) ─────────────
  const showWaiting = liveChecked && !isLive && !demoRunning;

  if (showWaiting) {
    return (
      <div className="h-full flex flex-col" style={{ background: W97.gray, fontFamily: W97.font, color: "#000" }}>
        {/* Title Bar */}
        <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, minHeight: 22, flexShrink: 0 }}>
          <span style={{ fontSize: 14 }}>🗺️</span>
          <span style={{ flex: 1, fontWeight: "bold", fontSize: 12 }}>Track Live Walk</span>
          <button className="w97-titlebar-btn" style={{ ...W97.titlebarBtnStyle, fontWeight: "bold" }} onClick={() => navigate("/owner")}>✕</button>
        </div>

        {/* Waiting for walker */}
        <div className="flex-1 flex flex-col items-center justify-center" style={{ padding: 24 }}>
          <div style={{ ...W97.raised, width: "90%", maxWidth: 300, padding: 0, boxShadow: "2px 2px 0 #000" }}>
            <div style={{ background: "#000080", color: "#FFF", padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, minHeight: 22 }}>
              <span>📡</span>
              <span style={{ fontWeight: "bold", fontSize: 12, flex: 1 }}>Waiting for GPS Signal</span>
            </div>
            <div style={{ padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🐕</div>
              <p style={{ fontWeight: "bold", fontSize: 13, marginBottom: 6 }}>No active walk in progress</p>
              <p style={{ fontSize: 11, color: W97.grayDark, marginBottom: 14, lineHeight: 1.5 }}>
                This map goes live when your walker starts their walk. GPS updates appear here every 8 seconds.
              </p>
              <div style={{ display: "flex", gap: 5 }}>
                <W97Button isDefault fullWidth onClick={() => {
                  setDemoRunning(true);
                  setDemoStart(Date.now());
                  setDemoPaths([DEFAULT_POS]);
                }}>
                  🗺️ Demo Walk
                </W97Button>
                <W97Button fullWidth onClick={() => navigate("/owner/chat")}>💬 Ask Walker</W97Button>
              </div>
            </div>
            <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "2px 4px" }}>
              <span style={{ ...W97.inset, padding: "0 6px", fontSize: 11, display: "block", lineHeight: "16px" }}>
                Polling every 8 s… last check: just now
              </span>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "2px 4px", display: "flex", gap: 4, flexShrink: 0, minHeight: 20 }}>
          <span style={{ ...W97.inset, padding: "0 6px", flex: 1, fontSize: 11, lineHeight: "16px" }}>
            ⏳ No live walk detected — waiting for walker to start GPS
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: W97.gray, fontFamily: W97.font, color: "#000" }}>

      {/* Title Bar */}
      <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, minHeight: 22, userSelect: "none", flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>🗺️</span>
        <span style={{ flex: 1, fontWeight: "bold", fontSize: 12 }}>
          Track Live Walk — {dogName}
          {isLive
            ? <span style={{ marginLeft: 8, background: "#FF0000", color: "#FFF", padding: "0 4px", fontSize: 10 }}>● LIVE</span>
            : <span style={{ marginLeft: 8, background: "#808000", color: "#FFF", padding: "0 4px", fontSize: 10 }}>DEMO</span>
          }
        </span>
        <div style={{ display: "flex", gap: 2 }}>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>_</button>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>□</button>
          <button className="w97-titlebar-btn" style={{ ...W97.titlebarBtnStyle, fontWeight: "bold" }} onClick={() => navigate("/owner")}>✕</button>
        </div>
      </div>

      {/* Live info bar */}
      <div style={{ background: "#000080", color: "#FFF", padding: "3px 8px", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <span>
          {isLive
            ? `🔴 LIVE · ${walkerName} is walking ${dogName}${lastUpdate ? ` · Updated ${lastUpdate}` : ""}`
            : "🗺️ Demo simulation — no active walk detected"}
        </span>
        <span style={{ fontFamily: "VT323, monospace", fontSize: 14 }}>{fmtTime(elapsedMs)}</span>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <Map
          {...viewState}
          onMove={e => setViewState(e.viewState)}
          mapStyle={MAP_STYLE}
          style={{ width: "100%", height: "100%" }}
          attributionControl={false}
          reuseMaps
        >
          {paths.length > 1 && (
            <Source id="path" type="geojson" data={geoPath}>
              <Layer id="path-glow" type="line"
                paint={{ "line-color": "#60A5FA", "line-width": 10, "line-opacity": 0.2, "line-blur": 5 }}
                layout={{ "line-cap": "round", "line-join": "round" }} />
              <Layer id="path-line" type="line"
                paint={{ "line-color": "#808080", "line-width": 3, "line-opacity": 0.9 }}
                layout={{ "line-cap": "round", "line-join": "round" }} />
            </Source>
          )}
          <Marker longitude={startPos[0]} latitude={startPos[1]} anchor="center">
            <div style={{ width: 10, height: 10, background: "#008000", border: "2px solid #FFF" }} />
          </Marker>
          <Marker longitude={currentPos[0]} latitude={currentPos[1]} anchor="center">
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isLive && (
                <div style={{ position: "absolute", width: 30, height: 30, background: "rgba(0,0,128,0.25)", animation: "ping 1.2s infinite", borderRadius: 2 }} />
              )}
              <div style={{ width: 24, height: 24, background: "#000080", ...W97.raised, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
                🐕
              </div>
            </div>
          </Marker>
        </Map>

        {/* Walker chip overlay */}
        <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", ...W97.raised, padding: "4px 10px", display: "flex", alignItems: "center", gap: 6, boxShadow: "2px 2px 0 #000" }}>
          <span style={{ fontSize: 18 }}>🦮</span>
          <span style={{ fontSize: 11 }}>
            {walkerName} · {isLive ? "🟢 Live GPS" : "🗺️ Demo"}
          </span>
        </div>
      </div>

      {/* Control panel */}
      <div style={{ background: W97.gray, borderTop: "2px solid #FFF", padding: "4px 6px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
          {[
            { label: "Time",    val: fmtTime(elapsedMs) },
            { label: "Distance",val: `${dist.toFixed(2)} mi` },
            { label: "Potty",   val: `${pottyCount}x` },
          ].map(({ label, val }) => (
            <div key={label} style={{ flex: 1, ...W97.sunken, padding: "3px 4px", textAlign: "center" }}>
              <div style={{ fontFamily: "VT323, monospace", fontSize: 18, color: "#000080", lineHeight: 1 }}>{val}</div>
              <div style={{ fontSize: 9, color: W97.grayDark }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <W97Button isDefault fullWidth onClick={() => navigate("/owner/chat")}>
            💬 Message {walkerName.split(" ")[0]}
          </W97Button>
          <W97Button fullWidth onClick={() => navigate("/owner/report-card")}>📋 Report Card</W97Button>
          <W97Button fullWidth onClick={() => navigate("/owner")}>← Back</W97Button>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "2px 4px", display: "flex", gap: 4, flexShrink: 0, minHeight: 20 }}>
        <span style={{ ...W97.inset, padding: "0 6px", flex: 1, fontSize: 11, lineHeight: "16px" }}>
          {isLive ? `● Live · Updated ${lastUpdate}` : "🗺️ Demo simulation"} · {paths.length} pts · {walkerName}
        </span>
      </div>
    </div>
  );
}
