"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/server/actions/auth";
import { Card } from "@/components/ui/card";

export default function ProLoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );

  return (
    <main className="surface-pro bg-bg text-ink min-h-dvh flex items-center justify-center px-6">
      <Card className="w-full max-w-sm flex flex-col gap-4 p-6">
        <h1 className="font-display text-4xl text-center">רנצ&apos;ו Pro</h1>
        <form action={action} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 font-medium">
            אימייל
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              dir="ltr"
              className="min-h-(--tap-min) rounded-(--radius-control) border border-border bg-bg px-4 text-base text-ink text-left"
            />
          </label>
          <label className="flex flex-col gap-1.5 font-medium">
            סיסמה
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              dir="ltr"
              className="min-h-(--tap-min) rounded-(--radius-control) border border-border bg-bg px-4 text-base text-ink text-left"
            />
          </label>
          {state.error && (
            <p role="alert" className="text-safety-unsafe text-sm">
              {state.error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="min-h-(--tap-min) rounded-(--radius-control) bg-brand text-on-brand font-medium disabled:opacity-50"
          >
            {pending ? "רגע…" : "כניסה"}
          </button>
        </form>
      </Card>
    </main>
  );
}
