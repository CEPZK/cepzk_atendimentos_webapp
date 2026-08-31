"use client";

import { QueryClient } from "@tanstack/react-query";

/**
 * Defaults chosen for "no realtime in v1": data is considered fresh for 30s,
 * and a window refocus triggers a background refetch so a stale open tab
 * self-heals. When Supabase Realtime is added later, flip refetchOnWindowFocus
 * off and invalidate from the channel — no call sites change.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: 1,
        retryOnMount: true,
      },
      mutations: {
        // Mutations hit the Edge Functions; never auto-retry (idempotency is
        // not guaranteed for every write).
        retry: 0,
      },
    },
  });
}
