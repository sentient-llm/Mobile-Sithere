import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";

type AppRole = "owner" | "walker" | "admin";
type WalkStatus = "pending" | "accepted" | "declined" | "in_progress" | "completed" | "cancelled";

const app = new Hono();

app.use("*", logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function anonClient(token: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
}

function bearer(c: any): string | null {
  const auth = c.req.header("Authorization") ?? "";
  const [, token] = auth.split(" ");
  return token || null;
}

async function authUser(c: any) {
  const token = bearer(c);
  if (!token) return { token: null, user: null };
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) return { token, user: null };
  return { token, user: data.user };
}

async function requireUser(c: any) {
  const auth = await authUser(c);
  if (!auth.user || !auth.token) {
    return { response: c.json({ error: "Unauthorized" }, 401) };
  }
  return { token: auth.token, user: auth.user, db: anonClient(auth.token), admin: adminClient() };
}

async function ensureProfile(admin: ReturnType<typeof adminClient>, user: any, body?: any) {
  const email = user.email ?? body?.email ?? "";
  const fullName = body?.fullName ?? body?.name ?? user.user_metadata?.name ?? email.split("@")[0] ?? "User";
  const role = (body?.role ?? user.app_metadata?.role ?? user.user_metadata?.role ?? "owner") as AppRole;
  const { data: existing } = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (existing) return existing;
  const { data, error } = await admin.from("profiles").insert({
    id: user.id,
    role,
    full_name: fullName,
    email,
  }).select("*").single();
  if (error) throw error;
  if (role === "owner") {
    await admin.from("owner_profiles").upsert({ user_id: user.id });
  } else if (role === "walker") {
    await admin.from("walker_profiles").upsert({ user_id: user.id, bio: body?.bio ?? "" });
  }
  return data;
}

async function notify(admin: ReturnType<typeof adminClient>, userId: string, type: string, title: string, body: string, data = {}) {
  await admin.from("notifications").insert({ user_id: userId, type, title, body, data });
}

function ok(c: any, data: object = {}) {
  return c.json(data);
}

function fail(c: any, error: unknown, prefix = "Request failed") {
  console.log(prefix, error);
  const message = error instanceof Error ? error.message : String(error);
  return c.json({ error: `${prefix}: ${message}` }, 500);
}

app.get("/v1/health", (c) => c.json({ status: "ok", service: "sit-here-api-v1" }));

app.get("/v1/me", async (c) => {
  try {
    const req = await requireUser(c);
    if ("response" in req) return req.response;
    const profile = await ensureProfile(req.admin, req.user);
    const [ownerProfile, walkerProfile, pets] = await Promise.all([
      req.admin.from("owner_profiles").select("*").eq("user_id", req.user.id).maybeSingle(),
      req.admin.from("walker_profiles").select("*").eq("user_id", req.user.id).maybeSingle(),
      req.admin.from("pets").select("*").eq("owner_id", req.user.id).order("created_at"),
    ]);
    return ok(c, {
      user: { id: req.user.id, email: req.user.email },
      profile,
      ownerProfile: ownerProfile.data,
      walkerProfile: walkerProfile.data,
      pets: pets.data ?? [],
    });
  } catch (e) {
    return fail(c, e, "Failed to load profile");
  }
});

app.delete("/v1/me", async (c) => {
  try {
    const req = await requireUser(c);
    if ("response" in req) return req.response;
    await req.admin.from("profiles").update({ deleted_at: new Date().toISOString() }).eq("id", req.user.id);
    const { error } = await req.admin.auth.admin.deleteUser(req.user.id);
    if (error) throw error;
    return ok(c, { success: true });
  } catch (e) {
    return fail(c, e, "Failed to delete account");
  }
});

app.post("/v1/me", async (c) => {
  try {
    const req = await requireUser(c);
    if ("response" in req) return req.response;
    const body = await c.req.json();
    const profile = await ensureProfile(req.admin, req.user, body);
    const { data, error } = await req.admin.from("profiles").update({
      full_name: body.fullName ?? profile.full_name,
      phone: body.phone ?? profile.phone,
      role: body.role ?? profile.role,
    }).eq("id", req.user.id).select("*").single();
    if (error) throw error;
    if ((body.role ?? profile.role) === "owner") await req.admin.from("owner_profiles").upsert({ user_id: req.user.id });
    if ((body.role ?? profile.role) === "walker") await req.admin.from("walker_profiles").upsert({ user_id: req.user.id, bio: body.bio ?? "" });
    return ok(c, { profile: data });
  } catch (e) {
    return fail(c, e, "Failed to save profile");
  }
});

