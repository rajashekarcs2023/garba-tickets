/**
 * Pure aggregation helpers for the admin overview + leaderboard. No I/O — takes
 * the Booking[] from Notion and rolls it up per point-of-contact.
 *
 * "Completed" == the Paid checkbox is ticked (that's what moves a request to the
 * Completed tab). The headline ranking metric is tickets sold on paid requests,
 * since closing one 5-ticket request is a bigger contribution than three 1-ticket
 * ones (and with flat pricing, tickets sold tracks revenue anyway).
 */

import type { Booking } from "./notion"

export interface PocStats {
  poc: string
  requests: number
  contacted: number
  paid: number
  /** Contacted but not yet paid — i.e. actively being worked. */
  activeWorking: number
  /** Sum of ticket quantity on paid requests — the headline "sales" number. */
  ticketsSold: number
  ticketsRequested: number
  /** Sum of amount on paid requests. */
  revenue: number
  /** paid / requests, 0..1. */
  completionRate: number
}

export interface Totals {
  pocs: number
  requests: number
  contacted: number
  paid: number
  ticketsSold: number
  ticketsRequested: number
  revenue: number
}

function keyOf(name: string): string {
  return (name || "").trim().toLowerCase()
}

/**
 * Roll bookings up per POC. `roster` seeds the list so configured POCs with zero
 * activity still appear (ranked last). Grouping is case/whitespace-insensitive so
 * a naming slip between the agent and the roster doesn't split one POC into two.
 */
export function computePocStats(bookings: Booking[], roster: string[] = []): PocStats[] {
  const map = new Map<string, PocStats>()
  const ensure = (displayName: string): PocStats => {
    const k = keyOf(displayName) || "unassigned"
    let s = map.get(k)
    if (!s) {
      s = {
        poc: (displayName || "").trim() || "Unassigned",
        requests: 0,
        contacted: 0,
        paid: 0,
        activeWorking: 0,
        ticketsSold: 0,
        ticketsRequested: 0,
        revenue: 0,
        completionRate: 0,
      }
      map.set(k, s)
    }
    return s
  }

  for (const name of roster) if (name && name.trim()) ensure(name)

  for (const b of bookings) {
    const s = ensure(b.poc || "Unassigned")
    s.requests += 1
    s.ticketsRequested += b.quantity || 0
    if (b.contacted) s.contacted += 1
    if (b.paid) {
      s.paid += 1
      s.ticketsSold += b.quantity || 0
      s.revenue += b.amount || 0
    }
    if (b.contacted && !b.paid) s.activeWorking += 1
  }

  const out: PocStats[] = []
  for (const s of map.values()) {
    s.completionRate = s.requests > 0 ? s.paid / s.requests : 0
    out.push(s)
  }
  return out
}

/** Rank by tickets sold, then completed requests, then revenue, then name. */
export function rankPocStats(stats: PocStats[]): PocStats[] {
  return [...stats].sort(
    (a, b) =>
      b.ticketsSold - a.ticketsSold ||
      b.paid - a.paid ||
      b.revenue - a.revenue ||
      a.poc.localeCompare(b.poc),
  )
}

export function computeTotals(bookings: Booking[], roster: string[] = []): Totals {
  const stats = computePocStats(bookings, roster)
  const t: Totals = {
    pocs: stats.length,
    requests: 0,
    contacted: 0,
    paid: 0,
    ticketsSold: 0,
    ticketsRequested: 0,
    revenue: 0,
  }
  for (const b of bookings) {
    t.requests += 1
    t.ticketsRequested += b.quantity || 0
    if (b.contacted) t.contacted += 1
    if (b.paid) {
      t.paid += 1
      t.ticketsSold += b.quantity || 0
      t.revenue += b.amount || 0
    }
  }
  return t
}
