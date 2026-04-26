import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// ── Middleware ─────────────────────────────────────────────────────────────

app.use("*", logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders:  ["Content-Type", "Authorization"],
  allowMethods:  ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function getAuthUser(authHeader: string | null) {
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  const { data: { user }, error } = await adminClient().auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function createNotification(
  userId: string, type: string, title: string, body: string, data?: object,
) {
  try {
    const ts = Date.now();
    await kv.set(`notif:${userId}:${ts}`, {
      type, title, body, data: data ?? {}, read: false, ts,
      createdAt: new Date().toISOString(),
    });
  } catch (e) { console.log("createNotification error:", e); }
}

// ── Health ─────────────────────────────────────────────────────────────────

app.get("/make-server-f29bc816/health", (c) => c.json({ status: "ok" }));

// ── Auth: Sign Up ──────────────────────────────────────────────────────────

app.post("/make-server-f29bc816/signup", async (c) => {
  try {
    const { name, email, password, role } = await c.req.json();
    if (!name || !email || !password || !role)
      return c.json({ error: "name, email, password and role are required" }, 400);
    if (!["owner", "walker"].includes(role))
      return c.json({ error: "role must be 'owner' or 'walker'" }, 400);
    const { data, error } = await adminClient().auth.admin.createUser({
      email, password,
      user_metadata: { name, role },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true,
    });
    if (error) { console.log("createUser error:", error.message); return c.json({ error: error.message }, 400); }
    console.log("Created user:", data.user?.id, role);
    return c.json({ user: { id: data.user?.id, email, name, role } });
  } catch (err) { return c.json({ error: `Server error: ${err}` }, 500); }
});

// ── Dog Profile ────────────────────────────────────────────────────────────

app.get("/make-server-f29bc816/dog-profile", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return c.json({ profile: (await kv.get(`dog:${user.id}`)) ?? null });
  } catch (err) { return c.json({ error: `Failed to get dog profile: ${err}` }, 500); }
});

app.post("/make-server-f29bc816/dog-profile", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const body = await c.req.json();
    const profile = { ...body, updatedAt: new Date().toISOString() };
    await kv.set(`dog:${user.id}`, profile);
    return c.json({ success: true, profile });
  } catch (err) { return c.json({ error: `Failed to save dog profile: ${err}` }, 500); }
});

// ── Walker Profile ─────────────────────────────────────────────────────────

app.get("/make-server-f29bc816/walker-profile", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return c.json({ profile: (await kv.get(`walker:${user.id}`)) ?? null });
  } catch (err) { return c.json({ error: `Failed to get walker profile: ${err}` }, 500); }
});

app.post("/make-server-f29bc816/walker-profile", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const body = await c.req.json();
    const profile = { ...body, userId: user.id, name: user.user_metadata?.name ?? user.email, updatedAt: new Date().toISOString() };
    await kv.set(`walker:${user.id}`, profile);
    console.log("Walker profile saved:", user.id);
    return c.json({ success: true, profile });
  } catch (err) { return c.json({ error: `Failed to save walker profile: ${err}` }, 500); }
});

// ── Walker Directory (public listing) ─────────────────────────────────────
// Returns all walker profiles that have been saved in KV as a public directory.

app.get("/make-server-f29bc816/walker-directory", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const profiles = ((await kv.getByPrefix("walker:")) ?? []) as any[];
    const walkers = profiles
      .filter(p => p && p.userId) // only complete profiles
      .map(p => ({
        id:        p.userId,
        name:      p.name  ?? "Walker",
        bio:       p.bio   ?? "",
        rate:      p.rate  ?? 22,
        tags:      p.tags  ?? ["Drop-in"],
        verified:  true,
        realUser:  true,
        updatedAt: p.updatedAt,
      }));
    return c.json({ walkers });
  } catch (err) { return c.json({ error: `Failed to get walker directory: ${err}` }, 500); }
});

// ── Walker Availability ────────────────────────────────────────────────────

