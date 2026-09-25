"use client";

import { useState } from "react";
import Link from "next/link";
import { BarsIcon } from "@/app/icons";
import { signOut } from "@/app/session-actions";

/**
 * The app bar's menu: the volunteer's personal data and the session
 * exit. Client-side because it owns the open/close state.
 */
export function ProfileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Abrir menu"
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-600"
      >
        <BarsIcon className="h-5 w-5" />
      </button>

      {open && (
        <>
          {/* Tap anywhere else to close the menu. */}
          <div
            aria-hidden="true"
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            <Link
              role="menuitem"
              href="/perfil"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Dados pessoais
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="block w-full px-4 py-3 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                Sair
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
