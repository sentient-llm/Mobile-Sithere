/**
 * LaunchChecklist.tsx — Sit-Here MVP Launch Control Center
 *
 * Three tabs:
 *  1. 🧪 Test Suite   — live API endpoint tests + feature checklist
 *  2. 📋 QA Checklist — manual pre-launch sign-off with persistent state
 *  3. 🚀 Deploy        — deployment options, readiness score, go-live guide
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { W97, W97Button } from "../components/Win97Window";
import { useAuth } from "../context/AuthContext";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { supabase } from "../lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────

type TestStatus = "idle" | "running" | "pass" | "fail" | "skip";
type Tab = "tests" | "qa" | "deploy";

interface ApiTest {
  id:       string;
  label:    string;
  emoji:    string;
  category: string;
  run:      (token: string) => Promise<{ ok: boolean; detail: string }>;
}

interface QAItem {
  id:      string;
  label:   string;
  detail:  string;
  section: string;
}

// ── API test helpers ───────────────────────────────────────────────────────

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-f29bc816`;

async function hit(
  path: string,
  token: string,
  method = "GET",
  body?: object,
): Promise<{ ok: boolean; status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = {};
  try { json = await res.json(); } catch { /* empty */ }
  return { ok: res.ok, status: res.status, json };
}

// ── Test definitions ───────────────────────────────────────────────────────

const TESTS: ApiTest[] = [
  // ── Infrastructure
  {
    id: "health", label: "Server Health", emoji: "💚", category: "Infrastructure",
    run: async () => {
      const res = await fetch(`${BASE}/health`);
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok && json.status === "ok", detail: `HTTP ${res.status} · status: ${json.status ?? "?"}` };
    },
  },
  {
    id: "auth_session", label: "Auth Session Valid", emoji: "🔐", category: "Infrastructure",
    run: async (token) => {
      const ok = token !== publicAnonKey;
      return { ok, detail: ok ? "JWT resolved from Supabase session" : "No active session — using anon key" };
    },
  },
  // ── User / Dog Profile
  {
    id: "dog_profile_get", label: "GET /dog-profile", emoji: "🐕", category: "Profiles",
    run: async (token) => {
      const r = await hit("/dog-profile", token);
      return { ok: r.ok, detail: `HTTP ${r.status} · ${r.ok ? "profile: " + JSON.stringify(r.json?.profile)?.slice(0, 60) : r.json?.error ?? "error"}` };
    },
  },
  {
    id: "walker_profile_get", label: "GET /walker-profile", emoji: "🦮", category: "Profiles",
    run: async (token) => {
      const r = await hit("/walker-profile", token);
      return { ok: r.ok, detail: `HTTP ${r.status} · ${r.ok ? "profile fetched" : r.json?.error ?? "error"}` };
    },
  },
  {
    id: "walker_directory", label: "GET /walker-directory", emoji: "📋", category: "Profiles",
    run: async (token) => {
      const r = await hit("/walker-directory", token);
      const cnt = (r.json?.walkers ?? []).length;
      return { ok: r.ok, detail: `HTTP ${r.status} · ${cnt} walker(s) in directory` };
    },
  },
  // ── Walks
  {
    id: "walks_get", label: "GET /walks (owner bookings)", emoji: "📅", category: "Walk Bookings",
    run: async (token) => {
      const r = await hit("/walks", token);
      const cnt = (r.json?.walks ?? []).length;
      return { ok: r.ok, detail: `HTTP ${r.status} · ${cnt} booking(s) found` };
    },
  },
  {
    id: "walker_walks_get", label: "GET /walker-walks (assignments)", emoji: "🗓️", category: "Walk Bookings",
    run: async (token) => {
      const r = await hit("/walker-walks", token);
      const cnt = (r.json?.walks ?? []).length;
      return { ok: r.ok, detail: `HTTP ${r.status} · ${cnt} assignment(s)` };
    },
  },
  {
    id: "walker_avail", label: "GET /walker-availability", emoji: "🟢", category: "Walk Bookings",
    run: async (token) => {
      const r = await hit("/walker-availability", token);
      return { ok: r.ok, detail: `HTTP ${r.status} · status: ${r.json?.availability?.status ?? "?"}` };
    },
  },
  // ── Live Walk
  {
    id: "live_pos_get", label: "GET /walk-live-position", emoji: "🗺️", category: "Live Walk",
    run: async (token) => {
      const r = await hit("/walk-live-position", token);
      const live = r.json?.live;
      return { ok: r.ok, detail: `HTTP ${r.status} · ${live ? `lat ${live.position?.lat?.toFixed(4)} lng ${live.position?.lng?.toFixed(4)}` : "no active walk"}` };
    },
  },
  // ── Reports
  {
    id: "reports_get", label: "GET /reports", emoji: "📋", category: "Report Cards",
    run: async (token) => {
      const r = await hit("/reports", token);
      const cnt = (r.json?.reports ?? []).length;
      return { ok: r.ok, detail: `HTTP ${r.status} · ${cnt} report(s)` };
    },
  },
  // ── Chat
  {
    id: "messages_get", label: "GET /messages/:id", emoji: "💬", category: "Chat",
    run: async (token) => {
      const r = await hit("/messages/test-conv-health-check", token);
      const cnt = (r.json?.messages ?? []).length;
      return { ok: r.ok, detail: `HTTP ${r.status} · ${cnt} message(s) in test conv` };
    },
  },
  // ── Notifications
  {
    id: "notifs_get", label: "GET /notifications", emoji: "🔔", category: "Notifications",
    run: async (token) => {
      const r = await hit("/notifications", token);
      const unread = r.json?.unreadCount ?? 0;
      return { ok: r.ok, detail: `HTTP ${r.status} · ${unread} unread` };
    },
  },
  // ── Earnings / Stats
  {
    id: "walker_stats", label: "GET /walker-stats", emoji: "💰", category: "Earnings",
    run: async (token) => {
      const r = await hit("/walker-stats", token);
      const totalWalks = r.json?.stats?.totalWalks ?? 0;
      return { ok: r.ok, detail: `HTTP ${r.status} · totalWalks: ${totalWalks}` };
    },
  },
];

