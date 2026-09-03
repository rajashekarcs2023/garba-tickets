"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { LogOut, Trophy } from "lucide-react"

import { logout } from "@/app/actions"
import type { Booking } from "@/lib/notion"
import { computePocStats, computeTotals, rankPocStats } from "@/lib/metrics"
import type { Settings } from "@/lib/settings"
import { BookingsView } from "@/components/bookings-board"
import { SettingsPanel } from "@/components/admin-settings"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const ALL = "__all__"

export function AdminHome({
  admin,
  event,
  bookings,
  roster,
  settings,
  configReady,
  notionReady,
}: {
  admin: string
  event: string
  bookings: Booking[]
  roster: string[]
  settings: Settings | null
  configReady: boolean
  notionReady: boolean
}) {
  const symbol = settings?.currency_symbol || "$"

  // Union of roster names and any POC seen in bookings (case-insensitive).
  const pocNames = useMemo(() => {
    const seen = new Map<string, string>()
    for (const n of roster) if (n?.trim()) seen.set(n.trim().toLowerCase(), n.trim())
    for (const b of bookings) {
      const n = (b.poc || "").trim()
      if (n && !seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n)
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b))
  }, [roster, bookings])

  const [pocFilter, setPocFilter] = useState<string>(ALL)
  const filtered = useMemo(
    () =>
      pocFilter === ALL
        ? bookings
        : bookings.filter((b) => (b.poc || "").trim().toLowerCase() === pocFilter.toLowerCase()),
    [bookings, pocFilter],
  )

  const stats = useMemo(() => rankPocStats(computePocStats(bookings, roster)), [bookings, roster])
  const totals = useMemo(() => computeTotals(bookings, roster), [bookings, roster])
  const money = (n: number) => `${symbol}${n.toFixed(2)}`

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-rose-700">{event} — Admin</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{admin}</span>
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

        <Tabs defaultValue="requests">
          <TabsList>
            <TabsTrigger value="requests">All requests</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-4">
            {!notionReady ? (
              <Card>
                <CardHeader>
                  <CardTitle>Notion isn&apos;t configured</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Set <code>NOTION_TOKEN</code> and <code>NOTION_DATABASE_ID</code> to load requests.
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Viewing</span>
                  <Select value={pocFilter} onValueChange={setPocFilter}>
                    <SelectTrigger className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All POCs</SelectItem>
                      {pocNames.map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">{filtered.length} request(s)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {pocFilter === ALL
                    ? "Read-only overview. Select a specific POC above to tick Contacted / Paid on their behalf."
                    : `Editing as ${pocFilter} — you can tick Contacted / Paid for their requests.`}
                </p>
                <BookingsView bookings={filtered} readOnly={pocFilter === ALL} showPoc={pocFilter === ALL} />
              </>
            )}
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Requests" value={String(totals.requests)} />
              <StatCard label="Completed (paid)" value={`${totals.paid} / ${totals.requests}`} />
              <StatCard label="Tickets sold" value={String(totals.ticketsSold)} />
              <StatCard label="Revenue collected" value={money(totals.revenue)} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Per-POC performance</CardTitle>
                <CardDescription>
                  Ranked by tickets sold (paid requests). &quot;Working&quot; = contacted but not yet paid.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>POC</TableHead>
                        <TableHead className="text-center">Requests</TableHead>
                        <TableHead className="text-center">Contacted</TableHead>
                        <TableHead className="text-center">Working</TableHead>
                        <TableHead className="text-center">Completed</TableHead>
                        <TableHead className="text-center">Tickets sold</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Completion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                            No data yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        stats.map((s, i) => (
                          <TableRow key={s.poc}>
                            <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="font-medium">{s.poc}</TableCell>
                            <TableCell className="text-center">{s.requests}</TableCell>
                            <TableCell className="text-center">{s.contacted}</TableCell>
                            <TableCell className="text-center">{s.activeWorking}</TableCell>
                            <TableCell className="text-center font-medium">{s.paid}</TableCell>
                            <TableCell className="text-center font-semibold">{s.ticketsSold}</TableCell>
                            <TableCell className="text-right">{money(s.revenue)}</TableCell>
                            <TableCell className="text-right">{Math.round(s.completionRate * 100)}%</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <SettingsPanel settings={settings} configReady={configReady} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold text-rose-700">{value}</p>
      </CardContent>
    </Card>
  )
}
