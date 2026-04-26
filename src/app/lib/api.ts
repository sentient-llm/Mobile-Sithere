/**
 * Centralized authenticated API helper.
 *
 * Root-cause note on 401s:
 * ─────────────────────────────────────────────────────────────────────────
 * Supabase's Edge Function *infrastructure* validates the JWT in the
 * Authorization header before the request reaches our Hono router.
 * If the stored access_token is expired it returns 401 with a
 * {"message":"..."} body — NOT our {"error":"Unauthorized"} — so
 * json?.error is undefined and we see the fallback message.
 *
 * `supabase.auth.getSession()` restores the session from localStorage on
 * page load. If the token is expired, Supabase's autoRefreshToken fires
 * asynchronously, creating a window where the old, expired token is
 * returned before the refresh completes.
 *
 * Fix: decode the JWT expiry locally (no network call). If the token is
 * expired or within 60 s of expiry, explicitly await refreshSession()
 * before sending any request.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { supabase } from "./supabase";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-f29bc816`;

/** Decode JWT payload without a library — works on any modern browser/Deno. */
function jwtExpiresAt(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  } catch {
    return 0; // treat parse failure as already-expired
  }
}

/** True when the token will expire within the next 60 seconds. */
function isExpiredOrExpiring(token: string): boolean {
  return jwtExpiresAt(token) < Date.now() + 60_000;
}

/**
 * Returns a fresh, valid access token.
 * 1. Reads the stored session.
 * 2. If the token is absent, expired, or about to expire → refresh first.
 * 3. Falls back to the publicAnonKey so the Supabase function can at least
 *    be invoked (the server then returns 401 "Unauthorized" from our own
 *    handler, which is handled correctly).
 */
async function getFreshToken(): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.access_token && !isExpiredOrExpiring(session.access_token)) {
      return session.access_token; // token is still fresh ✓
    }

    // Token is missing, expired, or expiring — try to refresh
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session?.access_token) {
      return refreshed.session.access_token; // refreshed ✓
    }
  } catch (e) {
    console.warn("[api] getToken error:", e);
  }

  // Last resort: use the anon key so the function can be invoked;
  // the server-side auth guard will return a proper 401 "Unauthorized"
  // and components handle that gracefully.
  return publicAnonKey;
}

export async function api<T = unknown>(
  path: string,
  method = "GET",
  body?: object,
): Promise<T> {
  const token = await getFreshToken();

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let json: any;
  try { json = await res.json(); } catch { json = {}; }

  if (!res.ok) {
    const msg = json?.error ?? json?.message ?? `API ${method} ${path} failed (${res.status})`;
    console.error("[api]", msg);
    throw new Error(msg);
  }
  return json as T;
}

export const apiGet  = <T = unknown>(path: string)                => api<T>(path, "GET");
export const apiPost = <T = unknown>(path: string, body: object)  => api<T>(path, "POST",  body);
export const apiPut  = <T = unknown>(path: string, body: object)  => api<T>(path, "PUT",   body);
export const apiDel  = <T = unknown>(path: string)                => api<T>(path, "DELETE");