app.get("/make-server-f29bc816/walker-availability", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const avail = (await kv.get(`availability:${user.id}`)) ?? { status: "available" };
    return c.json({ availability: avail });
  } catch (err) { return c.json({ error: `Failed to get availability: ${err}` }, 500); }
});

app.put("/make-server-f29bc816/walker-availability", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { status } = await c.req.json();
    if (!["available", "busy", "on_walk"].includes(status))
      return c.json({ error: "Invalid status" }, 400);
    const avail = { status, updatedAt: new Date().toISOString() };
    await kv.set(`availability:${user.id}`, avail);
    return c.json({ availability: avail });
  } catch (err) { return c.json({ error: `Failed to update availability: ${err}` }, 500); }
});

// ── Walk Bookings ──────────────────────────────────────────────────────────

app.post("/make-server-f29bc816/walks", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const body = await c.req.json();
    const ts = Date.now();
    const booking = {
      ...body,
      ownerId:    user.id,
      ownerName:  user.user_metadata?.name ?? user.email,
      ts,
      status:     "pending",
      createdAt:  new Date().toISOString(),
    };
    await kv.set(`booking:${user.id}:${ts}`, booking);
    if (body.walkerId) {
      await kv.set(`assignment:${body.walkerId}:${ts}`, booking);
      // Notify walker of new booking request (only for real user IDs)
      if (body.walkerId.includes("-")) { // UUID check
        await createNotification(
          body.walkerId, "new_booking", "New Walk Request! 📅",
          `${user.user_metadata?.name ?? "An owner"} wants to book a ${body.duration ?? "walk"} on ${body.date ?? "soon"}.`,
          { ts, ownerId: user.id, bookingId: `booking:${user.id}:${ts}` },
        );
      }
    }
    console.log("Walk booked:", `booking:${user.id}:${ts}`, "status: pending");
    return c.json({ bookingId: `booking:${user.id}:${ts}`, ts, booking });
  } catch (err) { return c.json({ error: `Failed to save walk: ${err}` }, 500); }
});

app.get("/make-server-f29bc816/walks", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const walks = await kv.getByPrefix(`booking:${user.id}:`);
    const sorted = [...walks].sort((a: any, b: any) =>
      (b.ts ?? 0) - (a.ts ?? 0)
    );
    return c.json({ walks: sorted });
  } catch (err) { return c.json({ error: `Failed to fetch walks: ${err}` }, 500); }
});

// Cancel a booking — owner-initiated via POST (DELETE bodies not reliable cross-platform)
app.post("/make-server-f29bc816/walks/cancel", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { ts, walkerId } = await c.req.json();
    if (!ts) return c.json({ error: "ts is required" }, 400);

    const bookingKey = `booking:${user.id}:${ts}`;
    const existing   = await kv.get(bookingKey) as any;
    if (existing) {
      await kv.set(bookingKey, { ...existing, status: "cancelled", updatedAt: new Date().toISOString() });
    }
    if (walkerId) {
      const assignmentKey = `assignment:${walkerId}:${ts}`;
      const assignment    = await kv.get(assignmentKey) as any;
      if (assignment) {
        await kv.set(assignmentKey, { ...assignment, status: "cancelled", updatedAt: new Date().toISOString() });
        // Notify walker of cancellation
        await createNotification(walkerId, "booking_cancelled", "Booking Cancelled",
          `${user.user_metadata?.name ?? "The owner"} cancelled their booking.`,
          { ts, ownerId: user.id },
        );
      }
    }
    console.log("Walk cancelled:", `booking:${user.id}:${ts}`);
    return c.json({ success: true });
  } catch (err) { return c.json({ error: `Failed to cancel walk: ${err}` }, 500); }
});

// ── Walk Status Update (Walker) ────────────────────────────────────────────

