"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import {
  SupabaseNotConfiguredError,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

interface LoginFormProps {
  /** Where to go after signing in. */
  nextPath: string;
  /** Optional message shown at the top of the form. */
  errorMessage?: string | null;
  /** `false` when the Supabase credentials are missing on the server. */
  isConfigured?: boolean;
}

export function LoginForm({
  nextPath,
  errorMessage = null,
  isConfigured = true,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // `isConfigured` only reflects the server; the bundle running in the
  // browser may itself have been built without the credentials.
  const isConfiguredInBrowser = useSyncExternalStore(
    () => () => {},
    () => isSupabaseConfigured(),
    () => true,
  );
  const canSignIn = isConfigured && isConfiguredInBrowser;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Informe seu e-mail.");
      return;
    }

    setIsSending(true);

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          // Invite-only platform: never create a user without an invite.
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });

      if (signInError) {
        // Usually: the e-mail was never invited to the platform.
        setError(
          "Não foi possível enviar o link. Verifique se o e-mail está correto e se você foi convidado para a plataforma.",
        );
        setIsSending(false);
        return;
      }
    } catch (cause) {
      console.error("[cepzk] Sign-in request failed", cause);
      setError(
        cause instanceof SupabaseNotConfiguredError
          ? "A plataforma não está configurada corretamente (credenciais do Supabase ausentes nesta versão do site). Avise um administrador."
          : "Serviço temporariamente indisponível. Tente novamente em alguns instantes.",
      );
      setIsSending(false);
      return;
    }

    setIsSending(false);
    setIsSent(true);
  }

  if (isSent) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-50">
          <svg
            className="h-6 w-6 text-sky-700"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
            />
          </svg>
        </div>
        <h1 className="mt-4 text-center text-2xl font-semibold tracking-tight text-slate-900">
          Verifique seu e-mail
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
          Enviamos um link de acesso para{" "}
          <span className="font-medium text-slate-900">{email.trim()}</span>.
          Clique no link para entrar na plataforma.
        </p>
        <button
          type="button"
          onClick={() => setIsSent(false)}
          className="mt-6 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2"
        >
          Reenviar link
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-center gap-3">
        <Image
          src="/icons/cepzk-round-logo.png"
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 shrink-0"
          priority
        />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Entrar
          </h1>
          <p className="text-sm text-slate-500">CEPZK · Atendimentos</p>
        </div>
      </div>

      <p className="mt-6 text-sm leading-relaxed text-slate-600">
        Informe seu e-mail e enviaremos um link de acesso para entrar na
        plataforma.
      </p>

      {errorMessage && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            E-mail
          </label>
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@exemplo.com"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30"
          />
        </div>

        <button
          type="submit"
          disabled={isSending || !canSignIn}
          className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSending ? "Enviando..." : "Enviar link de acesso"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        O acesso é restrito a voluntários convidados da casa.
      </p>
    </div>
  );
}
