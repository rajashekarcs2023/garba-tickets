/**
 * Server-only Notion client for the Garba ISO point-of-contact dashboard.
 *
 * Notion is the master copy shared with the ASI:One agent: the agent writes one
 * row per ticket request (with an "Assigned ISO POC" title). This dashboard reads
 * only the rows for the signed-in POC and can flip exactly two checkboxes back —
 * "Contacted" and "Paid" — nothing else. It never creates rows, so a POC cannot
 * fabricate a request; requests only exist when a student books via ASI:One.
 *
 * Never import this from a client component (it uses NOTION_TOKEN).
 */

const NOTION_VERSION = "2022-06-28"
const NOTION_API = "https://api.notion.com"

function token(): string {
  return (process.env.NOTION_TOKEN || "").trim()
}

function normalizeId(raw: string): string {
  const hex = raw.replace(/-/g, "")
  if (hex.length === 32 && /^[0-9a-fA-F]+$/.test(hex)) {
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  return raw
}

function databaseId(): string {
  return normalizeId((process.env.NOTION_DATABASE_ID || "").trim())
}

export function notionConfigured(): boolean {
  return Boolean(token() && databaseId())
}

/** Logical field -> Notion column name (override via NOTION_PROP_<FIELD>). */
const COLUMNS = {
  poc: process.env.NOTION_PROP_POC || "Assigned ISO POC",
  name: process.env.NOTION_PROP_NAME || "Requested By",
  email: process.env.NOTION_PROP_EMAIL || "Email",
  phone: process.env.NOTION_PROP_PHONE || "Phone",
  quantity: process.env.NOTION_PROP_TICKETS || "Tickets",
  paymentMethod: process.env.NOTION_PROP_PAYMENT_METHOD || "Payment Method",
  reference: process.env.NOTION_PROP_REFERENCE || "Payment Reference",
  amount: process.env.NOTION_PROP_AMOUNT || "Amount (USD)",
  code: process.env.NOTION_PROP_CODE || "Code",
  status: process.env.NOTION_PROP_STATUS || "Status",
  submitted: process.env.NOTION_PROP_SUBMITTED || "Submitted",
  event: process.env.NOTION_PROP_EVENT || "Event",
  contacted: process.env.NOTION_PROP_CONTACTED || "Contacted",
  paid: process.env.NOTION_PROP_PAID || "Paid",
} as const

export type FlagField = "contacted" | "paid"

export interface Booking {
  pageId: string
  code: string
  name: string
  email: string
  phone: string
  quantity: number
  paymentMethod: string
  reference: string
  amount: number | null
  status: string
  submitted: string | null
  poc: string
  contacted: boolean
  paid: boolean
}

const MAX_ATTEMPTS = 3

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Notion API call with small retry/backoff on transient failures (429 + 5xx +
 * network errors), so a brief Notion hiccup doesn't turn into a 500 for a POC.
 * 4xx (other than 429) fail fast — they won't succeed on retry.
 */
async function notionFetch(path: string, init: RequestInit): Promise<any> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${NOTION_API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token()}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
          ...(init.headers || {}),
        },
        cache: "no-store",
      })
      if (res.ok) return res.json()

      const detail = await res.text().catch(() => "")
      const transient = res.status === 429 || res.status >= 500
      if (transient && attempt < MAX_ATTEMPTS) {
        const retryAfter = Number(res.headers.get("retry-after")) || 0
        await sleep(retryAfter > 0 ? Math.min(retryAfter * 1000, 5000) : attempt * 500)
        continue
      }
      throw new Error(`Notion ${init.method} ${path} -> ${res.status}: ${detail}`)
    } catch (err) {
      lastErr = err
      // Network/DNS error (not an HTTP response) — retry a couple of times.
      if (err instanceof TypeError && attempt < MAX_ATTEMPTS) {
        await sleep(attempt * 500)
        continue
      }
      throw err
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Notion request failed")
}