// ── Manual QA checklist ────────────────────────────────────────────────────

const QA_ITEMS: QAItem[] = [
  // Auth
  { id: "qa_signup_owner",  section: "Auth",           label: "Sign up as Dog Owner",          detail: "New email → role: owner → auto-sign-in → OwnerDashboard" },
  { id: "qa_signup_walker", section: "Auth",           label: "Sign up as Dog Walker",         detail: "New email → role: walker → auto-sign-in → WalkerDashboard" },
  { id: "qa_signin",        section: "Auth",           label: "Sign in with existing account", detail: "Correct credentials → session restored → correct dashboard" },
  { id: "qa_signout",       section: "Auth",           label: "Sign out",                      detail: "Tray → Sign Out → Login screen shown" },
  { id: "qa_jwt_refresh",   section: "Auth",           label: "JWT auto-refresh on expiry",    detail: "Background token refresh prevents 401 errors (api.ts getFreshToken)" },
  // Owner core flows
  { id: "qa_schedule_1",    section: "Owner Flows",    label: "Schedule Walk — Step 1 Date/Time",   detail: "Pick date, time, duration → Next" },
  { id: "qa_schedule_2",    section: "Owner Flows",    label: "Schedule Walk — Step 2 Dog Info",    detail: "Enter dog name/breed/notes → Next" },
  { id: "qa_schedule_3",    section: "Owner Flows",    label: "Schedule Walk — Step 3 Walker pick", detail: "Walker directory loads real KV walkers, select one → Next" },
  { id: "qa_schedule_4",    section: "Owner Flows",    label: "Schedule Walk — Step 4 Payment",     detail: "Mock Stripe modal → Confirm → booking written to KV" },
  { id: "qa_owner_dash",    section: "Owner Flows",    label: "OwnerDashboard — booking status",    detail: "Pending/Accepted/In Progress/Completed badges appear correctly" },
  { id: "qa_owner_cancel",  section: "Owner Flows",    label: "Cancel booking",                     detail: "Cancel button on OwnerDashboard → status: cancelled in KV" },
  { id: "qa_owner_chat",    section: "Owner Flows",    label: "Owner Chat — send & receive",        detail: "Send message → appears in list; wallet polling shows new messages" },
  { id: "qa_report_view",   section: "Owner Flows",    label: "Report Card — view latest",          detail: "Report data loads from ownerreport:uid:ts KV prefix" },
  { id: "qa_report_rate",   section: "Owner Flows",    label: "Report Card — submit rating",        detail: "Star picker → Submit → ownerRating written to KV; walker notified" },
  { id: "qa_live_track",    section: "Owner Flows",    label: "Live Walk — GPS polling",            detail: "OwnerLiveWalk polls /walk-live-position every 5s; map updates" },
  { id: "qa_vet_finder",    section: "Owner Flows",    label: "Vet Finder — search & results",      detail: "Search populates vet list; Google Maps link works" },
  // Walker core flows
  { id: "qa_walker_avail",  section: "Walker Flows",   label: "Walker availability toggle",         detail: "Available / On Walk / Off Duty → PUT /walker-availability" },
  { id: "qa_walker_accept", section: "Walker Flows",   label: "Accept booking request",             detail: "Accept btn → status: accepted → owner notified" },
  { id: "qa_walker_decline",section: "Walker Flows",   label: "Decline booking request",            detail: "Decline btn → status: declined → owner notified" },
  { id: "qa_walker_start",  section: "Walker Flows",   label: "Start Walk → Live Walk screen",      detail: "Start Walk → walkStore populated → /walker/live-walk → in_progress" },
  { id: "qa_walker_gps",    section: "Walker Flows",   label: "Live GPS broadcast every 30s",       detail: "WalkerLiveWalk POSTs position to /walk-live-position" },
  { id: "qa_walker_report", section: "Walker Flows",   label: "Submit Report Card",                 detail: "Fill form → Submit → report:uid:ts + ownerreport:uid:ts written" },
  { id: "qa_walker_chat",   section: "Walker Flows",   label: "Walker Chat",                        detail: "Walker sends message in same conversationId as owner" },
  { id: "qa_earnings",      section: "Walker Flows",   label: "Earnings ledger",                    detail: "WalkerEarnings loads /walker-stats; charts show history" },
  // UX / Shell
  { id: "qa_win97_theme",   section: "UX / Shell",     label: "Win97 theme consistent",             detail: "Navy titlebar, gray bevel, VT323 font, teal desktop throughout" },
  { id: "qa_start_menu",    section: "UX / Shell",     label: "Start Menu navigation",              detail: "All nav items route correctly; role-based items shown" },
  { id: "qa_notif_badge",   section: "UX / Shell",     label: "Notification badge in tray",         detail: "Red dot appears when unreadCount > 0; cleared on tray click" },
  { id: "qa_bsod",          section: "UX / Shell",     label: "BSOD ErrorBoundary",                 detail: "Render error shows Win97 BSOD with STOP code; reload works" },
  { id: "qa_mobile",        section: "UX / Shell",     label: "Mobile viewport (375px)",            detail: "All pages fit 375px width; no horizontal scroll; inputs usable" },
  { id: "qa_profile",       section: "UX / Shell",     label: "Profile & Settings page",            detail: "Loads walker/owner info; fields editable" },
];

