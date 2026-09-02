# Garba POC Dashboard

A tiny Next.js dashboard for **SJSU ISO Garba** points of contact (POCs). Each POC
signs in and sees **only the ticket requests assigned to them**, and can tick two
things off: **Contacted** and **Paid**. Marking a request **Paid** moves it into a
**Completed** tab.

Notion is the **master copy** — the same database the `garba-sjsu-agent` writes to.
For POCs this app:

- **reads** only rows where `Assigned ISO POC` equals the signed-in POC, and
- **writes** only the `Contacted` / `Paid` checkboxes (nothing else).

It never creates rows, so a POC can't fabricate a request — requests exist only
when a student books through ASI:One. Writes are authorized server-side (the row
must belong to the signed-in POC), and the Notion token never reaches the browser.

## Admin (role: admin)

Admins sign in with an `ADMIN_USERS` account and land on **`/admin`**, where they
can edit **live settings** that the agent reads without a redeploy:

- **Ticket price**, currency, and per-request cap
- **Bulk discount tiers** — per-ticket price at a quantity threshold (e.g. 5+ = $15)
- **Points of contact** — the roster shown in the agent's request-form dropdown and
  used for auto-assign (name + phone + email)

These are stored as a JSON blob in a **second** Notion database (the "config store");
the agent points at the same `NOTION_CONFIG_DATABASE_ID` and refreshes every ~60s
(falling back to its env defaults if the store is empty/unreachable). Admins can't
see POC ticket lists; POCs can't see the admin page. Dashboard **logins** stay in
`POC_USERS` / `ADMIN_USERS` env for now (adding a POC to the roster does not create
their login).

## How it fits together

```
student -> ASI:One (garba-sjsu-agent) -> Notion row (Assigned ISO POC = <name>)
                                             |
POC signs in here -> sees only their rows -> ticks Contacted / Paid
                                             |
                                          Paid = true  -> Completed tab
```

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in NOTION_TOKEN, NOTION_DATABASE_ID, POC_USERS, AUTH_SECRET
pnpm dev
```

Environment:

| Var | Purpose |
|-----|---------|
| `NOTION_TOKEN` | Notion internal integration token (share both DBs with it) |
| `NOTION_DATABASE_ID` | The requests database the agent writes to |
| `NOTION_CONFIG_DATABASE_ID` | The settings store (2nd DB); same id on the agent |
| `POC_USERS` | `Name:password` pairs; `Name` must match the agent's `Assigned ISO POC` value |
| `ADMIN_USERS` | `Name:password` pairs for admins (settings access) |
| `AUTH_SECRET` | Long random string used to sign the session cookie |
| `EVENT_NAME` | Optional header label |

## Deploy (Vercel)

Push this folder to a repo and import it in Vercel. Set the env vars above in the
Vercel project settings. Use a strong `AUTH_SECRET` and give each POC their own
`POC_USERS` entry.

## Security notes

- Session is an httpOnly, signed cookie (12h TTL); the browser only ever holds the
  POC name, never the Notion token.
- The only mutations are `Contacted` / `Paid` toggles, each re-checked server-side
  against the row's assigned POC before writing.
