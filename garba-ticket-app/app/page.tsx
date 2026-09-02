import { redirect } from "next/navigation"

import { authConfigured } from "@/lib/auth"
import { currentPoc } from "@/lib/session"
import { LoginForm } from "@/components/login-form"

export const dynamic = "force-dynamic"

export default async function Home() {
  const poc = await currentPoc()
  if (poc) redirect("/dashboard")

  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 via-amber-50 to-orange-100 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-rose-700 text-balance">SJSU ISO Garba</h1>
        <p className="text-base text-amber-700">Point of contact dashboard</p>
      </div>
      <LoginForm configured={authConfigured()} />
      <p className="mt-8 max-w-sm text-center text-xs text-amber-700/80">
        You&apos;ll only see the ticket requests assigned to you. Requests are created by students in ASI:One.
      </p>
    </main>
  )
}
