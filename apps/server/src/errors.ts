import type { Context } from "hono";

export type ApiErrorCode =
  | "unauthorized"
  | "view_code_required"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "invalid"
  | "too_large"
  | "internal";

const statusByCode = {
  unauthorized: 401,
  view_code_required: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  invalid: 400,
  too_large: 413,
  internal: 500,
} as const;

export function apiError(c: Context, code: ApiErrorCode, message: string, details?: unknown) {
  return c.json(
    { error: { code, message, ...(details !== undefined ? { details } : {}) } },
    statusByCode[code]
  );
}
