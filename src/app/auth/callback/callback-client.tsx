"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  completeSignIn,
  readAuthCallbackParams,
  stripAuthParamsFromUrl,
} from "@/lib/auth-callback";

/**
 * Dedicated sign-in screen: applies whatever credentials the link carries
 * (see `@/lib/auth-callback`) and forwards the user to `next`, which sends
 * first-time volunteers to the profile completion screen.
 *
 * Failures stay on screen with the real reason instead of bouncing back to
 * a login form that explains nothing.
 */
export function AuthCallback() {
  const router = useRouter();
  const [isSlow, setIsSlow] = useState(false);
  const [failure, setFailure] = useState<{
    message: string;
    detail: string;
  } | null>(null);

  useEffect(() => {
    const params = readAuthCallbackParams();
    stripAuthParamsFromUrl();

    let cancelled = false;
    const slowTimer = window.setTimeout(() => setIsSlow(true), 4000);

    function fail(reason: string, message?: string) {
      console.error(`[cepzk] Sign-in callback failed: ${reason}`);
      if (cancelled) return;
      setFailure({
        message:
          message ??
          "Não foi possível concluir seu acesso. O link pode ter expirado ou já ter sido usado — solicite um novo.",
        detail: reason,
      });
    }

    completeSignIn(params)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          router.replace(params.next);
          router.refresh();
          return;
        }
        fail(result.reason, result.message);
      })
      .catch((cause) => {
        fail(cause instanceof Error ? cause.message : String(cause));
      });

    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
    };
  }, [router]);

  if (failure) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Não foi possível entrar
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {failure.message}
          </p>
          <details className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <summary className="cursor-pointer">Detalhes técnicos</summary>
            <p className="mt-2 break-words font-mono">{failure.detail}</p>
          </details>
          <a
            href="/login"
            className="mt-6 block rounded-lg bg-teal-700 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-teal-800"
          >
            Voltar para o login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="text-center">
        <p className="text-sm text-slate-500">Finalizando seu acesso...</p>
        {isSlow && (
          <p className="mt-2 text-xs text-slate-400">
            Isso está demorando mais que o normal. Aguarde alguns instantes.
          </p>
        )}
      </div>
    </main>
  );
}
