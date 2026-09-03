"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTreatmentState } from "../actions";

/**
 * "Dar Alta" / "Iniciar Tratamento".
 *
 * The team that runs the treatment moves it forward from the assistido's
 * screen; the server action checks the escala again before writing.
 */
export function TreatmentStateButton({
  treatmentId,
  nextState,
  label,
}: {
  treatmentId: number;
  nextState: string;
  label: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await updateTreatmentState(treatmentId, nextState);
      if (!result.ok) {
        setError(result.message ?? "Não foi possível atualizar.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Salvando..." : label}
      </button>

      {error && (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}
