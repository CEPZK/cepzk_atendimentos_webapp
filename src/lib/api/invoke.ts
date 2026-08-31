import { createClient } from "@/lib/supabase/client";
import type { Database } from "@contracts/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Transport contract with the backend repo's Edge Functions.
 * Keep this file and contracts/edge-functions.md in lockstep — the BE agent
 * implements the server side of exactly this envelope.
 */
export type ApiOk<T> = { ok: true; data: T; meta?: { requestId?: string } };
export type ApiErr = {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
};

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "conflict"
  | "rate_limited"
  | "internal_error";

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(status: number, payload: ApiErr["error"]) {
    super(payload?.message ?? "Request failed");
    this.name = "ApiError";
    this.status = status;
    this.code = payload?.code ?? "internal_error";
    this.fieldErrors = payload?.fieldErrors;
  }
}

export type InvokeOptions = {
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  signal?: AbortSignal;
};

/**
 * The ONE place the frontend calls a backend function.
 *
 * Rules encoded here:
 *  - Always POST-then-read-envelope (never rely on HTTP status alone).
 *  - The user's access token is forwarded so the function can re-check RLS —
 *    a function that trusts `Authorization`-less input is a privilege hole.
 *  - 5xx is NOT retried here; mutation idempotency is a backend concern.
 */
export async function invokeFunction<
  TResponse,
  TBody extends Record<string, unknown>,
>(
  name: string,
  body: TBody,
  options: InvokeOptions & {
    client?: SupabaseClient<Database>;
  } = {},
): Promise<TResponse> {
  const client = options.client ?? createClient();

  const { data, error } = await client.functions.invoke<
    ApiOk<TResponse> | ApiErr
  >(name, {
    method: options.method ?? "POST",
    body,
    headers: { "Content-Type": "application/json" },
    signal: options.signal,
  });

  // Transport-level failure: no valid envelope to parse.
  if (error) {
    const status = (error as { context?: Response }).context?.status ?? 0;
    const message =
      status === 0
        ? "Could not reach the service. Check your connection and try again."
        : status === 401
          ? "Your session expired. Sign in again."
          : error.message;
    throw new ApiError(status, {
      code: status === 401 ? "unauthorized" : "internal_error",
      message,
    });
  }

  if (!data || typeof data !== "object" || !("ok" in data)) {
    throw new ApiError(502, {
      code: "internal_error",
      message: "The service returned an unexpected response shape.",
    });
  }

  if (data.ok === false) {
    throw new ApiError(400, data.error);
  }

  return data.data;
}
