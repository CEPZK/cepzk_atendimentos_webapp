"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

interface InstallGuideDialogProps {
  isIOS: boolean;
  isChromeIOS?: boolean;
  onClose: () => void;
}

const noopSubscribe = () => () => {};

/**
 * Instructional modal that guides users on how to install the PWA when the
 * browser does not support or provide a direct programmatic install prompt
 * (e.g. iOS Safari/Chrome or desktop browsers without beforeinstallprompt).
 *
 * Rendered through a React Portal directly into document.body so that parent
 * CSS filters (like backdrop-blur on sticky headers) do not break the
 * viewport-relative positioning and centering.
 */
export function InstallGuideDialog({
  isIOS,
  isChromeIOS = false,
  onClose,
}: InstallGuideDialogProps) {
  const isMounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (!isMounted) {
    return null;
  }

  const title = isIOS
    ? isChromeIOS
      ? "Instalar no Chrome (iOS)"
      : "Instalar no iPhone / iPad"
    : "Instalar Aplicativo";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-guide-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto"
    >
      <div className="relative my-auto w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/5 max-h-[90dvh] flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <h3
            id="install-guide-title"
            className="text-base font-semibold text-slate-900 leading-snug"
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>

        <div className="mt-4 overflow-y-auto pr-1">
          {isIOS ? (
            <div className="space-y-3 text-sm text-slate-600">
              <p className="leading-relaxed">
                {isChromeIOS
                  ? "No iOS, a Apple não permite a instalação automática por nenhum navegador (inclusive o Chrome). Para adicionar o app à tela inicial:"
                  : "No iOS, a Apple não permite a instalação automática direta. Para adicionar o app à sua tela de início:"}
              </p>
              <ol className="space-y-2.5 rounded-xl bg-slate-50 p-3.5 text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                    1
                  </span>
                  <span className="leading-snug">
                    {isChromeIOS ? (
                      <>
                        Toque no botão <strong>Compartilhar</strong> (ícone 📤) na barra
                        de endereços do Chrome (ou no menu de três pontos <strong>···</strong>).
                      </>
                    ) : (
                      <>
                        No Safari, toque no botão <strong>Compartilhar</strong> (ícone 📤
                        na barra inferior do navegador).
                      </>
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                    2
                  </span>
                  <span className="leading-snug">
                    Role a lista para baixo e toque em{" "}
                    <strong>Adicionar à Tela de Início</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                    3
                  </span>
                  <span className="leading-snug">
                    Toque em <strong>Adicionar</strong> no canto superior direito para confirmar.
                  </span>
                </li>
              </ol>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-slate-600">
              <p className="leading-relaxed">
                Para instalar este aplicativo no seu dispositivo:
              </p>
              <ul className="space-y-2.5 rounded-xl bg-slate-50 p-3.5 text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-600" />
                  <span className="leading-snug">
                    <strong>No computador (Chrome / Edge):</strong> clique no
                    ícone de instalação na barra de endereços (ao lado dos
                    favoritos) ou no menu (⋮) &gt; &ldquo;Instalar CEPZK&rdquo;.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-600" />
                  <span className="leading-snug">
                    <strong>No celular (Android):</strong> abra o menu do
                    navegador (três pontinhos ⋮) e selecione &ldquo;Instalar
                    aplicativo&rdquo; ou &ldquo;Adicionar à tela inicial&rdquo;.
                  </span>
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="mt-6 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
