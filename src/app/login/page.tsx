import type { Metadata } from "next";
import { LoginForm } from "./login-form";

/** Reads searchParams (error/next) and must not be statically cached. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/app";
  const banner =
    typeof params.error === "string"
      ? params.error
      : typeof params.message === "string"
        ? params.message
        : undefined;

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <span
            aria-hidden
            className="bg-brand grid size-9 place-items-center rounded-lg text-sm font-semibold text-white"
          >
            C
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight">CEPZK</p>
            <p className="text-muted-foreground text-xs">Atendimentos</p>
          </div>
        </div>

        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          We&apos;ll email you a one-time link. No password to remember.
        </p>

        <div className="mt-6">
          <LoginForm defaultNext={next} banner={banner} />
        </div>

        <p className="text-muted-foreground mt-8 text-xs leading-relaxed">
          Access is limited to addresses provisioned by an administrator. Links
          expire quickly and can be used once.
        </p>
      </div>
    </main>
  );
}
