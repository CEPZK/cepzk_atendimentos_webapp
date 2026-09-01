import type { Metadata } from "next";
import { getSupabaseConfig } from "@/lib/env";
import { Diagnostics } from "./diagnostics";

// Always rendered per request: it reports the *current* configuration.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Diagnóstico",
  robots: { index: false, follow: false },
};

export default function DiagnosticsPage() {
  return <Diagnostics serverConfigured={getSupabaseConfig() !== null} />;
}
