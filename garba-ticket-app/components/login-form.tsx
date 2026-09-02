"use client"

import { useActionState } from "react"

import { login, type LoginState } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const INITIAL: LoginState = {}

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, formAction, pending] = useActionState(login, INITIAL)

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use the POC username and password shared by the ISO team.</CardDescription>
      </CardHeader>
      <CardContent>
        {!configured ? (
          <p className="text-sm text-destructive">
            No accounts are configured yet. An admin can add POC logins on the admin settings page, or set{" "}
            <code>POC_USERS</code>/<code>ADMIN_USERS</code> in the environment.
          </p>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" autoComplete="username" required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
