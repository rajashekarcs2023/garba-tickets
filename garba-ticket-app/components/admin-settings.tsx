"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"

import { saveSettingsAction } from "@/app/actions"
import { DEFAULT_SETTINGS, type PocEntry, type PriceTier, type Settings } from "@/lib/settings"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/** Settings form body — embedded inside the admin tabs (no page chrome). */
export function SettingsPanel({
  settings,
  configReady,
}: {
  settings: Settings | null
  configReady: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState<Settings>(settings ?? DEFAULT_SETTINGS)

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function addTier() {
    set("price_tiers", [...form.price_tiers, { min_quantity: 2, price_per_ticket: form.ticket_price_usd }])
  }
  function updateTier(i: number, patch: Partial<PriceTier>) {
    set(
      "price_tiers",
      form.price_tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)),
    )
  }
  function removeTier(i: number) {
    set("price_tiers", form.price_tiers.filter((_, idx) => idx !== i))
  }

  function addPoc() {
    set("points_of_contact", [...form.points_of_contact, { name: "", phone: "", email: "", password: "" }])
  }
  function updatePoc(i: number, patch: Partial<PocEntry>) {
    set(
      "points_of_contact",
      form.points_of_contact.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    )
  }
  function removePoc(i: number) {
    set("points_of_contact", form.points_of_contact.filter((_, idx) => idx !== i))
  }

  function save() {
    startTransition(async () => {
      const res = await saveSettingsAction(form)
      if (res.success) {
        toast.success(res.message)
        router.refresh()
      } else {
        toast.error(res.message)
      }
    })
  }

  if (!configReady) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Config store isn&apos;t set up</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Create an empty Notion database, share it with the integration, and set{" "}
          <code>NOTION_CONFIG_DATABASE_ID</code> (and <code>NOTION_TOKEN</code>). This same id goes on the agent so it
          reads your changes live.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>Base ticket price and per-request cap. Cash and online cost the same.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="price">Ticket price</Label>
            <Input
              id="price"
              type="number"
              min={0}
              step="0.5"
              value={form.ticket_price_usd}
              onChange={(e) => set("ticket_price_usd", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="symbol">Currency symbol</Label>
            <Input id="symbol" value={form.currency_symbol} onChange={(e) => set("currency_symbol", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max">Max per request</Label>
            <Input
              id="max"
              type="number"
              min={1}
              step="1"
              value={form.max_tickets_per_request}
              onChange={(e) => set("max_tickets_per_request", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-account">Max per account (lifetime)</Label>
            <Input
              id="max-account"
              type="number"
              min={0}
              step="1"
              value={form.max_tickets_per_account}
              onChange={(e) => set("max_tickets_per_account", Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Total tickets one account can ever request across all their chats. <strong>0 = unlimited.</strong>
            </p>
          </div>
          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="online-url">Online payment link</Label>
            <Input
              id="online-url"
              type="url"
              inputMode="url"
              placeholder="https://square.link/u/…"
              value={form.online_payment_url}
              onChange={(e) => set("online_payment_url", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Shown to buyers who choose &quot;Pay online&quot;. Leave blank to hide the link. Applies live — no
              redeploy.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulk discounts</CardTitle>
          <CardDescription>
            Per-ticket price at a quantity threshold, e.g. 5+ tickets = $15 each. The highest matching tier wins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.price_tiers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tiers — every ticket is {form.currency_symbol}
              {form.ticket_price_usd}.
            </p>
          ) : (
            form.price_tiers.map((tier, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Min quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    className="w-32"
                    value={tier.min_quantity}
                    onChange={(e) => updateTier(i, { min_quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price / ticket</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    className="w-32"
                    value={tier.price_per_ticket}
                    onChange={(e) => updateTier(i, { price_per_ticket: Number(e.target.value) })}
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeTier(i)} aria-label="Remove tier">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
          <Button variant="outline" size="sm" onClick={addTier}>
            <Plus className="mr-2 h-4 w-4" />
            Add tier
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Points of contact</CardTitle>
          <CardDescription>
            These appear in the agent&apos;s request form dropdown and are used for auto-assign. Set a{" "}
            <strong>login password</strong> to give a POC dashboard access (username = their name); leave it blank for a
            contact-only POC. Changes apply live — no redeploy. Existing POCs from your env are shown here until you
            first <strong>Save</strong>, after which this list becomes the source of truth (edit or remove any of them).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.points_of_contact.length === 0 ? (
            <p className="text-sm text-muted-foreground">No POCs yet — the agent will fall back to its env default.</p>
          ) : (
            form.points_of_contact.map((poc, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    className="w-44"
                    value={poc.name}
                    onChange={(e) => updatePoc(i, { name: e.target.value })}
                    placeholder="Zoha Dhanani"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    className="w-40"
                    value={poc.phone}
                    onChange={(e) => updatePoc(i, { phone: e.target.value })}
                    placeholder="408-555-0101"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input
                    className="w-52"
                    value={poc.email}
                    onChange={(e) => updatePoc(i, { email: e.target.value })}
                    placeholder="zoha@iso.org"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Login password</Label>
                  <Input
                    className="w-40"
                    value={poc.password ?? ""}
                    onChange={(e) => updatePoc(i, { password: e.target.value })}
                    placeholder="blank = no login"
                    autoComplete="off"
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={() => removePoc(i)} aria-label="Remove POC">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
          <Button variant="outline" size="sm" onClick={addPoc}>
            <Plus className="mr-2 h-4 w-4" />
            Add point of contact
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  )
}
