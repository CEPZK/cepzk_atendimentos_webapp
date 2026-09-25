"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/app/confirm-dialog";
import { updateTreatmentState } from "../actions";

const BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * "Dar Alta" / "Iniciar Assistência".
 *
 * The team that runs the treatment moves it forward from the assistido's
 * screen; the server action checks the escala again before writing.
 *
 * A mudança feita na tela (o "Dar Alta") pede confirmação num diálogo
 * centralizado antes de escrever; a que abre outra tela (a agenda do
 * Acolher com Amor) é só um link.
 */
export function TreatmentStateButton({
  treatmentId,
  nextState,
  label,
  href,
}: {
  treatmentId: number;
  nextState: string;
  label: string;
  /** When the change needs a screen of its own (the ACA agenda). */
  href?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await updateTreatmentState(treatmentId, nextState);
      if (!result.ok) {
        setConfirming(false);
        setError(result.message ?? "Não foi possível atualizar.");
        return;
      }
      router.refresh();
    });
  }

  if (href) {
    return (
      <div className="mt-4">
        <Link href={href} className={BUTTON_CLASS}>
          {label}
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        disabled={isPending}
        className={BUTTON_CLASS}
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

      {confirming && (
        <ConfirmDialog
          title="Dar alta?"
          description="A assistência passará para a situação Alta."
          confirmLabel={label}
          pendingLabel="Salvando..."
          isPending={isPending}
          onConfirm={confirm}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
