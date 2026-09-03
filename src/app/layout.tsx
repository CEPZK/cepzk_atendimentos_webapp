import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterServiceWorker } from "@/app/register-sw";
import { SupabaseEnvScript } from "@/app/supabase-env";
import { AuthTokensHandler } from "@/app/auth-tokens-handler";

export const metadata: Metadata = {
  title: {
    default: "CEPZK · Atendimentos",
    template: "%s · CEPZK",
  },
  description:
    "Controle dos atendimentos de tratamentos da Casa Espírita CEPZK.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CEPZK Atendimentos",
  },
  icons: {
    icon: "/favicon.ico",
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <SupabaseEnvScript />
        <RegisterServiceWorker />
        <AuthTokensHandler />
        {children}
      </body>
    </html>
  );
}