function readProp(prop: any): any {
  if (!prop || typeof prop !== "object") return null
  switch (prop.type) {
    case "title":
    case "rich_text":
      return (prop[prop.type] || []).map((p: any) => p.plain_text || "").join("").trim()
    case "number":
      return prop.number
    case "checkbox":
      return Boolean(prop.checkbox)
    case "select":
      return prop.select?.name ?? ""
    case "multi_select":
      return (prop.multi_select || []).map((o: any) => o.name).filter(Boolean)
    case "email":
      return prop.email ?? ""
    case "phone_number":
      return prop.phone_number ?? ""
    case "date":
      return prop.date?.start ?? null
    default:
      return null
  }
}

function toBooking(pageId: string, props: Record<string, any>): Booking {
  const byLower: Record<string, any> = {}
  for (const [name, prop] of Object.entries(props)) byLower[name.toLowerCase()] = prop
  const get = (field: keyof typeof COLUMNS) => readProp(byLower[COLUMNS[field].toLowerCase()])
  const amountRaw = get("amount")
  return {
    pageId,
    code: String(get("code") ?? "").trim(),
    name: String(get("name") ?? "").trim(),
    email: String(get("email") ?? "").trim(),
    phone: String(get("phone") ?? "").trim(),
    quantity: Math.max(0, Math.floor(Number(get("quantity") ?? 0) || 0)),
    paymentMethod: String(get("paymentMethod") ?? "").trim(),
    reference: String(get("reference") ?? "").trim(),
    amount: typeof amountRaw === "number" ? amountRaw : null,
    status: String(get("status") ?? "").trim(),
    submitted: (get("submitted") as string | null) ?? null,
    poc: String(get("poc") ?? "").trim(),
    contacted: Boolean(get("contacted")),
    paid: Boolean(get("paid")),
  }
}

/** Query bookings with an optional Notion filter, newest first (paginated). */
async function queryBookings(filter?: any): Promise<Booking[]> {
  if (!notionConfigured()) return []
  const bookings: Booking[] = []
  let cursor: string | undefined
  for (let i = 0; i < 40; i++) {
    const body: any = {
      page_size: 100,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    }
    if (filter) body.filter = filter
    if (cursor) body.start_cursor = cursor
    const data = await notionFetch(`/v1/databases/${databaseId()}/query`, {
      method: "POST",
      body: JSON.stringify(body),
    })
    for (const page of data.results || []) {
      bookings.push(toBooking(page.id, page.properties || {}))
    }
    if (!data.has_more) break
    cursor = data.next_cursor
    if (!cursor) break
  }
  return bookings
}

/**
 * All requests assigned to a given POC, newest first. Matched case/whitespace-
 * insensitively (Notion's title `equals` is exact/case-sensitive), so a small
 * naming slip between the agent, roster, and login can't hide a POC's tickets.
 */
export async function getBookingsForPoc(poc: string): Promise<Booking[]> {
  const key = (poc || "").trim().toLowerCase()
  if (!key) return []
  const all = await getAllBookings()
  return all.filter((b) => (b.poc || "").trim().toLowerCase() === key)
}

/** Every request in the DB, newest first. Admin/leaderboard use only. */
export async function getAllBookings(): Promise<Booking[]> {
  return queryBookings()
}

/** Read just the assigned POC for a page — used to authorize writes. */
export async function getPagePoc(pageId: string): Promise<string | null> {
  if (!pageId || !notionConfigured()) return null
  const page = await notionFetch(`/v1/pages/${pageId}`, { method: "GET" })
  const props = page.properties || {}
  const byLower: Record<string, any> = {}
  for (const [name, prop] of Object.entries(props)) byLower[name.toLowerCase()] = prop
  const val = readProp(byLower[COLUMNS.poc.toLowerCase()])
  return val ? String(val).trim() : null
}

/** Flip one of the two allowed checkboxes on a request row. */
export async function setFlag(pageId: string, field: FlagField, value: boolean): Promise<void> {
  const column = field === "paid" ? COLUMNS.paid : COLUMNS.contacted
  await notionFetch(`/v1/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: { [column]: { checkbox: value } } }),
  })
}
