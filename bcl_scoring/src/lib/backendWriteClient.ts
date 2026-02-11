import { buildApiUrl } from "@/lib/http";

export type BackendActorRole = "role1" | "role2" | "role3";

export type BackendIssue =
  | "authorization"
  | "conflict"
  | "locked"
  | "validation"
  | "unavailable"
  | "unknown";

const ACTOR_ROLE_HEADER_VALUE: Record<BackendActorRole, string> = {
  role1: "role1",
  role2: "role2",
  role3: "role3",
};

const DEFAULT_ACTOR_ID: Record<BackendActorRole, string> = {
  role1: "frontend-role1-user",
  role2: "frontend-role2-user",
  role3: "frontend-role3-user",
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const item = value as Record<string, unknown>;
  const keys = Object.keys(item).sort((a, b) => a.localeCompare(b));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(item[key])}`).join(",")}}`;
}

function fnv1aHex(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createDeterministicIdempotencyKey(scope: string, payload: unknown): string {
  const hash = fnv1aHex(`${scope}:${stableStringify(payload)}`);
  return `${scope}:${hash}`;
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseJsonSafely(raw: string): unknown {
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeErrorBody(input: unknown): { code: string; message: string; request_id: string | null } {
  const item = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const error =
    item.error && typeof item.error === "object"
      ? (item.error as Record<string, unknown>)
      : null;
  const meta = item.meta && typeof item.meta === "object" ? (item.meta as Record<string, unknown>) : null;

  const code = typeof error?.code === "string" && error.code.trim() ? error.code.trim() : "HTTP_ERROR";
  const message =
    typeof error?.message === "string" && error.message.trim()
      ? error.message.trim()
      : typeof item.message === "string" && item.message.trim()
        ? item.message.trim()
        : "Request failed";
  const request_id =
    typeof meta?.request_id === "string" && meta.request_id.trim()
      ? meta.request_id.trim()
      : null;

  return { code, message, request_id };
}

export class BackendWriteError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly request_id: string | null;

  constructor(params: {
    message: string;
    status: number | null;
    code: string;
    request_id?: string | null;
  }) {
    super(params.message);
    this.name = "BackendWriteError";
    this.status = params.status;
    this.code = params.code;
    this.request_id = params.request_id || null;
  }
}

export function isBackendWriteError(error: unknown): error is BackendWriteError {
  return error instanceof BackendWriteError;
}

export function classifyBackendIssue(params: {
  status?: number | null;
  code?: string | null;
  message?: string | null;
}): BackendIssue {
  const status = params.status ?? null;
  const code = (params.code || "").toUpperCase();
  const message = (params.message || "").toUpperCase();

  if (status === 401 || status === 403 || code.includes("FORBIDDEN") || code.includes("UNAUTHORIZED")) {
    return "authorization";
  }
  if (status === 423 || code.includes("LOCKED") || message.includes("PERIOD_LOCKED")) {
    return "locked";
  }
  if (status === 409 || code.includes("CONFLICT")) {
    return "conflict";
  }
  if (status === 400 || code.includes("VALIDATION") || code.includes("BAD_REQUEST")) {
    return "validation";
  }
  if (status === null || status >= 500 || message.includes("BACKEND NOT AVAILABLE")) {
    return "unavailable";
  }
  return "unknown";
}

export function formatBackendIssueMessage(error: unknown): string {
  if (!isBackendWriteError(error)) {
    if (error instanceof Error) return error.message;
    return "Unknown backend error";
  }

  const issue = classifyBackendIssue(error);
  if (issue === "authorization") return `HTTP ${error.status ?? 403} FORBIDDEN_ROLE - ${error.message}`;
  if (issue === "locked") return `HTTP ${error.status ?? 423} PERIOD_LOCKED - ${error.message}`;
  if (issue === "conflict") return `HTTP ${error.status ?? 409} ${error.code} - ${error.message}`;
  if (issue === "validation") return `HTTP ${error.status ?? 400} ${error.code} - ${error.message}`;
  if (issue === "unavailable") return "Backend unavailable";
  return `HTTP ${error.status ?? 500} ${error.code} - ${error.message}`;
}

export async function callBackendWrite<T>(params: {
  path: string;
  method: "POST" | "PUT";
  actorRole: BackendActorRole;
  actorId?: string;
  body: Record<string, unknown>;
  idempotencyScope: string;
  idempotencyPayload: unknown;
}): Promise<T> {
  const requestId = createRequestId();
  const idempotencyKey = createDeterministicIdempotencyKey(
    params.idempotencyScope,
    params.idempotencyPayload
  );
  const payload: Record<string, unknown> = {
    ...params.body,
    idempotency_key: params.body.idempotency_key || idempotencyKey,
  };

  let response: Response;
  try {
    response = await fetch(buildApiUrl(params.path), {
      method: params.method,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
        "X-Actor-Id": params.actorId || DEFAULT_ACTOR_ID[params.actorRole],
        "X-Actor-Role": ACTOR_ROLE_HEADER_VALUE[params.actorRole],
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backend not available";
    throw new BackendWriteError({
      status: null,
      code: "BACKEND_UNAVAILABLE",
      message,
    });
  }

  const raw = await response.text();
  const parsed = parseJsonSafely(raw);

  if (!response.ok) {
    const normalized = normalizeErrorBody(parsed);
    throw new BackendWriteError({
      status: response.status,
      code: normalized.code,
      message: normalized.message,
      request_id: normalized.request_id,
    });
  }

  const root = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  if (root.ok === false) {
    const normalized = normalizeErrorBody(root);
    throw new BackendWriteError({
      status: response.status,
      code: normalized.code,
      message: normalized.message,
      request_id: normalized.request_id,
    });
  }

  if (Object.prototype.hasOwnProperty.call(root, "data")) {
    return root.data as T;
  }

  return (parsed as T) ?? ({} as T);
}