app.put("/make-server-f29bc816/walks/status", async (c) => {
  try {
    const walker = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!walker) return c.json({ error: "Unauthorized" }, 401);
    const { ts, ownerId, status } = await c.req.json();
    const validStatuses = ["accepted", "declined", "in_progress", "completed", "cancelled"];
    if (!validStatuses.includes(status)) return c.json({ error: "Invalid status" }, 400);
    if (!ts || !ownerId) return c.json({ error: "ts and ownerId are required" }, 400);

    const updatedAt = new Date().toISOString();
    const assignmentKey = `assignment:${walker.id}:${ts}`;
    const assignment    = await kv.get(assignmentKey) as any;
    if (assignment) await kv.set(assignmentKey, { ...assignment, status, updatedAt });

    const bookingKey = `booking:${ownerId}:${ts}`;
    const booking    = await kv.get(bookingKey) as any;
    if (booking) await kv.set(bookingKey, { ...booking, status, updatedAt });

    // Notify owner of status change
    const walkerName = walker.user_metadata?.name ?? "Your walker";
    if (status === "accepted") {
      await createNotification(ownerId, "booking_accepted", "Walk Confirmed! ✅",
        `${walkerName} has accepted your booking. Get ready for walkies!`,
        { ts, walkerId: walker.id });
    } else if (status === "declined") {
      await createNotification(ownerId, "booking_declined", "Booking Declined 😔",
        `${walkerName} is unavailable for that time. Try booking another walker.`,
        { ts, walkerId: walker.id });
    } else if (status === "completed") {
      await createNotification(ownerId, "walk_completed", "Walk Complete 🐾",
        `${walkerName} has finished the walk! Check your report card.`,
        { ts, walkerId: walker.id });
    }

    console.log(`Walk ${ts} status → ${status}`);
    return c.json({ success: true, status, ts });
  } catch (err) { return c.json({ error: `Failed to update status: ${err}` }, 500); }
});

// ── Walker Assignments ─────────────────────────────────────────────────────

app.get("/make-server-f29bc816/walker-walks", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const walks  = await kv.getByPrefix(`assignment:${user.id}:`);
    const sorted = [...walks].sort((a: any, b: any) => (b.ts ?? 0) - (a.ts ?? 0));
    return c.json({ walks: sorted });
  } catch (err) { return c.json({ error: `Failed to fetch walker walks: ${err}` }, 500); }
});

// ── Live Walk Position (real-time GPS sharing) ─────────────────────────────
// Walker posts their position; owner polls it.
// KV key: livepos:{ownerId}  — single key per owner, always overwritten with latest.

app.put("/make-server-f29bc816/walk-live-position", async (c) => {
  try {
    const walker = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!walker) return c.json({ error: "Unauthorized" }, 401);
    const body = await c.req.json();
    const { ownerId, position, elapsedMs, distance, pottyCount, walkerName, dogName } = body;
    if (!ownerId || !position) return c.json({ error: "ownerId and position are required" }, 400);
    await kv.set(`livepos:${ownerId}`, {
      position, elapsedMs, distance, pottyCount,
      walkerName: walkerName ?? walker.user_metadata?.name,
      dogName, walkerId: walker.id,
      updatedAt: new Date().toISOString(),
      updatedMs: Date.now(),
    });
    return c.json({ success: true });
  } catch (err) { return c.json({ error: `Failed to post live position: ${err}` }, 500); }
});

app.get("/make-server-f29bc816/walk-live-position", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const liveData = await kv.get(`livepos:${user.id}`);
    return c.json({ live: liveData ?? null });
  } catch (err) { return c.json({ error: `Failed to get live position: ${err}` }, 500); }
});

// Clear live position when walk ends
app.delete("/make-server-f29bc816/walk-live-position", async (c) => {
  try {
    const walker = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!walker) return c.json({ error: "Unauthorized" }, 401);
    const { ownerId } = await c.req.json();
    if (ownerId) await kv.del(`livepos:${ownerId}`);
    return c.json({ success: true });
  } catch (err) { return c.json({ error: `Failed to clear live position: ${err}` }, 500); }
});

