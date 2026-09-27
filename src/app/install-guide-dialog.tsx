"use client";

import { useEffect } from "react";

interface InstallGuideDialogProps {
  isIOS: boolean;
  onClose: () => void;
}

/**
 * Instructional modal that guides users on how to install the PWA when the
 * browser does not support or provide a direct programmatic install prompt
 * (e.g. iOS Safari or desktop browsers without beforeinstallprompt).
 */
export function InstallGuideDialog({
  isIOS,
  onClose,
}: InstallGuideDialogProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-guide-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <h3
            id="install-guide-title"
            className="text-base font-semibold text-slate-900"
          >
            {isIOS ? "Instalar no iPhone / iPad" : "Instalar Aplicativo"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>

        {isIOS ? (
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>
              Para adicionar o aplicativo à tela de início do seu iPhone ou
              iPad:
            </p>
            <ol className="space-y-2 rounded-xl bg-slate-50 p-3 text-slate-700">
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                  1
                </span>
                <span>
                  No Safari, toque no botão <strong>Compartilhar</strong> (ícone
                  de quadrado com uma seta para cima na barra inferior).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                  2
                </span>
                <span>
                  Role o menu para baixo e selecione{" "}
                  <strong>Adicionar à Tela de Início</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                  3
                </span>
                <span>
                  Toque em <strong>Adicionar</strong> no canto superior direito.
                </span>
              </li>
            </ol>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>Para instalar este aplicativo no seu dispositivo:</p>
            <ul className="space-y-2.5 rounded-xl bg-slate-50 p-3 text-slate-700">
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-600" />
                <span>
                  <strong>No computador (Chrome / Edge):</strong> clique no
                  ícone de instalação na barra de endereços (ao lado dos
                  favoritos) ou no menu (⋮) &gt; &ldquo;Instalar CEPZK&rdquo;.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-600" />
                <span>
                  <strong>No celular (Android):</strong> abra o menu do
                  navegador (três pontinhos ⋮) e selecione &ldquo;Instalar
                  aplicativo&rdquo; ou &ldquo;Adicionar à tela inicial&rdquo;.
                </span>
              </li>
            </ul>
          </div>
        )}

        <div className="mt-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
