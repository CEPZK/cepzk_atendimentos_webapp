import { getSupabaseConfig } from "@/lib/env";

export interface ServerCheck {
  name: string;
  status: "ok" | "fail" | "warn";
  detail: string;
}

/** Deployment identification, useful to confirm what is actually live. */
function deploymentCheck(): ServerCheck {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  const env = process.env.VERCEL_ENV ?? "local";
  const host = process.env.VERCEL_URL ?? "local";
  return {
    name: "Deploy em execução",
    status: "ok",
    detail: `env=${env} host=${host} commit=${sha ? sha.slice(0, 7) : "desconhecido"}`,
  };
}

/** Reaches Supabase from the server (Vercel), where the network is open. */
async function supabaseReachabilityCheck(): Promise<ServerCheck> {
  const config = getSupabaseConfig();
  if (!config) {
    return {
      name: "Servidor → Supabase",
      status: "fail",
      detail: "Sem credenciais no ambiente do servidor.",
    };
  }

  const started = Date.now();
  try {
    const response = await fetch(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.anonKey },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const elapsed = Date.now() - started;
    const body = (await response.json().catch(() => null)) as {
      external?: { email?: boolean };
      disable_signup?: boolean;
      mailer_autoconfirm?: boolean;
    } | null;

    return {
      name: "Servidor → Supabase",
      status: response.ok ? "ok" : "fail",
      detail: response.ok
        ? `HTTP ${response.status} em ${elapsed}ms — email=${body?.external?.email} ` +
          `disable_signup=${body?.disable_signup} mailer_autoconfirm=${body?.mailer_autoconfirm}`
        : `HTTP ${response.status} em ${elapsed}ms — verifique URL e anon key.`,
    };
  } catch (cause) {
    return {
      name: "Servidor → Supabase",
      status: "fail",
      detail: `Falha: ${cause instanceof Error ? cause.message : String(cause)}`,
    };
  }
}

/** Shows how the credentials look, without leaking the whole key. */
function credentialsCheck(): ServerCheck {
  const config = getSupabaseConfig();
  if (!config) {
    return {
      name: "Credenciais no servidor",
      status: "fail",
      detail: "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes.",
    };
  }

  const looksTrimmed =
    config.url === config.url.trim() && config.anonKey === config.anonKey.trim();

  let ref = "?";
  try {
    ref = new URL(config.url).hostname.split(".")[0];
  } catch {
    ref = "URL inválida";
  }

  return {
    name: "Credenciais no servidor",
    status: looksTrimmed && ref !== "URL inválida" ? "ok" : "fail",
    detail:
      `projeto=${ref} url=${config.url} ` +
      `anonKey=${config.anonKey.slice(0, 12)}…${config.anonKey.slice(-6)} ` +
      `(${config.anonKey.length} chars${looksTrimmed ? "" : ", com espaços/quebra de linha!"})`,
  };
}

export async function runServerChecks(): Promise<ServerCheck[]> {
  return [
    deploymentCheck(),
    credentialsCheck(),
    await supabaseReachabilityCheck(),
  ];
}
