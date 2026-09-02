"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import { CheckCircle2, LogOut, RotateCcw, Trophy } from "lucide-react"

import { logout, toggleFlag } from "@/app/actions"
import type { Booking } from "@/lib/notion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function formatAmount(amount: number | null): string {
  return amount == null ? "—" : `$${amount.toFixed(2)}`
}

export function BookingsBoard({
  poc,
  event,
  bookings,
  notionReady,
}: {
  poc: string
  event: string
  bookings: Booking[]
  notionReady: boolean
}) {
  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-rose-700">{event}</h1>
            <p className="text-sm text-muted-foreground">
              Point of contact: <span className="font-medium text-foreground">{poc}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/leaderboard">
                <Trophy className="mr-2 h-4 w-4" />
                Leaderboard
              </Link>
            </Button>
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </form>
          </div>
        </header>

        {!notionReady ? (
          <Card>
            <CardHeader>
              <CardTitle>Notion isn&apos;t configured</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Set <code>NOTION_TOKEN</code> and <code>NOTION_DATABASE_ID</code> in the environment to load requests.
            </CardContent>
          </Card>
        ) : (
          <BookingsView bookings={bookings} />
        )}
      </div>
    </main>
  )
}

/** Active/Completed tabs + tables. Reused read-only in the admin overview. */
export function BookingsView({
  bookings,
  readOnly = false,
  showPoc = false,
}: {
  bookings: Booking[]
  readOnly?: boolean
  showPoc?: boolean
}) {
  const active = bookings.filter((b) => !b.paid)
  const completed = bookings.filter((b) => b.paid)

  return (
    <Tabs defaultValue="active">
      <TabsList>
        <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
        <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="active">
        <BookingsTable rows={active} mode="active" readOnly={readOnly} showPoc={showPoc} />
      </TabsContent>
      <TabsContent value="completed">
        <BookingsTable rows={completed} mode="completed" readOnly={readOnly} showPoc={showPoc} />
      </TabsContent>
    </Tabs>
  )
}

function BookingsTable({
  rows,
  mode,
  readOnly,
  showPoc,
}: {
  rows: Booking[]
  mode: "active" | "completed"
  readOnly: boolean
  showPoc: boolean
}) {
  if (rows.length === 0) {
    return (
      <Card className="mt-4">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {mode === "active" ? "No open requests. New ASI:One requests will appear here." : "Nothing completed yet."}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-4">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {showPoc ? <TableHead>POC</TableHead> : null}
                <TableHead>Requested by</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-center">Tickets</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">{readOnly ? "Status" : "Action"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.pageId}>
                  {showPoc ? <TableCell className="font-medium">{b.poc || "—"}</TableCell> : null}
                  <TableCell className="font-medium">{b.name || "—"}</TableCell>
                  <TableCell className="text-sm">
                    <div>{b.email || "—"}</div>
                    <div className="text-muted-foreground">{b.phone || "—"}</div>
                  </TableCell>
                  <TableCell className="text-center">{b.quantity || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={b.paymentMethod?.toLowerCase() === "online" ? "secondary" : "outline"}>
                      {b.paymentMethod || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatAmount(b.amount)}</TableCell>
                  <TableCell className="font-mono text-xs">{b.code || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(b.submitted)}</TableCell>
                  <TableCell className="text-right">
                    {readOnly ? <StatusBadges booking={b} mode={mode} /> : <RowActions booking={b} mode={mode} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusBadges({ booking, mode }: { booking: Booking; mode: "active" | "completed" }) {
  if (mode === "completed") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Paid
      </Badge>
    )
  }
  return (
    <Badge variant={booking.contacted ? "secondary" : "outline"}>
      {booking.contacted ? "Contacted" : "Not contacted"}
    </Badge>
  )
}

function RowActions({ booking, mode }: { booking: Booking; mode: "active" | "completed" }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function run(field: "contacted" | "paid", value: boolean) {
    startTransition(async () => {
      const res = await toggleFlag(booking.pageId, field, value)
      if (res.success) {
        toast.success(res.message)
        router.refresh()
      } else {
        toast.error(res.message)
      }
    })
  }

  if (mode === "completed") {
    return (
      <div className="flex items-center justify-end gap-2">
        <Badge className="bg-emerald-600 hover:bg-emerald-600">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Paid
        </Badge>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => run("paid", false)}>
          <RotateCcw className="mr-1 h-3 w-3" />
          Reopen
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end gap-4">
      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <Checkbox
          checked={booking.contacted}
          disabled={pending}
          onCheckedChange={(v) => run("contacted", Boolean(v))}
        />
        Contacted
      </label>
      <Button size="sm" disabled={pending} onClick={() => run("paid", true)}>
        Mark paid
      </Button>
    </div>
  )
}
