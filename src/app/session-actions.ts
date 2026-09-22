"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Ends the session and sends the volunteer back to the login screen.
 *
 * The proxy also bounces logged-out requests to /login; the redirect here
 * just makes the round trip immediate after "Sair".
 */
export async function signOut(): Promise<never> {
  const supabase = await createClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/login");
}
