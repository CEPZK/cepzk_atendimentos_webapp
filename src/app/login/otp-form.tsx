"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import {
  formatCooldown,
  isOtpComplete,
  normalizeOtpCode,
  OTP_LENGTH,
  OTP_MAX_DIGITS,
  OTP_RESEND_COOLDOWN_SECONDS,
} from "@/lib/otp";
import { requestOtpCode } from "@/lib/otp-request";

interface OtpFormProps {
  /** E-mail the code was sent to (already trimmed). */
  email: string;
  /** Where to go after signing in. */
  nextPath: string;
  /** Back to the e-mail form. */
  onUseAnotherEmail: () => void;
}

const subscribe = () => () => {};

/** Whether the page runs as an installed (standalone) PWA. */
function readIsStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

/**
 * Code entry screen: verifies the digits from the e-mail with
 * `verifyOtp`, which — unlike the PKCE magic link — works in any
 * context, including the installed PWA the e-mail link cannot reach.
 */
export function OtpForm({ email, nextPath, onUseAnotherEmail }: OtpFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(OTP_RESEND_COOLDOWN_SECONDS);
  // Guards the auto-submit: `isVerifying` alone lags a render behind.
  const verifyInFlight = useRef(false);
  const isStandalone = useSyncExternalStore(
    subscribe,
    readIsStandalone,
    () => false,
  );

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(
      () => setCooldown((remaining) => remaining - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const verify = useCallback(
    async (rawCode: string) => {
      const token = normalizeOtpCode(rawCode);
      if (!isOtpComplete(token) || verifyInFlight.current) return;
      verifyInFlight.current = true;
      setIsVerifying(true);
      setError(null);
      setNotice(null);

      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();

        const { data, error: verifyError } =
          await supabase.auth.verifyOtp({
            email,
            token,
            type: "email",
          });

        if (verifyError || !data.session) {
          const status = (verifyError as { status?: number } | null)?.status;
          setError(
            status === 429
              ? "Tentativas demais. Aguarde alguns instantes e tente de novo."
              : "Código inválido ou expirado. Confira os dígitos ou solicite um novo código abaixo.",
          );
          return;
        }

        router.replace(nextPath);
        router.refresh();
      } catch (cause) {
        console.error("[cepzk] Code verification failed", cause);
        setError(
          "Serviço temporariamente indisponível. Tente novamente em alguns instantes.",
        );
      } finally {
        verifyInFlight.current = false;
        setIsVerifying(false);
      }
    },
    [email, nextPath, router],
  );

  function handleChange(value: string) {
    const normalized = normalizeOtpCode(value);
    setCode(normalized);
    setError(null);
    setNotice(null);
    // Typed, pasted and autofilled codes all land here: submit as soon
    // as the expected length is reached, no tap needed.
    if (normalized.length === OTP_LENGTH) {
      void verify(normalized);
    }
  }

  async function handleResend() {
    if (isResending || cooldown > 0) return;
    setIsResending(true);
    setError(null);
    setNotice(null);

    const result = await requestOtpCode(email, nextPath);
    setIsResending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setCode("");
    setCooldown(OTP_RESEND_COOLDOWN_SECONDS);
    setNotice("Enviamos um novo código. Use sempre o mais recente.");
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">
        Digite o código
      </h1>
      <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
        Enviamos um código de {OTP_LENGTH} dígitos para{" "}
        <span className="font-medium text-slate-900">{email}</span>.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      {notice && (
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {notice}
        </div>
      )}

      <form
        className="mt-6 space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void verify(code);
        }}
      >
        <div>
          <label
            htmlFor="otp-code"
            className="mb-1.5 block text-center text-sm font-medium text-slate-700"
          >
            Código de acesso
          </label>
          <input
            id="otp-code"
            name="otp-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            value={code}
            maxLength={OTP_MAX_DIGITS}
            onChange={(event) => handleChange(event.target.value)}
            placeholder={"·".repeat(OTP_LENGTH)}
            aria-describedby="otp-hint"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-center text-2xl font-semibold tracking-[0.5em] text-slate-900 placeholder:text-slate-300 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30"
          />
          <p id="otp-hint" className="mt-2 text-center text-xs text-slate-400">
            {isStandalone
              ? "Digite o código aqui no app — o link do e-mail abre no navegador, fora do app."
              : "Se preferir, você também pode clicar no link enviado para o mesmo e-mail."}{" "}
            Não encontrou? Confira a caixa de spam.
          </p>
        </div>

        <button
          type="submit"
          disabled={isVerifying || !isOtpComplete(code)}
          className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isVerifying ? "Verificando..." : "Entrar"}
        </button>
      </form>

      <div className="mt-6 border-t border-slate-100 pt-6">
        <button
          type="button"
          onClick={() => void handleResend()}
          disabled={isResending || cooldown > 0}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResending
            ? "Enviando..."
            : cooldown > 0
              ? `Reenviar código em ${formatCooldown(cooldown)}`
              : "Reenviar código"}
        </button>
        <button
          type="button"
          onClick={onUseAnotherEmail}
          className="mt-2 w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2"
        >
          Usar outro e-mail
        </button>
      </div>
    </div>
  );
}