// ── Walk Session Summary ───────────────────────────────────────────────────

app.post("/make-server-f29bc816/walk-session", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const body = await c.req.json();
    const ts   = Date.now();
    const session = { ...body, walkerId: user.id, walkerName: user.user_metadata?.name ?? user.email, completedAt: new Date().toISOString() };
    await kv.set(`walksession:${user.id}:${ts}`, session);
    // Clear live position now that walk is over
    if (body.ownerId) await kv.del(`livepos:${body.ownerId}`);
    return c.json({ sessionId: `walksession:${user.id}:${ts}` });
  } catch (err) { return c.json({ error: `Failed to save walk session: ${err}` }, 500); }
});

// ── Report Cards ───────────────────────────────────────────────────────────

app.post("/make-server-f29bc816/reports", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const body = await c.req.json();
    const ts   = Date.now();
    const report = {
      ...body, ts,
      walkerId:    user.id,
      walkerName:  user.user_metadata?.name ?? user.email,
      submittedAt: new Date().toISOString(),
    };
    await kv.set(`report:${user.id}:${ts}`, report);
    const ownerId = body.ownerId;
    if (ownerId) {
      await kv.set(`ownerreport:${ownerId}:${ts}`, report);
      await createNotification(ownerId, "report_ready", "New Report Card 📋",
        `${user.user_metadata?.name ?? "Your walker"} submitted a report for ${body.dogName ?? "your dog"}!`,
        { ts, walkerId: user.id, dogName: body.dogName },
      );
    } else {
      console.log("WARNING: Report saved without ownerId — owner notification skipped");
    }
    console.log("Report saved:", `report:${user.id}:${ts}`);
    return c.json({ reportId: `report:${user.id}:${ts}`, ts, report });
  } catch (err) { return c.json({ error: `Failed to save report: ${err}` }, 500); }
});

app.get("/make-server-f29bc816/reports", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const role   = user.user_metadata?.role;
    const prefix = role === "walker" ? `report:${user.id}:` : `ownerreport:${user.id}:`;
    const reports = await kv.getByPrefix(prefix);
    const sorted  = [...reports].sort((a: any, b: any) =>
      new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime()
    );
    return c.json({ reports: sorted });
  } catch (err) { return c.json({ error: `Failed to fetch reports: ${err}` }, 500); }
});

// Owner rates their walker after receiving a report card
app.put("/make-server-f29bc816/owner-rating", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { ts, ownerRating, comment } = await c.req.json();
    if (!ts || !ownerRating) return c.json({ error: "ts and ownerRating are required" }, 400);

    const reportKey = `ownerreport:${user.id}:${ts}`;
    const report    = await kv.get(reportKey) as any;
    if (!report) return c.json({ error: "Report not found" }, 404);

    const updated = { ...report, ownerRating, ownerComment: comment ?? "", ownerRatedAt: new Date().toISOString() };
    await kv.set(reportKey, updated);

    // Also update the walker's copy so they can see their rating
    const walkerReportKey = `report:${report.walkerId}:${ts}`;
    const walkerReport    = await kv.get(walkerReportKey) as any;
    if (walkerReport) {
      await kv.set(walkerReportKey, { ...walkerReport, ownerRating, ownerComment: comment ?? "" });
      // Notify walker of their rating
      await createNotification(report.walkerId, "owner_rating", `You got ${ownerRating} ⭐!`,
        `${user.user_metadata?.name ?? "The owner"} gave you ${ownerRating}/5 stars for walking ${report.dogName ?? "their dog"}.`,
        { ts, ownerRating },
      );
    }
    return c.json({ success: true, ownerRating });
  } catch (err) { return c.json({ error: `Failed to save owner rating: ${err}` }, 500); }
});

// ── Chat Messages ──────────────────────────────────────────────────────────

