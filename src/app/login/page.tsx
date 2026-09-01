import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { sanitizeNextPath } from "@/lib/url";

export const metadata: Metadata = {
  title: "Entrar",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <LoginForm
        nextPath={nextPath}
        errorMessage={params.error ? "O link de acesso expirou ou não é mais válido. Solicite um novo." : null}
      />
    </main>
  );
}
