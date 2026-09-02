import { cookies } from "next/headers"
import { SESSION_COOKIE, verifyToken, type SessionUser } from "./auth"

/** The signed-in user ({ name, role }) from the session cookie, or null. Server-only. */
export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies()
  return verifyToken(store.get(SESSION_COOKIE)?.value)
}

/** The signed-in POC name (only for role "poc"), or null. */
export async function currentPoc(): Promise<string | null> {
  const user = await currentUser()
  return user && user.role === "poc" ? user.name : null
}
