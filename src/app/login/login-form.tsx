"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { requestOtpCode } from "@/lib/otp-request";
import { OtpForm } from "@/app/login/otp-form";

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

    const result = await requestOtpCode(trimmedEmail, nextPath);
    setIsSending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    setIsSent(true);
  }

  if (isSent) {
    return (
      <OtpForm
        email={email.trim()}
        nextPath={nextPath}
        onUseAnotherEmail={() => setIsSent(false)}
      />
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
        Informe seu e-mail e enviaremos um código de acesso para entrar na
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
          {isSending ? "Enviando..." : "Enviar código de acesso"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        O acesso é restrito a voluntários convidados da casa.
      </p>
    </div>
  );
}
