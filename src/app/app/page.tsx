import { getPrincipal } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env/public";

export const dynamic = "force-dynamic";

/**
 * Temporary home screen. It exists to prove the vertical slice — Vercel
 * deploy → proxy session refresh → Supabase magic link → RLS-scoped read —
 * before any domain screen is built. Replaced by the atendimento queue once
 * contracts/sql/0003 ships.
 */
export default async function DashboardPage() {
  const principal = await getPrincipal();
  const { url, allowSelfSignup } = publicEnv();
  const projectRef = new URL(url).hostname.split(".")[0] ?? "";

  const rows: Array<[string, string]> = [
    ["Signed in as", principal?.email ?? "—"],
    ["User id (auth.users.id)", principal?.id ?? "—"],
    ["app_metadata.role", principal?.role ?? "(not set)"],
    ["Supabase project", projectRef],
    ["Self-signup", allowSelfSignup ? "allowed" : "locked (invite-only)"],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Vertical slice is live
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          This page rendered from a Server Component using a session cookie that
          the proxy validated with{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-[13px]">
            getClaims()
          </code>
          . Nothing here is cached across users, and the domain screens will
          appear as soon as the schema contract in{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-[13px]">
            contracts/
          </code>{" "}
          is implemented on the backend.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border">
        <h2 className="bg-muted/40 text-muted-foreground border-b px-4 py-2.5 text-xs font-semibold tracking-wide uppercase">
          Session
        </h2>
        <dl className="divide-y text-sm">
          {rows.map(([k, v]) => (
            <div
              key={k}
              className="grid gap-1 px-4 py-3 sm:grid-cols-[16rem_1fr] sm:gap-4"
            >
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-mono text-[13px] break-all">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