// ── Deployment info ────────────────────────────────────────────────────────

const DEPLOY_OPTIONS = [
  {
    name: "Vercel (Recommended)", icon: "▲", color: "#000",
    status: "configured",
    pros: ["Zero-config CI/CD from GitHub", "Instant SPA rewrites (vercel.json ✅)", "Security headers pre-set", "Free Hobby tier for MVP"],
    steps: [
      "Push to GitHub (git push origin main)",
      "Connect repo at vercel.com/new",
      "Set VITE_ env vars if any → Deploy",
      "Custom domain: Settings → Domains",
    ],
    note: "vercel.json already configured with SPA rewrites + security headers.",
  },
  {
    name: "Netlify", icon: "🌐", color: "#00C7B7",
    status: "ready",
    pros: ["Drag-and-drop deploy from /dist", "Free tier with 100GB bandwidth", "Form & serverless support"],
    steps: [
      "Run: pnpm build → dist/",
      "Drag dist/ to netlify.com/drop",
      "Add _redirects file: /* /index.html 200",
      "Or connect GitHub for auto-deploy",
    ],
    note: "Add a _redirects file for SPA routing.",
  },
  {
    name: "Cloudflare Pages", icon: "🔶", color: "#F48120",
    status: "ready",
    pros: ["Global CDN edge caching", "Unlimited bandwidth on free tier", "Workers integration for future edge logic"],
    steps: [
      "Connect GitHub at pages.cloudflare.com",
      "Build command: pnpm build",
      "Output: dist/",
      "SPA fallback: auto-detected",
    ],
    note: "Best choice for global performance at scale.",
  },
  {
    name: "PWA (Add to Homescreen)", icon: "📱", color: "#4285F4",
    status: "next-step",
    pros: ["Native-feel iOS/Android from web", "Offline capability with Service Worker", "No App Store approval needed"],
    steps: [
      "Add vite-plugin-pwa to vite.config.ts",
      "Create manifest.json (name, icons, theme_color: #008080)",
      "Add <meta name='apple-mobile-web-app-capable'> to index.html",
      "Deploy to HTTPS host → Share link → Add to Home Screen",
    ],
    note: "Fastest path to mobile install. No App Store review required.",
  },
  {
    name: "iOS App Store (SwiftUI)", icon: "🍎", color: "#888",
    status: "future",
    pros: ["Full native experience", "Apple Pay integration", "Push notifications via APNs"],
    steps: [
      "Translate React prototype to SwiftUI (Figma → Xcode)",
      "Re-use same Supabase backend (same endpoints)",
      "Add Sign in with Apple",
      "Submit to App Store Connect (2-3 day review)",
    ],
    note: "Backend is fully ready. Frontend translation to SwiftUI is the work.",
  },
];

