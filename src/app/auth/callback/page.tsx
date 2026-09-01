import type { Metadata } from "next";
import { AuthCallback } from "./callback-client";

// Rendered per request so the Supabase configuration published by the
// layout always carries the *runtime* values (see supabase-env.tsx).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entrando",
};

export default function AuthCallbackPage() {
  return <AuthCallback />;
}
