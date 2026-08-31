import { requirePrincipal } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

/**
 * Auth wall for the whole app. `requirePrincipal` calls redirect() before any
 * children render, so protected markup never reaches the HTML of an
 * unauthenticated response.
 */
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const principal = await requirePrincipal("/app");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-6">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span
              aria-hidden
              className="bg-brand grid size-6 place-items-center rounded-md text-[11px] font-bold text-white"
            >
              C
            </span>
            Atendimentos
          </span>
          <nav className="text-muted-foreground ml-auto flex items-center gap-3 text-xs">
            <span className="hidden sm:inline" title={principal.id}>
              {principal.email}
              {principal.role ? ` · ${principal.role}` : ""}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="border-input text-foreground hover:bg-muted rounded-md border px-2.5 py-1 font-medium transition-colors"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {children}
      </main>

      <footer className="border-t py-4">
        <p className="text-muted-foreground mx-auto w-full max-w-5xl px-6 text-[11px]">
          Frontend: Vercel · Auth + data: Supabase (RLS enforced server-side)
        </p>
      </footer>
    </div>
  );
}
