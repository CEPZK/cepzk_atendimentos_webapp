"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseConfig } from "@/lib/supabase/client";

type Status = "ok" | "fail" | "warn" | "running";

interface Check {
  name: string;
  status: Status;
  detail: string;
}

const ICON: Record<Status, string> = {
  ok: "✅",
  fail: "❌",
  warn: "⚠️",
  running: "⏳",
};

/**
 * Self-service diagnosis of the sign-in setup, executed in the visitor's
 * browser — the only place that can actually reach Supabase.
 */
export function Diagnostics({ serverConfigured }: { serverConfigured: boolean }) {
  const [checks, setChecks] = useState<Check[]>([]);

  useEffect(() => {
    const results: Check[] = [];
    const push = (c: Check) => {
      results.push(c);
      setChecks([...results]);
    };

    async function run() {
      push({
        name: "Servidor com as credenciais",
        status: serverConfigured ? "ok" : "fail",
        detail: serverConfigured
          ? "NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY presentes no ambiente."
          : "Faltam as variáveis no ambiente do servidor (Vercel → Settings → Environment Variables).",
      });

      const fromBundle = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      );
      const config = getBrowserSupabaseConfig();

      push({
        name: "Navegador com as credenciais",
        status: config ? "ok" : "fail",
        detail: config
          ? `URL: ${config.url} — origem: ${fromBundle ? "bundle do build" : "HTML do servidor (runtime)"}.`
          : "O navegador não recebeu as credenciais: o bundle foi gerado sem elas e o servidor não as publicou.",
      });

      push({
        name: "Origem da página",
        status: "ok",
        detail: window.location.origin,
      });

      if (!config) return;

      push({
        name: "Conexão com o Supabase",
        status: "running",
        detail: "consultando /auth/v1/settings...",
      });

      try {
        const response = await fetch(`${config.url}/auth/v1/settings`, {
          headers: { apikey: config.anonKey },
        });
        results.pop();
        push({
          name: "Conexão com o Supabase",
          status: response.ok ? "ok" : "fail",
          detail: response.ok
            ? `HTTP ${response.status} — URL e anon key válidas.`
            : `HTTP ${response.status} — verifique a URL e a anon key.`,
        });
      } catch (cause) {
        results.pop();
        push({
          name: "Conexão com o Supabase",
          status: "fail",
          detail: `Falha de rede: ${cause instanceof Error ? cause.message : String(cause)}`,
        });
      }

      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        push({
          name: "Sessão neste navegador",
          status: session ? "ok" : "warn",
          detail: session
            ? `Autenticado como ${session.user.email}.`
            : "Nenhuma sessão ativa (esperado antes de entrar).",
        });

        const authCookie = document.cookie
          .split("; ")
          .some((c) => /^sb-.*auth-token/.test(c));
        push({
          name: "Cookie de sessão (lido pelo servidor)",
          status: session ? (authCookie ? "ok" : "fail") : "warn",
          detail: authCookie
            ? "Cookie sb-*-auth-token presente: o servidor reconhece o login."
            : "Nenhum cookie sb-*-auth-token — o servidor não enxerga a sessão.",
        });
      } catch (cause) {
        push({
          name: "Sessão neste navegador",
          status: "fail",
          detail: cause instanceof Error ? cause.message : String(cause),
        });
      }

      push({
        name: "Service worker",
        status: "ok",
        detail:
          "serviceWorker" in navigator
            ? `${(await navigator.serviceWorker.getRegistrations()).length} registro(s). Em caso de versão antiga em cache, use o botão abaixo.`
            : "Não suportado neste navegador.",
      });
    }

    run();
  }, [serverConfigured]);

  async function resetServiceWorker() {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    window.location.reload();
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Diagnóstico
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Verificação da configuração de acesso, executada neste navegador.
      </p>

      <ul className="mt-6 space-y-3">
        {checks.map((check, index) => (
          <li
            key={`${check.name}-${index}`}
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

      <button
        type="button"
        onClick={resetServiceWorker}
        className="mt-6 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        Limpar cache do app (service worker) e recarregar
      </button>
    </main>
  );
}
