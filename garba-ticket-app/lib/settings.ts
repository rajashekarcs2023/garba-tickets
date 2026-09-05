/**
 * Server-only client for the shared "config" store — the same Notion single-row
 * database the garba-sjsu-agent reads live. Admin edits here (prices, bulk tiers,
 * POC roster) and the agent picks them up within ~60s, no redeploy.
 *
 * The settings are stored as a JSON blob in one rich_text column ("Config") on a
 * single row. We self-provision the column and the row, so setup is just: create
 * an empty Notion database, share it with the integration, paste its id.
 *
 * Never import from a client component (uses NOTION_TOKEN).
 */

const NOTION_VERSION = "2022-06-28"
const NOTION_API = "https://api.notion.com"
const CONFIG_COLUMN = process.env.NOTION_PROP_CONFIG || "Config"
const ROW_TITLE = "garba-config"

export interface PriceTier {
  min_quantity: number
  price_per_ticket: number
}

export interface PocEntry {
  name: string
  phone: string
  email: string
  /** Optional dashboard login password. Blank = contact-only POC (no login). */
  password?: string
}

export interface Settings {
  ticket_price_usd: number
  currency_symbol: string
  max_tickets_per_request: number
  /** Lifetime cap on total tickets one account (agent address) can ever request. 0 = unlimited. */
  max_tickets_per_account: number
  /** Hosted payment link shown to buyers who choose "Pay online". Blank = no link. */
  online_payment_url: string
  price_tiers: PriceTier[]
  points_of_contact: PocEntry[]
}

export const DEFAULT_SETTINGS: Settings = {
  ticket_price_usd: 18,
  currency_symbol: "$",
  max_tickets_per_request: 5,
  max_tickets_per_account: 0,
  online_payment_url: "",
  price_tiers: [],
  points_of_contact: [],
}

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
  return normalizeId((process.env.NOTION_CONFIG_DATABASE_ID || "").trim())
}

export function configConfigured(): boolean {
  return Boolean(token() && databaseId())
}

