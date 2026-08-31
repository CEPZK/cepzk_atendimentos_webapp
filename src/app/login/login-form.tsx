"use client";

import { useActionState } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/auth/state";
import { signInWithMagicLink } from "@/lib/auth/actions";

type Props = { defaultNext: string; banner?: string };

/**
 * Progressive enhancement on purpose: the form posts to a server action, so it
 * works while React hydrates and the disabled/pending state is only a nicety.
 */
export function LoginForm({ defaultNext, banner }: Props) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    signInWithMagicLink,
    IDLE_STATE,
  );

  const tone =
    state.status === "error"
      ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={defaultNext} />

      <div>
        <label htmlFor="email" className="block text-xs font-medium">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username email"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder="you@cepzk.com"
          className="border-input placeholder:text-muted-foreground/70 focus-visible:border-brand focus-visible:ring-brand/25 mt-1.5 w-full rounded-lg border bg-transparent px-3 py-2 text-sm transition-[color,box-shadow] outline-none focus-visible:ring-2 disabled:opacity-60"
        />
      </div>

      {(state.message || banner) && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
            state.message
              ? tone
              : "border-input bg-muted/40 text-muted-foreground"
          }`}
        >
          {state.message ?? banner}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="bg-brand focus-visible:outline-brand w-full rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Sending link…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
