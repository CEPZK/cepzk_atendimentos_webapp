import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { sanitizeNextPath } from "@/lib/url";
import { getSupabaseConfig } from "@/lib/env";

export const metadata: Metadata = {
  title: "Entrar",
};

/** Message shown above the form for each `?error=` value. */
function errorMessageFor(error: string | undefined): string | null {
  if (!error) return null;
  if (error === "config") {
    return "A plataforma ainda não está configurada (credenciais do Supabase ausentes). Avise um administrador.";
  }
  return "O link de acesso expirou ou não é mais válido. Solicite um novo.";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);
  const isConfigured = getSupabaseConfig() !== null;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <LoginForm
        nextPath={nextPath}
        isConfigured={isConfigured}
        errorMessage={errorMessageFor(
          isConfigured ? params.error : "config",
        )}
      />
    </main>
  );
}
