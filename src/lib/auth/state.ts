/**
 * Shared shape for the auth forms.
 *
 * This lives outside `actions.ts` because a `"use server"` module may only
 * export async functions — a constant like the idle state there is a hard build
 * failure ("A use server file can only export async functions, found object"),
 * which is easy to hit and easy to misread as a React bug.
 */
export type ActionState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

export const IDLE_STATE: ActionState = { status: "idle" };
