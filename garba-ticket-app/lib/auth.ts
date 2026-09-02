/**
 * Minimal role-based auth for the Garba dashboard (server-only).
 *
 * Two credential lists live in env as comma-separated "Name:password" entries:
 *   - POC_USERS   -> role "poc";   Name MUST match the "Assigned ISO POC" value
 *                    the agent writes to Notion (that's what scopes their view).
 *   - ADMIN_USERS -> role "admin"; can manage settings (prices/tiers/POC roster).
 * A signed, httpOnly cookie carries { name, role }; the Notion token never
 * touches the browser.
 *
 *   POC_USERS="Zoha Dhanani:zoha123, Diya Patel:diya456"
 *   ADMIN_USERS="admin:supersecret"
 *   AUTH_SECRET="<long random string>"
 */

import crypto from "crypto"

import { getSettings } from "./settings"

export const SESSION_COOKIE = "garba_poc"
const SESSION_TTL_SECONDS = 60 * 60 * 12 // 12h

export type Role = "poc" | "admin"
export interface SessionUser {
  name: string
  role: Role
}

function secret(): string {
  return (process.env.AUTH_SECRET || "").trim() || "dev-insecure-secret-change-me"
}

/** Parse "Name:pass, Name2:pass2" into an ordered list. */
function parseUsers(raw: string | undefined): { name: string; password: string }[] {
  const out: { name: string; password: string }[] = []
  for (const entry of (raw || "").split(",")) {
    const trimmed = entry.trim()
    if (!trimmed) continue
    const idx = trimmed.indexOf(":")
    if (idx <= 0) continue
    const name = trimmed.slice(0, idx).trim()
    const password = trimmed.slice(idx + 1).trim()
    if (name && password) out.push({ name, password })
  }
  return out
}

function pocUsers() {
  return parseUsers(process.env.POC_USERS)
}

function adminUsers() {
  return parseUsers(process.env.ADMIN_USERS)
}

export function authConfigured(): boolean {
  return pocUsers().length > 0 || adminUsers().length > 0
}

/** All configured POC names (for the agent roster / not required). */
export function pocNames(): string[] {
  return pocUsers().map((u) => u.name)
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url")
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

/**
 * Validate a username/password. Order: env admins, env POCs (legacy), then the
 * live POC roster in the Notion config store (admins add POC logins there, so a
 * new POC can sign in without an env change or redeploy). Returns the canonical
 * name + role on success, or null. Username match is case-insensitive; password
 * uses a constant-time compare.
 */
export async function verifyCredentials(username: string, password: string): Promise<SessionUser | null> {
  const u = (username || "").trim().toLowerCase()
  const p = password || ""
  for (const entry of adminUsers()) {
    if (entry.name.toLowerCase() === u && timingSafeEqual(p, entry.password)) {
      return { name: entry.name, role: "admin" }
    }
  }
  for (const entry of pocUsers()) {
    if (entry.name.toLowerCase() === u && timingSafeEqual(p, entry.password)) {
      return { name: entry.name, role: "poc" }
    }
  }
  // POCs managed live in the Notion config (name + optional login password).
  try {
    const { points_of_contact } = await getSettings()
    for (const poc of points_of_contact) {
      const pw = (poc.password || "").trim()
      if (pw && poc.name.toLowerCase() === u && timingSafeEqual(p, pw)) {
        return { name: poc.name, role: "poc" }
      }
    }
  } catch {
    // Config unreachable — env credentials above still work.
  }
  return null
}

/** Create a signed session token for a user. */
export function createToken(user: SessionUser): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const payload = Buffer.from(JSON.stringify({ name: user.name, role: user.role, exp })).toString("base64url")
  return `${payload}.${sign(payload)}`
}

/** Verify a session token and return the user, or null if invalid/expired. */
export function verifyToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null
  const [payload, sig] = token.split(".")
  if (!payload || !sig) return null
  if (!timingSafeEqual(sig, sign(payload))) return null
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    if (!data?.name || typeof data.exp !== "number") return null
    if (Math.floor(Date.now() / 1000) > data.exp) return null
    const role: Role = data.role === "admin" ? "admin" : "poc"
    return { name: String(data.name), role }
  } catch {
    return null
  }
}
