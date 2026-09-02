import Link from "next/link"
import { ArrowLeft, Medal, Trophy } from "lucide-react"

import type { PocStats } from "@/lib/metrics"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const MEDAL = ["text-amber-500", "text-slate-400", "text-orange-600"]

export function Leaderboard({
  event,
  stats,
  symbol,
  backHref,
}: {
  event: string
  stats: PocStats[]
  symbol: string
  backHref: string
}) {
  const money = (n: number) => `${symbol}${n.toFixed(2)}`
  const ranked = stats.filter((s) => s.poc.toLowerCase() !== "unassigned")
  const top = ranked.slice(0, 3)

  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 via-amber-50 to-orange-100">
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-rose-700">
              <Trophy className="h-6 w-6 text-amber-500" />
              POC Leaderboard
            </h1>
            <p className="text-sm text-amber-800/80">{event} · ranked by tickets sold</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </header>

        {top.length > 0 ? (
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {top.map((s, i) => (
              <Card key={s.poc} className={i === 0 ? "border-amber-300 shadow-md" : ""}>
                <CardContent className="p-4 text-center">
                  <Medal className={`mx-auto h-7 w-7 ${MEDAL[i]}`} />
                  <p className="mt-2 truncate text-lg font-semibold">{s.poc}</p>
                  <p className="text-3xl font-bold text-rose-700">{s.ticketsSold}</p>
                  <p className="text-xs text-muted-foreground">
                    tickets · {s.paid} completed · {money(s.revenue)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Standings</CardTitle>
            <CardDescription>Completed = Paid ticked. Tickets sold counts quantity on paid requests.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>POC</TableHead>
                    <TableHead className="text-center">Tickets sold</TableHead>
                    <TableHead className="text-center">Completed</TableHead>
                    <TableHead className="text-center">Working</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        No sales yet — be the first on the board!
                      </TableCell>
                    </TableRow>
                  ) : (
                    ranked.map((s, i) => (
                      <TableRow key={s.poc}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{s.poc}</TableCell>
                        <TableCell className="text-center font-semibold">{s.ticketsSold}</TableCell>
                        <TableCell className="text-center">{s.paid}</TableCell>
                        <TableCell className="text-center">{s.activeWorking}</TableCell>
                        <TableCell className="text-right">{money(s.revenue)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
