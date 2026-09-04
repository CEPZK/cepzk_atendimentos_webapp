"use client";

import { useEffect } from "react";

/**
 * Friendly fallback for unexpected server/client rendering errors — better
 * than the bare "Internal Server Error" page.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[cepzk] Unexpected error", error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Algo deu errado
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-slate-600">
        Não foi possível carregar esta página. Tente novamente em alguns
        instantes; se o problema continuar, avise um administrador.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-800"
      >
        Tentar novamente
      </button>
    </main>
  );
}
