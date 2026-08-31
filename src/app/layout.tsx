import type { Metadata } from "next";
// Self-hosted (bundled in node_modules) instead of next/font/google: no
// build-time network dependency, no third-party font request at runtime — which
// is what keeps the CSP in next.config.ts viable and CI hermetic.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "CEPZK Atendimentos",
    template: "%s · CEPZK Atendimentos",
  },
  description: "Internal service desk for CEPZK.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