async function notionFetch(path: string, init: RequestInit): Promise<any> {
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
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Notion ${init.method} ${path} -> ${res.status}: ${detail}`)
  }
  return res.json()
}

function coerce(raw: any): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS }
  if (raw && typeof raw === "object") {
    if (typeof raw.ticket_price_usd === "number" && raw.ticket_price_usd >= 0) s.ticket_price_usd = raw.ticket_price_usd
    if (typeof raw.currency_symbol === "string" && raw.currency_symbol.trim()) s.currency_symbol = raw.currency_symbol.trim()
    if (typeof raw.max_tickets_per_request === "number" && raw.max_tickets_per_request >= 1) {
      s.max_tickets_per_request = Math.floor(raw.max_tickets_per_request)
    }
    // 0 is valid here (unlimited), so accept any non-negative integer.
    if (typeof raw.max_tickets_per_account === "number" && raw.max_tickets_per_account >= 0) {
      s.max_tickets_per_account = Math.floor(raw.max_tickets_per_account)
    }
    if (typeof raw.online_payment_url === "string") s.online_payment_url = raw.online_payment_url.trim()
    if (Array.isArray(raw.price_tiers)) {
      s.price_tiers = raw.price_tiers
        .map((t: any) => ({ min_quantity: Number(t?.min_quantity), price_per_ticket: Number(t?.price_per_ticket) }))
        .filter((t: PriceTier) => Number.isFinite(t.min_quantity) && t.min_quantity >= 1 && Number.isFinite(t.price_per_ticket) && t.price_per_ticket >= 0)
        .sort((a: PriceTier, b: PriceTier) => a.min_quantity - b.min_quantity)
    }
    if (Array.isArray(raw.points_of_contact)) {
      s.points_of_contact = raw.points_of_contact
        .map((p: any) =>
          typeof p === "string"
            ? { name: p.trim(), phone: "", email: "", password: "" }
            : {
                name: String(p?.name || "").trim(),
                phone: String(p?.phone || "").trim(),
                email: String(p?.email || "").trim(),
                password: String(p?.password || "").trim(),
              },
        )
        .filter((p: PocEntry) => p.name)
    }
  }
  return s
}

/** Parse "Name:password, Name2:password2" (mirrors auth.ts POC_USERS). */
function parseUserPairs(raw: string | undefined): { name: string; password: string }[] {
  const out: { name: string; password: string }[] = []
  for (const entry of (raw || "").split(",")) {
    const t = entry.trim()
    if (!t) continue
    const i = t.indexOf(":")
    if (i <= 0) continue
    const name = t.slice(0, i).trim()
    const password = t.slice(i + 1).trim()
    if (name) out.push({ name, password })
  }
  return out
}

/** Parse "Name|phone|email, ..." (mirrors the agent's GARBA_POC_CONTACTS). */
function parseContacts(raw: string | undefined): Record<string, { phone: string; email: string }> {
  const map: Record<string, { phone: string; email: string }> = {}
  for (const entry of (raw || "").split(",")) {
    const t = entry.trim()
    if (!t) continue
    const [name, phone = "", email = ""] = t.split("|").map((x) => x.trim())
    if (name) map[name.toLowerCase()] = { phone, email }
  }
  return map
}

/**
 * POC roster derived from env, used ONLY to seed the admin form before anything
 * is saved to the config store — so existing POCs are visible/editable instead of
 * a blank list. Once the admin saves, the Notion config becomes authoritative.
 * Sources mirror the agent + auth: POC_USERS (name + login password),
 * GARBA_POINTS_OF_CONTACT (extra names), GARBA_POC_CONTACTS (phone/email).
 */
export function envPointsOfContact(): PocEntry[] {
  const contacts = parseContacts(process.env.GARBA_POC_CONTACTS)
  const byName = new Map<string, PocEntry>()
  const add = (rawName: string, password = "") => {
    const name = rawName.trim()
    const key = name.toLowerCase()
    if (!key) return
    const existing = byName.get(key)
    if (existing) {
      if (password && !existing.password) existing.password = password
      return
    }
    const c = contacts[key] || { phone: "", email: "" }
    byName.set(key, { name, phone: c.phone, email: c.email, password })
  }
  for (const u of parseUserPairs(process.env.POC_USERS)) add(u.name, u.password)
  for (const n of (process.env.GARBA_POINTS_OF_CONTACT || "").split(",")) add(n)
  return [...byName.values()]
}

function readConfigText(props: Record<string, any>): string {
  const byLower: Record<string, any> = {}
  for (const [name, prop] of Object.entries(props)) byLower[name.toLowerCase()] = prop
  const prop = byLower[CONFIG_COLUMN.toLowerCase()]
  if (!prop) return ""
  const parts = prop.type === "title" ? prop.title : prop.rich_text
  return (parts || []).map((p: any) => p.plain_text || "").join("")
}

async function firstRow(): Promise<{ id: string; props: Record<string, any> } | null> {
  const data = await notionFetch(`/v1/databases/${databaseId()}/query`, {
    method: "POST",
    body: JSON.stringify({ page_size: 1 }),
  })
  const page = (data.results || [])[0]
  return page ? { id: page.id, props: page.properties || {} } : null
}

/**
 * Read current settings (merged with defaults). Falls back to defaults on any
 * issue. When no POCs have been saved to the config store yet, the roster is
 * seeded from env (POC_USERS / GARBA_* ) so the admin can see and edit the
 * existing POCs instead of a blank list; saving makes the config authoritative.
 */
export async function getSettings(): Promise<Settings> {
  const seed = (s: Settings): Settings => {
    if (s.points_of_contact.length > 0) return s
    const envPocs = envPointsOfContact()
    return envPocs.length > 0 ? { ...s, points_of_contact: envPocs } : s
  }
  if (!configConfigured()) return seed({ ...DEFAULT_SETTINGS })
  try {
    const row = await firstRow()
    if (!row) return seed({ ...DEFAULT_SETTINGS })
    const text = readConfigText(row.props).trim()
    if (!text) return seed({ ...DEFAULT_SETTINGS })
    return seed(coerce(JSON.parse(text)))
  } catch {
    return seed({ ...DEFAULT_SETTINGS })
  }
}

/** Ensure the JSON column + title column exist (idempotent). */
async function ensureColumn(): Promise<{ titleName: string }> {
  const db = await notionFetch(`/v1/databases/${databaseId()}`, { method: "GET" })
  const props = db.properties || {}
  const titleName = Object.keys(props).find((n) => props[n]?.type === "title") || "Name"
  const hasConfig = Object.keys(props).some((n) => n.toLowerCase() === CONFIG_COLUMN.toLowerCase())
  if (!hasConfig) {
    await notionFetch(`/v1/databases/${databaseId()}`, {
      method: "PATCH",
      body: JSON.stringify({ properties: { [CONFIG_COLUMN]: { rich_text: {} } } }),
    })
  }
  return { titleName }
}

function chunkedRichText(text: string): { text: { content: string } }[] {
  const chunks: { text: { content: string } }[] = []
  for (let i = 0; i < text.length; i += 1900) {
    chunks.push({ text: { content: text.slice(i, i + 1900) } })
  }
  return chunks.length ? chunks : [{ text: { content: "" } }]
}

/** Persist settings back to the single config row (creating it if needed). */
export async function saveSettings(settings: Settings): Promise<void> {
  if (!configConfigured()) throw new Error("Config store not configured (NOTION_CONFIG_DATABASE_ID).")
  const clean = coerce(settings)
  const json = JSON.stringify(clean)
  const { titleName } = await ensureColumn()
  const configProp = { [CONFIG_COLUMN]: { rich_text: chunkedRichText(json) } }

  const row = await firstRow()
  if (row) {
    await notionFetch(`/v1/pages/${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({ properties: configProp }),
    })
  } else {
    await notionFetch(`/v1/pages`, {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: databaseId() },
        properties: {
          [titleName]: { title: [{ text: { content: ROW_TITLE } }] },
          ...configProp,
        },
      }),
    })
  }
}
