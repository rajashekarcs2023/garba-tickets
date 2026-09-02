import { redirect } from "next/navigation"

import { currentUser } from "@/lib/session"
import { configConfigured, getSettings } from "@/lib/settings"
import { AdminSettings } from "@/components/admin-settings"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const user = await currentUser()
  if (!user) redirect("/")
  if (user.role !== "admin") redirect("/dashboard")

  const ready = configConfigured()
  const settings = ready ? await getSettings() : null

  return <AdminSettings admin={user.name} settings={settings} configReady={ready} />
}