app.post("/v1/pets", async (c) => {
  try {
    const req = await requireUser(c);
    if ("response" in req) return req.response;
    await ensureProfile(req.admin, req.user, { role: "owner" });
    const body = await c.req.json();
    const { data, error } = await req.db.from("pets").insert({
      owner_id: req.user.id,
      name: body.name,
      breed: body.breed,
      age_years: body.ageYears,
      weight_lbs: body.weightLbs,
      notes: body.notes,
      photo_path: body.photoPath,
    }).select("*").single();
    if (error) throw error;
    return ok(c, { pet: data });
  } catch (e) {
    return fail(c, e, "Failed to save pet");
  }
});

app.get("/v1/walkers", async (c) => {
  try {
    const req = await requireUser(c);
    if ("response" in req) return req.response;
    const { data, error } = await req.admin
      .from("walker_profiles")
      .select("*, profile:profiles!walker_profiles_user_id_fkey(id, full_name, email, avatar_path)")
      .order("verified", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return ok(c, { walkers: data ?? [] });
  } catch (e) {
    return fail(c, e, "Failed to load walkers");
  }
});

app.post("/v1/walk-requests", async (c) => {
  try {
    const req = await requireUser(c);
    if ("response" in req) return req.response;
    await ensureProfile(req.admin, req.user, { role: "owner" });
    const body = await c.req.json();
    const walker = body.walkerId
      ? await req.admin.from("walker_profiles").select("rate_cents").eq("user_id", body.walkerId).maybeSingle()
      : { data: null };
    const { data, error } = await req.admin.from("walk_requests").insert({
      owner_id: req.user.id,
      pet_id: body.petId,
      walker_id: body.walkerId,
      requested_start_at: body.requestedStartAt,
      duration_minutes: body.durationMinutes,
      address: body.address,
      notes: body.notes,
      walker_rate_cents: body.walkerRateCents ?? walker.data?.rate_cents ?? 2200,
      service_fee_cents: body.serviceFeeCents ?? 200,
    }).select("*").single();
    if (error) throw error;
    if (body.walkerId) {
      await req.admin.from("conversations").insert({
        walk_request_id: data.id,
        owner_id: req.user.id,
        walker_id: body.walkerId,
      });
      await notify(req.admin, body.walkerId, "new_booking", "New walk request", "An owner sent you a walk request.", { walkRequestId: data.id });
    }
    return ok(c, { walkRequest: data });
  } catch (e) {
    return fail(c, e, "Failed to create walk request");
  }
});

app.patch("/v1/walk-requests/:id/status", async (c) => {
  try {
    const req = await requireUser(c);
    if ("response" in req) return req.response;
    const { id } = c.req.param();
    const { status } = await c.req.json() as { status: WalkStatus };
    if (!["accepted", "declined", "in_progress", "completed", "cancelled"].includes(status)) {
      return c.json({ error: "Invalid status" }, 400);
    }
    const { data: walk, error: loadError } = await req.admin.from("walk_requests").select("*").eq("id", id).single();
    if (loadError) throw loadError;
    if (walk.owner_id !== req.user.id && walk.walker_id !== req.user.id) return c.json({ error: "Forbidden" }, 403);
    const patch: Record<string, unknown> = { status };
    const { data, error } = await req.admin.from("walk_requests").update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    await req.admin.from("walk_assignments").update({
      status,
      accepted_at: status === "accepted" ? new Date().toISOString() : undefined,
      declined_at: status === "declined" ? new Date().toISOString() : undefined,
    }).eq("walk_request_id", id);
    const target = req.user.id === walk.owner_id ? walk.walker_id : walk.owner_id;
    if (target) {
      const type = status === "accepted" ? "booking_accepted" : status === "declined" ? "booking_declined" : status === "cancelled" ? "booking_cancelled" : status === "completed" ? "walk_completed" : "walk_started";
      await notify(req.admin, target, type, "Walk updated", `Walk status changed to ${status.replace("_", " ")}.`, { walkRequestId: id });
    }
    return ok(c, { walkRequest: data });
  } catch (e) {
    return fail(c, e, "Failed to update walk status");
  }
});

app.post("/v1/walk-sessions", async (c) => {
  try {
    const req = await requireUser(c);
    if ("response" in req) return req.response;
    const body = await c.req.json();
    const { data: walk, error: walkError } = await req.admin.from("walk_requests").select("*").eq("id", body.walkRequestId).single();
    if (walkError) throw walkError;
    if (walk.walker_id !== req.user.id) return c.json({ error: "Forbidden" }, 403);
    const { data, error } = await req.admin.from("walk_sessions").upsert({
      walk_request_id: walk.id,
      owner_id: walk.owner_id,
      walker_id: walk.walker_id,
      pet_id: walk.pet_id,
      status: body.status ?? "active",
      started_at: body.startedAt ?? new Date().toISOString(),
    }, { onConflict: "walk_request_id" }).select("*").single();
    if (error) throw error;
    await req.admin.from("walk_requests").update({ status: "in_progress" }).eq("id", walk.id);
    await notify(req.admin, walk.owner_id, "walk_started", "Walk started", "Your walker has started the walk.", { walkSessionId: data.id });
    return ok(c, { walkSession: data });
  } catch (e) {
    return fail(c, e, "Failed to start walk session");
  }
});

app.post("/v1/walk-sessions/:id/location", async (c) => {
  try {
    const req = await requireUser(c);
    if ("response" in req) return req.response;
    const { id } = c.req.param();
    const body = await c.req.json();
    const { data: session, error: sessionError } = await req.admin.from("walk_sessions").select("*").eq("id", id).single();
    if (sessionError) throw sessionError;
    if (session.walker_id !== req.user.id) return c.json({ error: "Forbidden" }, 403);
    const { data, error } = await req.admin.from("live_locations").upsert({
      walk_session_id: id,
      owner_id: session.owner_id,
      walker_id: session.walker_id,
      latitude: body.latitude,
      longitude: body.longitude,
      accuracy_meters: body.accuracyMeters,
      heading_degrees: body.headingDegrees,
      speed_mps: body.speedMps,
      elapsed_seconds: body.elapsedSeconds ?? 0,
      distance_miles: body.distanceMiles ?? 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "walk_session_id" }).select("*").single();
    if (error) throw error;
    await req.admin.from("walk_sessions").update({
      elapsed_seconds: body.elapsedSeconds ?? session.elapsed_seconds,
      distance_miles: body.distanceMiles ?? session.distance_miles,
      potty_count: body.pottyCount ?? session.potty_count,
      water_count: body.waterCount ?? session.water_count,
      photo_count: body.photoCount ?? session.photo_count,
    }).eq("id", id);
    return ok(c, { liveLocation: data });
  } catch (e) {
    return fail(c, e, "Failed to save live location");
  }
});

app.get("/v1/walk-sessions/:id/location", async (c) => {
  try {
    const req = await requireUser(c);
    if ("response" in req) return req.response;
    const { id } = c.req.param();
    const { data, error } = await req.db.from("live_locations").select("*").eq("walk_session_id", id).maybeSingle();
    if (error) throw error;
    return ok(c, { liveLocation: data });
  } catch (e) {
    return fail(c, e, "Failed to load live location");
  }
});

app.post("/v1/reports", async (c) => {
  try {
    const req = await requireUser(c);
    if ("response" in req) return req.response;
    const body = await c.req.json();
    const { data: session, error: sessionError } = await req.admin.from("walk_sessions").select("*").eq("id", body.walkSessionId).single();
    if (sessionError) throw sessionError;
    if (session.walker_id !== req.user.id) return c.json({ error: "Forbidden" }, 403);
    const { data, error } = await req.admin.from("reports").insert({
      walk_session_id: session.id,
      owner_id: session.owner_id,
      walker_id: session.walker_id,
      pet_id: session.pet_id,
      mood: body.mood,
      notes: body.notes,
      potty_pee: body.pottyPee ?? 0,
      potty_poop: body.pottyPoop ?? 0,
      ate: body.ate ?? false,
      drank: body.drank ?? false,
    }).select("*").single();
    if (error) throw error;
    await req.admin.from("walk_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", session.id);
    await req.admin.from("walk_requests").update({ status: "completed" }).eq("id", session.walk_request_id);
    await notify(req.admin, session.owner_id, "report_ready", "Report card ready", "Your walker submitted a report card.", { reportId: data.id });
    return ok(c, { report: data });
  } catch (e) {
    return fail(c, e, "Failed to submit report");
  }
});

app.post("/v1/reports/:id/photos", async (c) => {
  try {
    const req = await requireUser(c);
    if ("response" in req) return req.response;
    const { id } = c.req.param();
    const body = await c.req.json();
    const { data: report, error: reportError } = await req.admin.from("reports").select("*").eq("id", id).single();
    if (reportError) throw reportError;
    if (report.walker_id !== req.user.id) return c.json({ error: "Forbidden" }, 403);
    const { data, error } = await req.admin.from("report_photos").insert({
      report_id: id,
      owner_id: report.owner_id,
      walker_id: report.walker_id,
      storage_path: body.storagePath,
      caption: body.caption,
    }).select("*").single();
    if (error) throw error;
    return ok(c, { photo: data });
  } catch (e) {
    return fail(c, e, "Failed to attach report photo");
  }
});

app.get("/v1/conversations", async (c) => {
  try {
    const req = await requireUser(c);
    if ("response" in req) return req.response;
    const { data, error } = await req.db
      .from("conversations")
      .select("*, owner:profiles!conversations_owner_id_fkey(id, full_name), walker:profiles!conversations_walker_id_fkey(id, full_name)")
      .or(`owner_id.eq.${req.user.id},walker_id.eq.${req.user.id}`)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return ok(c, { conversations: data ?? [] });
  } catch (e) {
    return fail(c, e, "Failed to load conversations");
  }
});

app.get("/v1/conversations/:id/messages", async (c) => {
  try {
    const req = await requireUser(c);
    if ("response" in req) return req.response;
    const { id } = c.req.param();
    const { data, error } = await req.db.from("messages").select("*").eq("conversation_id", id).order("created_at");
    if (error) throw error;
    return ok(c, { messages: data ?? [] });
  } catch (e) {
    return fail(c, e, "Failed to load messages");
  }
});

app.post("/v1/messages", async (c) => {
  try {
    const req = await requireUser(c);
    if ("response" in req) return req.response;
    const body = await c.req.json();
    const { data, error } = await req.db.from("messages").insert({
      conversation_id: body.conversationId,
      sender_id: req.user.id,
      body: body.body,
    }).select("*").single();
    if (error) throw error;
    await req.admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", body.conversationId);
    const { data: conversation } = await req.admin.from("conversations").select("*").eq("id", body.conversationId).single();
    const target = conversation?.owner_id === req.user.id ? conversation.walker_id : conversation?.owner_id;
    if (target) await notify(req.admin, target, "chat_message", "New message", body.body.slice(0, 120), { conversationId: body.conversationId });
    return ok(c, { message: data });
  } catch (e) {
    return fail(c, e, "Failed to send message");
  }
});

app.post("/v1/payments/payment-intent", async (c) => {
  try {
    const req = await requireUser(c);
    if ("response" in req) return req.response;
    const body = await c.req.json();
    const { data: walk, error: walkError } = await req.admin.from("walk_requests").select("*").eq("id", body.walkRequestId).single();
    if (walkError) throw walkError;
    if (walk.owner_id !== req.user.id) return c.json({ error: "Forbidden" }, 403);

    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      return c.json({ error: "STRIPE_SECRET_KEY is required before production payments can be created" }, 503);
    }

    const form = new URLSearchParams();
    form.set("amount", String(walk.total_cents));
    form.set("currency", "usd");
    form.set("automatic_payment_methods[enabled]", "true");
    form.set("metadata[walk_request_id]", walk.id);
    form.set("metadata[owner_id]", walk.owner_id);
    if (walk.walker_id) form.set("metadata[walker_id]", walk.walker_id);

    const stripeRes = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const stripeJson = await stripeRes.json();
    if (!stripeRes.ok) return c.json({ error: stripeJson?.error?.message ?? "Stripe request failed" }, 502);

    const { data: payment, error } = await req.admin.from("payments").upsert({
      walk_request_id: walk.id,
      owner_id: walk.owner_id,
      walker_id: walk.walker_id,
      amount_cents: walk.total_cents,
      status: stripeJson.status,
      stripe_payment_intent_id: stripeJson.id,
    }, { onConflict: "stripe_payment_intent_id" }).select("*").single();
    if (error) throw error;
    await req.admin.from("walk_requests").update({ stripe_payment_intent_id: stripeJson.id }).eq("id", walk.id);
    return ok(c, { payment, clientSecret: stripeJson.client_secret });
  } catch (e) {
    return fail(c, e, "Failed to create payment intent");
  }
});

