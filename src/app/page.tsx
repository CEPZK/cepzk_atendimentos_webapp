import { redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/session";

/**
 * No landing page for an internal tool: signed-in users land on the app,
 * everyone else goes to the magic-link screen. Server-side check (not a client
 * effect) so there is no render-then-flash and no protected markup in HTML.
 */
export default async function RootPage() {
  const principal = await getPrincipal();
  redirect(principal ? "/app" : "/login");
}