const ENV_VARS = [
  { key: "SUPABASE_URL",              where: "Supabase Edge Fn",  status: "set", note: "Auto-provided by Supabase runtime" },
  { key: "SUPABASE_ANON_KEY",         where: "Supabase Edge Fn",  status: "set", note: "Auto-provided" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", where: "Supabase Edge Fn",  status: "set", note: "Auto-provided — NEVER expose to frontend" },
  { key: "VITE_SUPABASE_URL",         where: "Frontend .env",     status: "injected", note: "Injected via /utils/supabase/info.tsx" },
  { key: "VITE_SUPABASE_ANON_KEY",    where: "Frontend .env",     status: "injected", note: "Injected via /utils/supabase/info.tsx" },
];

// ── Component ──────────────────────────────────────────────────────────────

export function LaunchChecklist() {
  const navigate             = useNavigate();
  const { user, session }    = useAuth();
  const [tab, setTab]        = useState<Tab>("tests");

  // ── Test runner state ─────────────────────────────────────────────────────
  const [testResults, setTestResults]   = useState<Record<string, { status: TestStatus; detail: string }>>({});
  const [running,     setRunning]        = useState(false);
  const [runCount,    setRunCount]       = useState(0);
  const cancelRef                        = useRef(false);

  // ── QA checklist state ────────────────────────────────────────────────────
  const [checked, setChecked]   = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("sithere_qa_checks") ?? "{}"); }
    catch { return {}; }
  });

  // ── Deploy accordion ──────────────────────────────────────────────────────
  const [openDeploy, setOpenDeploy] = useState<string | null>("Vercel (Recommended)");

  // ── Persist QA ────────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem("sithere_qa_checks", JSON.stringify(checked));
  }, [checked]);

  // ── Token helper ──────────────────────────────────────────────────────────
  async function getToken(): Promise<string> {
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.access_token) return s.access_token;
    } catch { /* fall through */ }
    return publicAnonKey;
  }

  // ── Run all tests ─────────────────────────────────────────────────────────
  const runAll = useCallback(async () => {
    if (running) return;
    cancelRef.current = false;
    setRunning(true);
    setRunCount(c => c + 1);

    // Reset all to running
    const init: Record<string, { status: TestStatus; detail: string }> = {};
    TESTS.forEach(t => { init[t.id] = { status: "running", detail: "…" }; });
    setTestResults(init);

    const token = await getToken();

    for (const test of TESTS) {
      if (cancelRef.current) break;
      try {
        const { ok, detail } = await test.run(token);
        setTestResults(prev => ({ ...prev, [test.id]: { status: ok ? "pass" : "fail", detail } }));
      } catch (err: any) {
        setTestResults(prev => ({
          ...prev,
          [test.id]: { status: "fail", detail: `Exception: ${err?.message ?? err}` },
        }));
      }
      // Slight delay so the UI updates are visible
      await new Promise(r => setTimeout(r, 120));
    }
    setRunning(false);
  }, [running]);

  // ── Derived metrics ───────────────────────────────────────────────────────
  const testList   = TESTS;
  const passed     = testList.filter(t => testResults[t.id]?.status === "pass").length;
  const failed     = testList.filter(t => testResults[t.id]?.status === "fail").length;
  const ran        = passed + failed;
  const score      = ran > 0 ? Math.round((passed / ran) * 100) : 0;

  const qaTotal    = QA_ITEMS.length;
  const qaChecked  = Object.values(checked).filter(Boolean).length;
  const qaScore    = Math.round((qaChecked / qaTotal) * 100);

  // Launch readiness = blend of api score + qa score
  const readiness  = ran > 0 ? Math.round(score * 0.45 + qaScore * 0.55) : qaScore;

  const statusColor = (s: TestStatus) =>
    s === "pass" ? "#004000" : s === "fail" ? "#800000" : s === "running" ? "#000080" : "#808080";
  const statusLabel = (s: TestStatus) =>
    s === "pass" ? "✓ PASS" : s === "fail" ? "✗ FAIL" : s === "running" ? "…" : "—";

  // Group tests
  const categories = [...new Set(testList.map(t => t.category))];
  const qaCategories = [...new Set(QA_ITEMS.map(q => q.section))];

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: W97.gray, fontFamily: W97.font, color: "#000", fontSize: 12 }}
    >
      {/* Title Bar */}
      <div style={{ background: W97.titlebarGrad, color: "#FFF", padding: "3px 6px", display: "flex", alignItems: "center", gap: 4, minHeight: 22, userSelect: "none", flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>🚀</span>
        <span style={{ flex: 1, fontWeight: "bold", fontSize: 12 }}>
          Sit-Here MVP Launch Center — v1.0
        </span>
        {readiness >= 80 && <span style={{ background: "#004000", color: "#FFF", fontSize: 9, padding: "0 5px", fontWeight: "bold" }}>LAUNCH READY</span>}
        <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>_</button>
        <button className="w97-titlebar-btn" style={W97.titlebarBtnStyle}>□</button>
        <button className="w97-titlebar-btn" style={{ ...W97.titlebarBtnStyle, fontWeight: "bold" }} onClick={() => navigate(user?.role === "walker" ? "/walker" : "/owner")}>✕</button>
      </div>

      {/* Menu Bar */}
      <div style={{ background: W97.gray, borderBottom: `1px solid ${W97.grayDark}`, display: "flex", padding: "1px 2px", flexShrink: 0, minHeight: 20 }}>
        {["File", "Tests", "Deploy", "Help"].map(item => (
          <span key={item} className="w97-menuitem" style={{ padding: "2px 6px", fontSize: 11, cursor: "default" }}>
            <u>{item[0]}</u>{item.slice(1)}
          </span>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ background: W97.gray, borderBottom: `1px solid ${W97.grayDark}`, display: "flex", padding: "3px 4px 0", gap: 2, flexShrink: 0 }}>
        {([["tests", "🧪 Test Suite"], ["qa", "📋 QA Checklist"], ["deploy", "🚀 Deploy"]] as [Tab, string][]).map(([t, label]) => (
          <div
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "3px 12px", fontSize: 11,
              fontWeight: tab === t ? "bold" : "normal",
              background: tab === t ? W97.gray : "#A0A0A0",
              border: "2px solid",
              borderTopColor:    tab === t ? "#FFF"     : "#808080",
              borderLeftColor:   tab === t ? "#FFF"     : "#808080",
              borderBottomColor: tab === t ? W97.gray   : "#404040",
              borderRightColor:  tab === t ? "#808080"  : "#404040",
              marginBottom: tab === t ? -2 : 0,
              cursor: "default",
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto w97-scroll" style={{ background: W97.gray, padding: "8px" }}>

        {/* ── LAUNCH READINESS METER ── always visible */}
        <fieldset style={{ border: "2px solid", borderTopColor: "#808080", borderLeftColor: "#808080", borderBottomColor: "#FFF", borderRightColor: "#FFF", padding: "7px 10px", marginBottom: 8 }}>
          <legend style={{ fontWeight: "bold", fontSize: 11, padding: "0 4px" }}>🎯 Launch Readiness</legend>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="w97-progress-track" style={{ flex: 1, height: 14 }}>
              <div
                className="w97-progress-fill"
                style={{
                  width: `${readiness}%`,
                  background: readiness >= 80 ? "#006400" : readiness >= 60 ? "#806000" : "#800000",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <span style={{ fontFamily: "VT323, monospace", fontSize: 20, color: readiness >= 80 ? "#006400" : readiness >= 60 ? "#806000" : "#800000", minWidth: 40, textAlign: "right" }}>
              {readiness}%
            </span>
            <span style={{
              fontSize: 10, padding: "1px 6px",
              background: readiness >= 80 ? "#006400" : readiness >= 60 ? "#806000" : "#800000",
              color: "#FFF", fontWeight: "bold",
            }}>
              {readiness >= 80 ? "🚀 GO FOR LAUNCH" : readiness >= 60 ? "⚠️ ALMOST READY" : "🔧 IN PROGRESS"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 5, fontSize: 11, color: W97.grayDark }}>
            <span>API: <strong style={{ color: "#000" }}>{ran > 0 ? `${passed}/${ran}` : "not run"}</strong></span>
            <span>QA: <strong style={{ color: "#000" }}>{qaChecked}/{qaTotal}</strong></span>
            {user && <span>Logged in as: <strong style={{ color: "#000080" }}>{user.name} ({user.role})</strong></span>}
          </div>
        </fieldset>

        {/* ── TAB: TEST SUITE ── */}
        {tab === "tests" && (
          <>
            {/* Toolbar */}
            <div style={{ display: "flex", gap: 5, marginBottom: 8, alignItems: "center" }}>
              <W97Button isDefault onClick={runAll} disabled={running} style={{ fontWeight: "bold" }}>
                {running ? "⏳ Running Tests…" : `▶ Run All Tests${runCount > 0 ? ` (run #${runCount + 1})` : ""}`}
              </W97Button>
              {running && (
                <W97Button onClick={() => { cancelRef.current = true; setRunning(false); }} danger>
                  ■ Cancel
                </W97Button>
              )}
              {ran > 0 && (
                <span style={{ fontSize: 11, marginLeft: 6, color: failed > 0 ? "#800000" : "#006400", fontWeight: "bold" }}>
                  {passed} passed · {failed} failed · {score}% score
                </span>
              )}
              {ran === 0 && !running && (
                <span style={{ fontSize: 11, color: W97.grayDark }}>
                  Click ▶ to run live API tests against the Supabase Edge Function
                </span>
              )}
            </div>

            {/* Test groups */}
            {categories.map(cat => {
              const catTests = testList.filter(t => t.category === cat);
              const catPassed = catTests.filter(t => testResults[t.id]?.status === "pass").length;
              const catRan    = catTests.filter(t => ["pass","fail"].includes(testResults[t.id]?.status ?? "")).length;
              return (
                <fieldset key={cat} style={{ border: "2px solid", borderTopColor: "#808080", borderLeftColor: "#808080", borderBottomColor: "#FFF", borderRightColor: "#FFF", padding: "4px 8px 6px", marginBottom: 8 }}>
                  <legend style={{ fontWeight: "bold", fontSize: 11, padding: "0 4px", display: "flex", gap: 6, alignItems: "center" }}>
                    {cat}
                    {catRan > 0 && (
                      <span style={{ fontSize: 9, padding: "0 4px", background: catPassed === catRan ? "#006400" : "#800000", color: "#FFF" }}>
                        {catPassed}/{catRan}
                      </span>
                    )}
                  </legend>
                  {catTests.map(test => {
                    const res = testResults[test.id];
                    const st  = res?.status ?? "idle";
                    return (
                      <div
                        key={test.id}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 6,
                          padding: "3px 0",
                          borderBottom: "1px solid #DFDFDF",
                        }}
                      >
                        <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0, width: 20, textAlign: "center" }}>{test.emoji}</span>
                        <span style={{ flex: 1, fontSize: 11 }}>{test.label}</span>
                        <span style={{
                          fontSize: 10, padding: "1px 5px", flexShrink: 0, minWidth: 52, textAlign: "center",
                          background: statusColor(st), color: "#FFF", fontWeight: "bold",
                          animation: st === "running" ? "pulse 1s infinite" : undefined,
                        }}>
                          {statusLabel(st)}
                        </span>
                        {res?.detail && (
                          <span style={{ fontSize: 10, color: W97.grayDark, flexShrink: 0, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {res.detail}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </fieldset>
              );
            })}

            {/* Info note */}
            <div style={{ ...W97.raised, padding: "6px 10px", fontSize: 11, color: W97.grayDark, marginTop: 4 }}>
              <strong>ℹ️ Note:</strong> Some tests (dog-profile, walker-profile, walker-stats) may return empty data for a fresh account — that's expected.
              The test passes as long as the server returns HTTP 200. Tests requiring auth will fail if no session is active.
            </div>
          </>
        )}

        {/* ── TAB: QA CHECKLIST ── */}
        {tab === "qa" && (
          <>
            <div style={{ display: "flex", gap: 5, marginBottom: 8, alignItems: "center" }}>
              <W97Button small onClick={() => {
                const all: Record<string, boolean> = {};
                QA_ITEMS.forEach(q => { all[q.id] = true; });
                setChecked(all);
              }}>☑ Check All</W97Button>
              <W97Button small onClick={() => setChecked({})}>☐ Clear All</W97Button>
              <span style={{ fontSize: 11, marginLeft: 6, fontWeight: "bold", color: qaChecked === qaTotal ? "#006400" : "#000" }}>
                {qaChecked}/{qaTotal} signed off · {qaScore}%
              </span>
            </div>

            {qaCategories.map(section => {
              const sItems = QA_ITEMS.filter(q => q.section === section);
              const sDone  = sItems.filter(q => checked[q.id]).length;
              return (
                <fieldset key={section} style={{ border: "2px solid", borderTopColor: "#808080", borderLeftColor: "#808080", borderBottomColor: "#FFF", borderRightColor: "#FFF", padding: "4px 8px 6px", marginBottom: 8 }}>
                  <legend style={{ fontWeight: "bold", fontSize: 11, padding: "0 4px", display: "flex", gap: 6, alignItems: "center" }}>
                    {section}
                    <span style={{ fontSize: 9, padding: "0 4px", background: sDone === sItems.length ? "#006400" : "#808080", color: "#FFF" }}>
                      {sDone}/{sItems.length}
                    </span>
                  </legend>
                  {sItems.map(item => (
                    <div
                      key={item.id}
                      style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "4px 0", borderBottom: "1px solid #DFDFDF", cursor: "default" }}
                      onClick={() => setChecked(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                    >
                      {/* Win97-style checkbox */}
                      <div style={{
                        ...W97.sunken,
                        width: 14, height: 14, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, lineHeight: 1, marginTop: 1,
                        background: checked[item.id] ? "#FFF" : "#FFF",
                      }}>
                        {checked[item.id] ? "✓" : ""}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 11, fontWeight: checked[item.id] ? "bold" : "normal", textDecoration: checked[item.id] ? "line-through" : "none", color: checked[item.id] ? W97.grayDark : "#000" }}>
                          {item.label}
                        </p>
                        <p style={{ fontSize: 10, color: W97.grayDark, marginTop: 1, lineHeight: "13px" }}>{item.detail}</p>
                      </div>
                      {checked[item.id] && <span style={{ fontSize: 12, flexShrink: 0 }}>✅</span>}
                    </div>
                  ))}
                </fieldset>
              );
            })}

            <div style={{ ...W97.raised, padding: "6px 10px", fontSize: 11, marginTop: 4 }}>
              <strong>💾 Auto-saves</strong> — your checklist is persisted in localStorage between sessions.
            </div>
          </>
        )}

        {/* ── TAB: DEPLOY ── */}
        {tab === "deploy" && (
          <>
            {/* Environment Variables */}
            <fieldset style={{ border: "2px solid", borderTopColor: "#808080", borderLeftColor: "#808080", borderBottomColor: "#FFF", borderRightColor: "#FFF", padding: "4px 8px 6px", marginBottom: 8 }}>
              <legend style={{ fontWeight: "bold", fontSize: 11, padding: "0 4px" }}>🔑 Environment Variables</legend>
              {ENV_VARS.map((v, i) => (
                <div key={v.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", borderBottom: i < ENV_VARS.length - 1 ? "1px solid #DFDFDF" : "none" }}>
                  <span style={{ fontSize: 9, padding: "1px 4px", background: v.status === "set" ? "#006400" : "#000080", color: "#FFF", fontWeight: "bold", flexShrink: 0 }}>
                    {v.status === "set" ? "SET" : "INJ"}
                  </span>
                  <code style={{ fontSize: 10, fontFamily: "VT323, monospace", flex: 1, color: "#000080" }}>{v.key}</code>
                  <span style={{ fontSize: 10, color: W97.grayDark }}>{v.note}</span>
                </div>
              ))}
            </fieldset>

            {/* Deploy options */}
            <fieldset style={{ border: "2px solid", borderTopColor: "#808080", borderLeftColor: "#808080", borderBottomColor: "#FFF", borderRightColor: "#FFF", padding: "4px 8px 6px", marginBottom: 8 }}>
              <legend style={{ fontWeight: "bold", fontSize: 11, padding: "0 4px" }}>🚀 Deployment Options</legend>
              {DEPLOY_OPTIONS.map(opt => {
                const isOpen = openDeploy === opt.name;
                const statusBg = opt.status === "configured" ? "#006400" : opt.status === "ready" ? "#000080" : opt.status === "next-step" ? "#806000" : "#808080";
                const statusTxt = opt.status === "configured" ? "CONFIGURED ✓" : opt.status === "ready" ? "READY" : opt.status === "next-step" ? "NEXT STEP" : "FUTURE";
                return (
                  <div key={opt.name} style={{ marginBottom: 5 }}>
                    {/* Header row */}
                    <div
                      style={{ ...W97.raised, padding: "5px 8px", display: "flex", alignItems: "center", gap: 8, cursor: "default" }}
                      onClick={() => setOpenDeploy(isOpen ? null : opt.name)}
                    >
                      <span style={{ fontSize: 16 }}>{opt.icon}</span>
                      <span style={{ flex: 1, fontWeight: "bold", fontSize: 12 }}>{opt.name}</span>
                      <span style={{ fontSize: 9, padding: "1px 5px", background: statusBg, color: "#FFF", fontWeight: "bold" }}>{statusTxt}</span>
                      <span style={{ fontSize: 10, color: W97.grayDark }}>{isOpen ? "▲" : "▼"}</span>
                    </div>

                    {/* Expanded content */}
                    {isOpen && (
                      <div style={{ ...W97.sunken, padding: "8px 10px", background: "#FAFAFA", marginTop: 2 }}>
                        <p style={{ fontSize: 11, color: "#000080", marginBottom: 6, fontStyle: "italic" }}>{opt.note}</p>

                        <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                          {/* Pros */}
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: "bold", fontSize: 11, marginBottom: 3 }}>✅ Pros:</p>
                            {opt.pros.map((p, i) => (
                              <p key={i} style={{ fontSize: 10, lineHeight: "15px", paddingLeft: 8 }}>• {p}</p>
                            ))}
                          </div>
                          {/* Steps */}
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: "bold", fontSize: 11, marginBottom: 3 }}>📋 Steps:</p>
                            {opt.steps.map((s, i) => (
                              <p key={i} style={{ fontSize: 10, lineHeight: "15px", paddingLeft: 8 }}>
                                <span style={{ color: "#000080", fontWeight: "bold" }}>{i + 1}.</span> {s}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </fieldset>

            {/* MVP Pre-Launch Criteria */}
            <fieldset style={{ border: "2px solid", borderTopColor: "#808080", borderLeftColor: "#808080", borderBottomColor: "#FFF", borderRightColor: "#FFF", padding: "4px 8px 6px", marginBottom: 8 }}>
              <legend style={{ fontWeight: "bold", fontSize: 11, padding: "0 4px" }}>📦 MVP Feature Scope — What's Shipping v1.0</legend>
              {[
                { icon: "✅", label: "Auth",            detail: "Sign up / Sign in / Sign out (Supabase Auth, email_confirm: true)" },
                { icon: "✅", label: "Schedule Walk",   detail: "4-step booking flow → Walker directory → Mock payment → KV write" },
                { icon: "✅", label: "Live Walk",        detail: "Walker posts GPS every 30s → Owner polls map every 5s" },
                { icon: "✅", label: "Report Card",      detail: "Walker submits report → Owner receives + rates 1-5 stars" },
                { icon: "✅", label: "Chat",             detail: "Real-time KV chat between owner & walker (same conversationId)" },
                { icon: "✅", label: "Vet Finder",       detail: "Nearest vet search with map link" },
                { icon: "✅", label: "Notifications",   detail: "In-app bell badge; events: booking, report, rating, cancellation" },
                { icon: "✅", label: "Earnings",         detail: "Walker stats: daily/weekly/monthly from KV reports" },
                { icon: "✅", label: "Win97 UX",         detail: "Locked-in visual theme: teal desktop, BSOD ErrorBoundary, Start Menu" },
                { icon: "⏳", label: "Real Payments",   detail: "Stripe integration — mock modal today, full SDK for v1.1" },
                { icon: "⏳", label: "Push Notifications", detail: "Web Push / APNs — in-app badge works now; native push in v1.1" },
                { icon: "⏳", label: "Photo Uploads",   detail: "Report Card photos — Supabase Storage bucket ready; UI in v1.1" },
                { icon: "🔜", label: "iOS SwiftUI App", detail: "Translate React prototype → Figma → SwiftUI; same Supabase backend" },
              ].map(({ icon, label, detail }) => (
                <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "3px 0", borderBottom: "1px solid #DFDFDF" }}>
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{icon}</span>
                  <div>
                    <p style={{ fontWeight: "bold", fontSize: 11 }}>{label}</p>
                    <p style={{ fontSize: 10, color: W97.grayDark, lineHeight: "13px" }}>{detail}</p>
                  </div>
                </div>
              ))}
            </fieldset>

            {/* Post-launch roadmap */}
            <fieldset style={{ border: "2px solid", borderTopColor: "#808080", borderLeftColor: "#808080", borderBottomColor: "#FFF", borderRightColor: "#FFF", padding: "4px 8px 6px" }}>
              <legend style={{ fontWeight: "bold", fontSize: 11, padding: "0 4px" }}>🗺️ Post-MVP Roadmap</legend>
              {[
                { ver: "v1.1", label: "Stripe Payments",       detail: "stripe.js + webhook → walks only charged on completion" },
                { ver: "v1.1", label: "Photo Report Cards",    detail: "Walker uploads 2-3 photos per walk to Supabase Storage" },
                { ver: "v1.1", label: "Web Push Notifications",detail: "navigator.serviceWorker + VAPID keys → background alerts" },
                { ver: "v1.2", label: "Recurring Walks",       detail: "Weekly recurring schedule builder; cancel series" },
                { ver: "v1.2", label: "Walker Background Check",detail: "Checkr API integration for walker verification badge" },
                { ver: "v1.3", label: "iOS / Android App",     detail: "SwiftUI (iOS) + Kotlin (Android); same Supabase backend" },
                { ver: "v2.0", label: "Marketplace Mode",      detail: "Public walker profiles, reviews, geosearch, bidding" },
              ].map(({ ver, label, detail }) => (
                <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "3px 0", borderBottom: "1px solid #DFDFDF" }}>
                  <span style={{ fontSize: 9, padding: "1px 4px", background: "#000080", color: "#FFF", fontWeight: "bold", flexShrink: 0, marginTop: 2 }}>{ver}</span>
                  <div>
                    <p style={{ fontWeight: "bold", fontSize: 11 }}>{label}</p>
                    <p style={{ fontSize: 10, color: W97.grayDark, lineHeight: "13px" }}>{detail}</p>
                  </div>
                </div>
              ))}
            </fieldset>

            <div style={{ height: 4 }} />
          </>
        )}

      </div>

      {/* Status Bar */}
      <div style={{ background: W97.gray, borderTop: `1px solid ${W97.grayDark}`, padding: "2px 4px", display: "flex", gap: 4, flexShrink: 0, minHeight: 20 }}>
        <span style={{ ...W97.inset, padding: "0 6px", flex: 1, fontSize: 11, lineHeight: "16px" }}>
          {tab === "tests" && (ran > 0 ? `${passed}/${ran} API tests passing · ${score}% score` : "Ready — click ▶ Run All Tests")}
          {tab === "qa"    && `${qaChecked}/${qaTotal} QA items signed off · ${qaScore}%`}
          {tab === "deploy" && "Vercel configured · Supabase Edge Functions live"}
        </span>
        <span style={{ ...W97.inset, padding: "0 6px", fontSize: 11, lineHeight: "16px" }}>
          Readiness: {readiness}%
        </span>
      </div>

      {/* Pulse animation for running tests */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
