"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/query/query-client";

/**
 * One QueryClient per browser tab. Server -> client cache hydration is
 * intentionally not wired yet: reads currently happen in Server Components, and
 * this provider exists for the interactive screens (mutations, optimistic list
 * updates) that arrive with the domain.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
