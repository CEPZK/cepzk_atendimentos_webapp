import { SupabaseNotConfiguredError } from "@/lib/supabase/client";

export type RequestOtpResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Requests a sign-in code (and magic link) for `email`.
 *
 * Shared by the login form (first request) and the code form (resends)
 * so both surface the same failures the same way.
 */
export async function requestOtpCode(
  email: string,
  nextPath: string,
): Promise<RequestOtpResult> {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Invite-only platform: never create a user without an invite.
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    if (error) {
      const status = (error as { status?: number }).status;
      if (status === 429) {
        return {
          ok: false,
          message:
            "Você pediu códigos demais em sequência. Aguarde um pouco e tente de novo.",
        };
      }
      // Usually: the e-mail was never invited to the platform.
      return {
        ok: false,
        message:
          "Não foi possível enviar o código. Verifique se o e-mail está correto e se você foi convidado para a plataforma.",
      };
    }

    return { ok: true };
  } catch (cause) {
    console.error("[cepzk] Sign-in request failed", cause);
    return {
      ok: false,
      message:
        cause instanceof SupabaseNotConfiguredError
          ? "A plataforma não está configurada corretamente (credenciais do Supabase ausentes nesta versão do site). Avise um administrador."
          : "Serviço temporariamente indisponível. Tente novamente em alguns instantes.",
    };
  }
}
