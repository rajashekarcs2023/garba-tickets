import { redirect } from "next/navigation"

import { currentUser } from "@/lib/session"
import { getAllBookings, notionConfigured } from "@/lib/notion"
import { configConfigured, getSettings } from "@/lib/settings"
import { computePocStats, rankPocStats } from "@/lib/metrics"
import { Leaderboard } from "@/components/leaderboard"

export const dynamic = "force-dynamic"

const EVENT_NAME = process.env.EVENT_NAME || "SJSU ISO Raas Garba x DJ Night"

export default async function LeaderboardPage() {
  const user = await currentUser()
  if (!user) redirect("/")

  const settings = configConfigured() ? await getSettings() : null
  const roster = (settings?.points_of_contact ?? []).map((p) => p.name).filter(Boolean)
  const symbol = settings?.currency_symbol || "$"

  const bookings = notionConfigured() ? await getAllBookings() : []
  const stats = rankPocStats(computePocStats(bookings, roster))

  return (
    <Leaderboard
      event={EVENT_NAME}
      stats={stats}
      symbol={symbol}
      backHref={user.role === "admin" ? "/admin" : "/dashboard"}
    />
  )
}
