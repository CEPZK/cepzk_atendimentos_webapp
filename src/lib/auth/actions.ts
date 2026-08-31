"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv } from "@/lib/env/public";
import { requestOrigin } from "@/lib/env/server";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/auth/state";

const EmailSchema = z.email().max(320);
/** Relative, same-origin, non-protocol-relative path. Blocks `//evil.com` and `https://evil.com`. */
const NextPathSchema = z
  .string()
  .regex(/^\/(?!\/)[^\s<>"'\\]*$/)
  .max(200);

/**
 * Magic link sign-in.
 *
 * `emailRedirectTo` is built from the *request* headers, not a build-time env
 * var, so every Vercel preview deployment gets a link back to itself instead of
 * bouncing the reviewer to production.
 */
export async function signInWithMagicLink(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = EmailSchema.safeParse(formData.get("email"));
  if (!email.success) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const rawNext = String(formData.get("next") ?? "");
  const next = NextPathSchema.safeParse(rawNext);
  const target = next.success ? next.data : "/app";

  const { allowSelfSignup } = publicEnv();
  const origin = requestOrigin(await headers());

  const supabase = await createClient();

  let error: { message?: string } | null = null;
  try {
    ({ error } = await supabase.auth.signInWithOtp({
      email: email.data,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(target)}`,
        shouldCreateUser: allowSelfSignup,
      },
    }));
  } catch (e) {
    // A network-level failure (Auth API unreachable, DNS, edge timeout) rejects
    // rather than returning { error }. Without this catch the whole server action
    // throws and React renders its unhandled-action error instead of our copy.
    error =
      e instanceof Error ? { message: e.message } : { message: "unknown" };
  }

  if (error) {
    const rateLimited = /rate ?limit/i.test(error.message ?? "");
    return {
      status: "error",
      message: rateLimited
        ? "Too many attempts — wait a minute and try again."
        : "That sign-in request could not be completed.",
    };
  }

  // Deliberately identical wording for existing and unknown addresses:
  // with shouldCreateUser:false an unknown email returns success and sends
  // nothing, so any other copy would turn this form into a user enumerator.
  return {
    status: "sent",
    message: "If that address is registered, a sign-in link is on its way.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