app.post("/v1/device-tokens", async (c) => {
  try {
    const req = await requireUser(c);
    if ("response" in req) return req.response;
    const body = await c.req.json();
    const { data, error } = await req.admin.from("device_tokens").upsert({
      user_id: req.user.id,
      platform: body.platform ?? "ios",
      token: body.token,
      environment: body.environment ?? "sandbox",
    }, { onConflict: "user_id,token" }).select("*").single();
    if (error) throw error;
    await req.admin.from("profiles").update({ push_enabled: true }).eq("id", req.user.id);
    return ok(c, { deviceToken: data });
  } catch (e) {
    return fail(c, e, "Failed to register device token");
  }
});

app.get("/v1/notifications", async (c) => {
  try {
    const req = await requireUser(c);
    if ("response" in req) return req.response;
    const { data, error } = await req.db.from("notifications").select("*").eq("user_id", req.user.id).order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return ok(c, { notifications: data ?? [], unreadCount: (data ?? []).filter((n: any) => !n.read_at).length });
  } catch (e) {
    return fail(c, e, "Failed to load notifications");
  }
});

app.get("/v1/vets", async (c) => {
  try {
    const { data, error } = await adminClient().from("vet_locations").select("*").order("emergency", { ascending: false }).order("rating", { ascending: false });
    if (error) throw error;
    return ok(c, { vets: data ?? [] });
  } catch (e) {
    return fail(c, e, "Failed to load vets");
  }
});

Deno.serve(app.fetch);
