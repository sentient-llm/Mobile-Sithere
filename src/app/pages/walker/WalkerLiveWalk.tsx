import { useState, useEffect, useRef, useSyncExternalStore, useCallback } from "react";
import { useNavigate } from "react-router";
import Map, { Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { W97, W97Button } from "../../components/Win97Window";
import { walkStore } from "../../data/walkStore";
import { useAuth } from "../../context/AuthContext";
import { apiPost, apiPut } from "../../lib/api";

const MAP_STYLE  = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const DEFAULT_POS: [number, number] = [-73.9665, 40.7812]; // Central Park fallback

// ── Utilities ──────────────────────────────────────────────────────────────

function haversine(a: [number, number], b: [number, number]): number {
  const R = 3959;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const sa = Math.sin(dLat / 2), sb = Math.sin(dLon / 2);
  return R * 2 * Math.atan2(
    Math.sqrt(sa * sa + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * sb * sb),
    Math.sqrt(1 - (sa * sa + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * sb * sb))
  );
}

function totalDist(pos: [number, number][]) {
  return pos.reduce((acc, p, i) => i === 0 ? 0 : acc + haversine(pos[i - 1], p), 0);
}

function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ── Screen Wake Lock (keeps screen on during walk) ─────────────────────────

function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    if (active) {
      navigator.wakeLock.request("screen").then(lock => {
        lockRef.current = lock;
      }).catch(() => { /* permission denied or not supported */ });
    } else {
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    }
    return () => {
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}

// ── Geolocation states ─────────────────────────────────────────────────────

type GeoState = "requesting" | "granted" | "denied" | "unavailable";

// ── Component ──────────────────────────────────────────────────────────────

export function WalkerLiveWalk() {
  const navigate  = useNavigate();
  const walk      = useSyncExternalStore(walkStore.subscribe, walkStore.getSnapshot);
  const { user }  = useAuth();
  const [, setTick]     = useState(0);
  const dirRef          = useRef(Math.random() * 2 * Math.PI);
  const [geoState, setGeoState] = useState<GeoState>("requesting");
  const [viewState, setViewState] = useState({
    longitude: DEFAULT_POS[0],
    latitude:  DEFAULT_POS[1],
    zoom:      16,
  });

  // Screen wake lock — active while walk is running
  useWakeLock(walk.status === "active");

  // ── On mount: request geolocation & inject auth names ────────────────────
  useEffect(() => {
    walkStore.reset();
    // Inject the authenticated walker's name
    if (user?.name) {
      walkStore.update({ walkerName: user.name });
    }

    if (!navigator.geolocation) {
      setGeoState("unavailable");
      walkStore.update({ positions: [DEFAULT_POS] });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (p) => {
        const c: [number, number] = [p.coords.longitude, p.coords.latitude];
        walkStore.update({ positions: [c] });
        setViewState(v => ({ ...v, longitude: c[0], latitude: c[1] }));
        setGeoState("granted");
      },
      (err) => {
        console.log("Geolocation error:", err.code, err.message);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoState("denied");
        } else {
          // Timeout or position unavailable — use fallback but don't block
          setGeoState("granted");
        }
        walkStore.update({ positions: [DEFAULT_POS] });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, []);

  // ── Real geolocation watch during active walk ─────────────────────────────
  useEffect(() => {
    if (walk.status !== "active" || !navigator.geolocation || geoState === "denied") return;

    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        const c: [number, number] = [p.coords.longitude, p.coords.latitude];
        const snap = walkStore.getSnapshot();
        walkStore.update({ positions: [...snap.positions, c] });
        setViewState(v => ({ ...v, longitude: c[0], latitude: c[1] }));
      },
      (err) => console.log("Watch position error:", err.message),
      { enableHighAccuracy: true, maximumAge: 3000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [walk.status, geoState]);

  // ── Simulated GPS movement (fallback / demo when geo is denied/unavailable) ──
  useEffect(() => {
    if (walk.status !== "active") return;
    // Simulation runs alongside real GPS — provides movement even without permission
    const id = setInterval(() => {
      if (geoState === "granted") return; // real GPS is tracking, skip simulation
      const snap = walkStore.getSnapshot();
      if (!snap.positions.length) return;
      const last = snap.positions[snap.positions.length - 1];
      dirRef.current += (Math.random() - 0.5) * 0.5;
      const step = 0.00016 + Math.random() * 0.00008;
      const next: [number, number] = [
        last[0] + Math.cos(dirRef.current) * step,
        last[1] + Math.sin(dirRef.current) * step * 0.55,
      ];
      walkStore.update({ positions: [...snap.positions, next] });
      setViewState(v => ({ ...v, longitude: next[0], latitude: next[1] }));
    }, 2500);
    return () => clearInterval(id);
  }, [walk.status, geoState]);

  // ── Timer tick ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (walk.status !== "active") return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [walk.status]);

  // ── Post live GPS position to KV every 30s (owner can poll it) ────────────
  useEffect(() => {
    if (walk.status !== "active" || !walk.ownerId) return;
    const post = () => {
      const snap = walkStore.getSnapshot();
      const pos  = snap.positions[snap.positions.length - 1];
      if (!pos) return;
      apiPost("/walk-live-position", {
        ownerId:    snap.ownerId,
        position:   pos,
        elapsedMs:  walkStore.getElapsedMs(),
        distance:   totalDist(snap.positions),
        pottyCount: snap.pottyCount,
        walkerName: snap.walkerName,
        dogName:    snap.dogName,
      }).catch(e => console.log("Live position post:", e));
    };
    post(); // post immediately on start
    const id = setInterval(post, 30000);
    return () => clearInterval(id);
  }, [walk.status, walk.ownerId]);

  // ── Controls ─────────────────────────────────────────────────────────────
  const handleStart  = useCallback(() => walkStore.update({ status: "active",  startTime: Date.now() }), []);
  const handlePause  = useCallback(() => walkStore.update({ status: "paused",  pausedAt: Date.now()  }), []);
  const handleResume = useCallback(() => {
    const s = walkStore.getSnapshot();
    walkStore.update({ status: "active", pausedAt: null, totalPausedMs: s.totalPausedMs + (s.pausedAt ? Date.now() - s.pausedAt : 0) });
  }, []);
  const handleEnd = useCallback(async () => {
    walkStore.update({ status: "ended" });
    const snap = walkStore.getSnapshot();

    // Save walk session summary to KV
    try {
      const elapsedMs = walkStore.getElapsedMs();
      const mins      = Math.floor(elapsedMs / 60000);
      const dist      = totalDist(snap.positions);
      await apiPost("/walk-session", {
        dogName:    snap.dogName,
        ownerName:  snap.ownerName,
        ownerId:    snap.ownerId,
        bookingId:  snap.bookingId,
        duration:   `${mins} min`,
        distance:   `${dist.toFixed(2)} mi`,
        positions:  snap.positions.length,
        pottyCount: snap.pottyCount,
        photoCount: snap.photoCount,
        waterCount: snap.waterCount,
      });
    } catch (e) { console.log("Walk session save:", e); }

    // Mark booking as completed if we have context
    if (snap.bookingTs && snap.ownerId) {
      try {
        await apiPut("/walks/status", {
          ts:      snap.bookingTs,
          ownerId: snap.ownerId,
          status:  "completed",
        });
      } catch (e) { console.log("Booking status update:", e); }
    }
  }, []);

  const elapsedMs  = walkStore.getElapsedMs();
  const dist       = totalDist(walk.positions);
  const paceMinMi  = dist > 0.01 && elapsedMs > 5000 ? elapsedMs / 1000 / 60 / dist : 0;
  const currentPos = walk.positions[walk.positions.length - 1];
  const startPos   = walk.positions[0];
  const geoPath    = {
    type:       "Feature" as const,
    geometry:   { type: "LineString" as const, coordinates: walk.positions },
    properties: {},
  };
  const isTracking = walk.status === "active" || walk.status === "paused";

  // ── Geolocation denied screen ─────────────────────────────────────────────
  if (geoState === "denied") {
    return (
      <div className="h-full flex flex-col items-center justify-center" style={{ background: W97.teal, fontFamily: W97.font }}>
        <div style={{ ...W97.raised, width: "85%", maxWidth: 340, boxShadow: "3px 3px 0 #000" }}>
          <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, minHeight: 22 }}>
            <span>🚫</span>
            <span style={{ fontWeight: "bold", fontSize: 12, flex: 1 }}>Location Access Denied</span>
          </div>
          <div style={{ padding: "14px 16px", background: W97.gray }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
              <span style={{ fontSize: 32, flexShrink: 0 }}>📍</span>
              <div>
                <p style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>GPS Permission Required</p>
                <p style={{ fontSize: 11, color: "#000080", lineHeight: 1.5 }}>
                  Sit-Here needs location access to track your walk route and give owners live updates.
                </p>
              </div>
            </div>
            <div style={{ ...W97.sunken, padding: "8px 10px", marginBottom: 12, fontSize: 11, lineHeight: 1.6 }}>
              <strong>To enable on iPhone (Safari):</strong><br />
              Settings → Privacy → Location Services → Safari → While Using the App<br /><br />
              <strong>To enable on Android (Chrome):</strong><br />
              Tap the lock icon in the address bar → Site settings → Location → Allow
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <W97Button isDefault onClick={() => window.location.reload()} style={{ flex: 1 }}>
                🔄 Retry
              </W97Button>
              <W97Button onClick={() => {
                setGeoState("granted"); // use simulation fallback
                walkStore.update({ positions: [DEFAULT_POS] });
              }} style={{ flex: 1 }}>
                🗺️ Use Demo Map
              </W97Button>
              <W97Button onClick={() => navigate("/walker")}>Cancel</W97Button>
            </div>
          </div>
          <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "2px 6px" }}>
            <span style={{ ...W97.inset, padding: "0 6px", fontSize: 11, display: "block", lineHeight: "16px" }}>
              GPS Error 0x5 — PERMISSION_DENIED
            </span>
          </div>
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
          Live Walk Tracker — {walk.dogName}
          {walk.status === "active" && <span style={{ marginLeft: 8, background: "#FF0000", color: "#FFF", padding: "0 4px", fontSize: 10 }}>● LIVE</span>}
          {walk.status === "paused" && <span style={{ marginLeft: 8, background: "#808000", color: "#FFF", padding: "0 4px", fontSize: 10 }}>⏸ PAUSED</span>}
        </span>
        <div style={{ display: "flex", gap: 2 }}>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>_</button>
          <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>□</button>
          <button className="w97-titlebar-btn" style={{ ...W97.titlebarBtnStyle, fontWeight: "bold" }} onClick={() => navigate("/walker")}>✕</button>
        </div>
      </div>

      {/* GPS status bar */}
      {geoState === "requesting" && (
        <div style={{ background: "#808000", color: "#FFF", padding: "3px 8px", fontSize: 11, flexShrink: 0 }}>
          ⏳ Acquiring GPS signal… Please allow location access when prompted.
        </div>
      )}
      {geoState !== "requesting" && geoState !== "denied" && walk.status === "idle" && (
        <div style={{ background: "#008000", color: "#FFF", padding: "3px 8px", fontSize: 11, flexShrink: 0 }}>
          {geoState === "granted" ? "✅ GPS Ready — Real location acquired" : "⚠️ Using demo map — GPS not available"}
        </div>
      )}

      {/* Map area */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {currentPos ? (
          <Map
            {...viewState}
            onMove={e => setViewState(e.viewState)}
            mapStyle={MAP_STYLE}
            style={{ width: "100%", height: "100%" }}
            attributionControl={false}
            reuseMaps
          >
            {walk.positions.length > 1 && (
              <Source id="path" type="geojson" data={geoPath}>
                <Layer id="path-glow" type="line" paint={{ "line-color": "#F97316", "line-width": 10, "line-opacity": 0.2, "line-blur": 4 }} layout={{ "line-cap": "round", "line-join": "round" }} />
                <Layer id="path-line" type="line" paint={{ "line-color": "#C0C0C0", "line-width": 3, "line-opacity": 0.9 }} layout={{ "line-cap": "round", "line-join": "round" }} />
              </Source>
            )}
            {startPos && walk.status !== "idle" && (
              <Marker longitude={startPos[0]} latitude={startPos[1]} anchor="center">
                <div style={{ width: 10, height: 10, background: "#008000", border: "2px solid #FFF" }} />
              </Marker>
            )}
            {currentPos && (
              <Marker longitude={currentPos[0]} latitude={currentPos[1]} anchor="center">
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {walk.status === "active" && (
                    <div style={{ position: "absolute", width: 28, height: 28, background: "rgba(192,192,192,0.4)", animation: "ping 1s infinite", borderRadius: 2 }} />
                  )}
                  <div style={{ width: 22, height: 22, background: W97.gray, ...W97.raised, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                    🐾
                  </div>
                </div>
              </Marker>
            )}
          </Map>
        ) : (
          // Map loading placeholder
          <div style={{ width: "100%", height: "100%", background: "#DFDFDF", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
            <div style={{ fontFamily: "VT323, monospace", fontSize: 20, color: "#000080" }}>
              📡 Acquiring GPS...
            </div>
            <div className="w97-progress-track" style={{ width: 160 }}>
              <div className="w97-progress-fill" style={{ width: "40%", animation: "none" }} />
            </div>
          </div>
        )}
      </div>

      {/* Win97 control panel */}
      <div style={{ background: W97.gray, borderTop: "2px solid #FFF", padding: "4px 6px", flexShrink: 0 }}>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
          {[
            { label: "Time",     val: fmtTime(elapsedMs) },
            { label: "Distance", val: `${dist.toFixed(2)} mi` },
            { label: "Pace",     val: paceMinMi > 0 ? `${paceMinMi.toFixed(1)}/mi` : "--" },
            { label: "Potty",    val: `${walk.pottyCount}x` },
          ].map(({ label, val }) => (
            <div key={label} style={{ flex: 1, ...W97.sunken, padding: "3px 4px", textAlign: "center" }}>
              <div style={{ fontFamily: "VT323, monospace", fontSize: 18, color: "#000080", lineHeight: 1 }}>{val}</div>
              <div style={{ fontSize: 9, color: W97.grayDark }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Quick-log row */}
        {isTracking && (
          <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
            <W97Button small fullWidth onClick={() => walkStore.update({ photoCount: walk.photoCount + 1 })}>
              📷 Photo {walk.photoCount > 0 && `(${walk.photoCount})`}
            </W97Button>
            <W97Button small fullWidth onClick={() => walkStore.update({ pottyCount: walk.pottyCount + 1 })}>
              💩 Potty {walk.pottyCount > 0 && `(${walk.pottyCount})`}
            </W97Button>
            <W97Button small fullWidth onClick={() => walkStore.update({ waterCount: walk.waterCount + 1 })}>
              💧 Water {walk.waterCount > 0 && `(${walk.waterCount})`}
            </W97Button>
          </div>
        )}

        {/* Main controls */}
        <div style={{ display: "flex", gap: 4 }}>
          {walk.status === "idle" && (
            <W97Button
              isDefault
              fullWidth
              onClick={handleStart}
              disabled={geoState === "requesting"}
              style={{ fontSize: 13, fontWeight: "bold", padding: "6px" }}
            >
              {geoState === "requesting" ? "⏳ Waiting for GPS..." : "▶ Start Walk"}
            </W97Button>
          )}
          {walk.status === "active" && (
            <>
              <W97Button fullWidth onClick={handlePause}>⏸ Pause</W97Button>
              <W97Button fullWidth onClick={handleEnd} danger style={{ fontWeight: "bold" }}>⏹ End Walk</W97Button>
            </>
          )}
          {walk.status === "paused" && (
            <>
              <W97Button isDefault fullWidth onClick={handleResume}>▶ Resume</W97Button>
              <W97Button fullWidth onClick={handleEnd} danger style={{ fontWeight: "bold" }}>⏹ End Walk</W97Button>
            </>
          )}
          {walk.status === "ended" && (
            <>
              <div style={{ ...W97.raised, padding: "4px 8px", flex: 1, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 16 }}>✅</span>
                <span>Walk complete! {fmtTime(elapsedMs)} · {dist.toFixed(2)} mi</span>
              </div>
              <W97Button isDefault onClick={() => navigate("/walker/report-card")} style={{ fontWeight: "bold" }}>
                📋 Send Report Card
              </W97Button>
            </>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "2px 4px", display: "flex", gap: 4, flexShrink: 0, minHeight: 20 }}>
        <span style={{ ...W97.inset, padding: "0 6px", flex: 1, fontSize: 11, lineHeight: "16px" }}>
          {geoState === "granted" ? "📡 GPS Active" : "🗺️ Demo Mode"} · {walk.positions.length} pts · {fmtTime(elapsedMs)} elapsed
        </span>
        <span style={{ ...W97.inset, padding: "0 6px", fontSize: 11, lineHeight: "16px" }}>
          {walk.status.toUpperCase()}
        </span>
      </div>
    </div>
  );
}