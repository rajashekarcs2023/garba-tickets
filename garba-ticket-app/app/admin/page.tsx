import { redirect } from "next/navigation"

import { currentUser } from "@/lib/session"
import { configConfigured, getSettings } from "@/lib/settings"
import { getAllBookings, notionConfigured } from "@/lib/notion"
import { AdminHome } from "@/components/admin-home"

export const dynamic = "force-dynamic"

const EVENT_NAME = process.env.EVENT_NAME || "SJSU ISO Raas Garba x DJ Night"

export default async function AdminPage() {
  const user = await currentUser()
  if (!user) redirect("/")
  if (user.role !== "admin") redirect("/dashboard")

  const configReady = configConfigured()
  const settings = configReady ? await getSettings() : null
  const notionReady = notionConfigured()
  const bookings = notionReady ? await getAllBookings() : []
  const roster = (settings?.points_of_contact ?? []).map((p) => p.name).filter(Boolean)

  return (
    <AdminHome
      admin={user.name}
      event={EVENT_NAME}
      bookings={bookings}
      roster={roster}
      settings={settings}
      configReady={configReady}
      notionReady={notionReady}
    />
  )
}
