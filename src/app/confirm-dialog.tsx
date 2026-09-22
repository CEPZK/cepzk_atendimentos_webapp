"use client";

const CONFIRM_BUTTON =
  "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 disabled:cursor-not-allowed disabled:opacity-60";

const CANCEL_BUTTON =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  /** Label shown on the confirm button while the action is running. */
  pendingLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A confirmation dialog in the app's own style — replaces window.confirm.
 * Same shell as the calendar day dialog: dimmed backdrop, white card,
 * dismissible by Cancel or by clicking outside.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirmar",
  pendingLabel,
  cancelLabel = "Cancelar",
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        // Click on the backdrop (not the card) dismisses the dialog.
        if (event.target === event.currentTarget && !isPending) {
          onCancel();
        }
      }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className={CANCEL_BUTTON}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={CONFIRM_BUTTON}
          >
            {isPending && pendingLabel ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
