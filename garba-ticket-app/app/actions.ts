"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { SESSION_COOKIE, createToken, verifyCredentials } from "@/lib/auth"
import { currentUser } from "@/lib/session"
import { getPagePoc, setFlag, type FlagField } from "@/lib/notion"
import { getSettings, saveSettings, type Settings } from "@/lib/settings"

export interface LoginState {
  error?: string
}

const SESSION_MAX_AGE = 60 * 60 * 12 // 12h

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") || "")
  const password = String(formData.get("password") || "")
  const user = await verifyCredentials(username, password)
  if (!user) return { error: "Invalid username or password." }

  const store = await cookies()
  store.set(SESSION_COOKIE, createToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  })
  redirect(user.role === "admin" ? "/admin" : "/dashboard")
}

export async function logout(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  redirect("/")
}

export interface ToggleResult {
  success: boolean
  message: string
}

/**
 * Flip the "Contacted" or "Paid" checkbox on a request — the only writes this
 * app performs. Authorized server-side:
 *   - POCs may only touch requests assigned to them (scoped by "Assigned ISO POC"),
 *     so one POC can never modify another's tickets even by guessing a page id.
 *   - Admins may fulfill on any POC's behalf (used by the admin per-POC view).
 */
export async function toggleFlag(pageId: string, field: FlagField, value: boolean): Promise<ToggleResult> {
  const user = await currentUser()
  if (!user) return { success: false, message: "Session expired — please sign in again." }
  if (field !== "paid" && field !== "contacted") {
    return { success: false, message: "That action isn't allowed." }
  }

  // Ownership check applies to POCs only; admins can act on any request.
  if (user.role !== "admin") {
    let owner: string | null
    try {
      owner = await getPagePoc(pageId)
    } catch {
      return { success: false, message: "Couldn't reach Notion. Try again." }
    }
    if (!owner || owner.toLowerCase() !== user.name.toLowerCase()) {
      return { success: false, message: "That request isn't assigned to you." }
    }
  }

  try {
    await setFlag(pageId, field, value)
  } catch {
    return { success: false, message: "Update failed. Try again." }
  }

  revalidatePath("/dashboard")
  revalidatePath("/admin")
  if (field === "paid") {
    return { success: true, message: value ? "Marked as paid — moved to Completed." : "Reopened — moved back to Active." }
  }
  return { success: true, message: value ? "Marked as contacted." : "Contacted cleared." }
}

export interface SaveSettingsResult {
  success: boolean
  message: string
}

/**
 * Admin-only: persist prices / bulk tiers / POC roster to the shared config store.
 * The agent reads these live (cached ~60s), so changes reflect without a redeploy.
 */
export async function saveSettingsAction(settings: Settings): Promise<SaveSettingsResult> {
  const user = await currentUser()
  if (!user || user.role !== "admin") {
    return { success: false, message: "Admins only." }
  }
  try {
    await saveSettings(settings)
  } catch (err) {
    return { success: false, message: `Save failed: ${(err as Error).message}` }
  }
  revalidatePath("/admin")
  return { success: true, message: "Settings saved. The agent will pick them up shortly." }
}

/** Admin-only: reload current settings (used to refresh the form). */
export async function getSettingsAction(): Promise<Settings | null> {
  const user = await currentUser()
  if (!user || user.role !== "admin") return null
  return getSettings()
}