app.post("/make-server-f29bc816/messages", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { conversationId, text, senderRole, senderName } = await c.req.json();
    if (!conversationId || !text) return c.json({ error: "conversationId and text are required" }, 400);
    const key      = `chat:${conversationId}:messages`;
    const existing = ((await kv.get(key)) ?? []) as any[];
    const newMsg   = {
      id:         existing.length + 1,
      sender:     senderRole,
      senderName: senderName ?? user.user_metadata?.name ?? user.email,
      text,
      time:       new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      senderId:   user.id,
      createdAt:  new Date().toISOString(),
    };
    await kv.set(key, [...existing, newMsg]);
    return c.json({ message: newMsg });
  } catch (err) { return c.json({ error: `Failed to save message: ${err}` }, 500); }
});

app.get("/make-server-f29bc816/messages/:conversationId", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { conversationId } = c.req.param();
    const messages = (await kv.get(`chat:${conversationId}:messages`)) ?? [];
    return c.json({ messages });
  } catch (err) { return c.json({ error: `Failed to fetch messages: ${err}` }, 500); }
});

// ── Walker Stats & Earnings ────────────────────────────────────────────────

app.get("/make-server-f29bc816/walker-stats", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const [reports, walkerProfile] = await Promise.all([
      kv.getByPrefix(`report:${user.id}:`),
      kv.get(`walker:${user.id}`),
    ]);
    const rate         = (walkerProfile as any)?.rate ?? 22;
    const typedReports = reports as any[];
    const now          = Date.now();
    const todayStart   = new Date().setHours(0, 0, 0, 0);
    const todayWalks   = typedReports.filter(r => new Date(r.submittedAt).getTime() >= todayStart);
    const weekWalks    = typedReports.filter(r => now - new Date(r.submittedAt).getTime() < 7  * 86400000);
    const monthWalks   = typedReports.filter(r => now - new Date(r.submittedAt).getTime() < 30 * 86400000);
    const avgRating    = typedReports.length > 0
      ? typedReports.reduce((s, r) => s + (r.ownerRating || r.rating || 5), 0) / typedReports.length : 0;
    return c.json({
      stats: {
        rate, totalWalks: typedReports.length, totalEarnings: typedReports.length * rate,
        avgRating: Math.round(avgRating * 10) / 10,
        today:  { walks: todayWalks.length,  earnings: todayWalks.length  * rate },
        week:   { walks: weekWalks.length,   earnings: weekWalks.length   * rate },
        month:  { walks: monthWalks.length,  earnings: monthWalks.length  * rate },
        recentWalks: typedReports.slice(0, 20).map(r => ({
          dogName: r.dogName, ownerName: r.ownerName, submittedAt: r.submittedAt,
          duration: r.duration, distance: r.distance, mood: r.mood,
          rating: r.ownerRating ?? r.rating, earnings: rate,
          notes: r.notes?.slice(0, 100),
        })),
      },
    });
  } catch (err) { return c.json({ error: `Failed to get stats: ${err}` }, 500); }
});

// ── Notifications ──────────────────────────────────────────────────────────

app.get("/make-server-f29bc816/notifications", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const notifs  = ((await kv.getByPrefix(`notif:${user.id}:`)) ?? []) as any[];
    const sorted  = notifs.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
    const unread  = sorted.filter(n => !n.read).length;
    return c.json({ notifications: sorted.slice(0, 30), unreadCount: unread });
  } catch (err) { return c.json({ error: `Failed to fetch notifications: ${err}` }, 500); }
});

app.put("/make-server-f29bc816/notifications/read", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization") ?? null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const notifs = ((await kv.getByPrefix(`notif:${user.id}:`)) ?? []) as any[];
    for (const n of notifs) {
      if (!n.read && n.ts) await kv.set(`notif:${user.id}:${n.ts}`, { ...n, read: true });
    }
    return c.json({ success: true });
  } catch (err) { return c.json({ error: `Failed to mark notifications: ${err}` }, 500); }
});

Deno.serve(app.fetch);