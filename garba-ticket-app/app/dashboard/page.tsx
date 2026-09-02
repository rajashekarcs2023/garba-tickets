import { redirect } from "next/navigation"

import { currentPoc } from "@/lib/session"
import { getBookingsForPoc, notionConfigured } from "@/lib/notion"
import { BookingsBoard } from "@/components/bookings-board"

export const dynamic = "force-dynamic"

const EVENT_NAME = process.env.EVENT_NAME || "SJSU ISO Raas Garba x DJ Night"

export default async function DashboardPage() {
  const poc = await currentPoc()
  if (!poc) redirect("/")

  const ready = notionConfigured()
  const bookings = ready ? await getBookingsForPoc(poc) : []

  return <BookingsBoard poc={poc} event={EVENT_NAME} bookings={bookings} notionReady={ready} />
}
