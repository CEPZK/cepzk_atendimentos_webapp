import type { Metadata } from "next";
import { getSupabaseConfig } from "@/lib/env";
import { Diagnostics } from "./diagnostics";
import { runServerChecks } from "./server-checks";

// Always rendered per request: it reports the *current* configuration.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Diagnóstico",
  robots: { index: false, follow: false },
};

const ICON = { ok: "✅", fail: "❌", warn: "⚠️" } as const;

export default async function DiagnosticsPage() {
  const serverChecks = await runServerChecks();

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-6">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        No servidor (Vercel)
      </h2>
      <ul className="mt-3 space-y-3">
        {serverChecks.map((check) => (
          <li
            key={check.name}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <p className="text-sm font-medium text-slate-900">
              {ICON[check.status]} {check.name}
            </p>
            <p className="mt-1 break-words font-mono text-xs text-slate-500">
              {check.detail}
            </p>
          </li>
        ))}
      </ul>

      <Diagnostics serverConfigured={getSupabaseConfig() !== null} />
    </div>
  );
}
