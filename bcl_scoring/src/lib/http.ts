import { getApiBaseUrlFromEnv } from "@/lib/runtimeEnv";

export type SafeFetchFailKind = "backend_unavailable" | "http_error" | "parse_error";

export type SafeFetchSuccess<T> = {
  ok: true;
  data: T;
};

export type SafeFetchFail = {
  ok: false;
  kind: SafeFetchFailKind;
  status?: number;
  error?: string;
};

export type SafeFetchResult<T> = SafeFetchSuccess<T> | SafeFetchFail;
export type BackendHandshakeStatus = "available" | "unavailable";

export type BackendHandshakeResult = {
  status: BackendHandshakeStatus;
  service: string;
  endpoint: "/health" | "/version" | null;
  checked_at: string;
  message: string | null;
};

function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function getApiBaseUrl(): string {
  return getApiBaseUrlFromEnv();
}

export function buildApiUrl(path: string): string {
  const cleanedPath = path.startsWith("/") ? path : `/${path}`;
  if (isAbsoluteUrl(cleanedPath)) return cleanedPath;

  const base = getApiBaseUrl();
  if (!base) return cleanedPath;
  return `${base}${cleanedPath}`;
}

function toErrorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  return String(value || "Unknown error");
}

function snippet(text: string, limit = 220): string {
  if (!text) return "";
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit)}...`;
}

export async function safeFetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<SafeFetchResult<T>> {
  try {
    const response = await fetch(url, init);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        kind: "http_error",
        status: response.status,
        error: snippet(body) || `${response.status} ${response.statusText}`,
      };
    }

    try {
      const data = (await response.json()) as T;
      return {
        ok: true,
        data,
      };
    } catch (error) {
      return {
        ok: false,
        kind: "parse_error",
        status: response.status,
        error: toErrorMessage(error),
      };
    }
  } catch (error) {
    return {
      ok: false,
      kind: "backend_unavailable",
      error: toErrorMessage(error),
    };
  }
}

export function isBackendUnavailable(result: SafeFetchFail): boolean {
  return result.kind === "backend_unavailable";
}

let handshakeCache: BackendHandshakeResult | null = null;
let handshakeCacheAt = 0;
const HANDSHAKE_CACHE_TTL_MS = 15_000;

function unwrapPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const asRecord = payload as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(asRecord, "ok")) {
    if (asRecord.ok === false) return null;
    if (Object.prototype.hasOwnProperty.call(asRecord, "data")) return asRecord.data;
  }
  return payload;
}

function toHandshakeMessage(failure: SafeFetchFail): string {
  if (failure.kind === "backend_unavailable") return "Backend not available";
  if (failure.kind === "http_error") {
    return failure.status ? `HTTP ${failure.status}` : "HTTP error";
  }
  return "Invalid backend payload";
}

export async function fetchBackendHandshake(
  forceRefresh = false
): Promise<BackendHandshakeResult> {
  const now = Date.now();
  if (!forceRefresh && handshakeCache && now - handshakeCacheAt < HANDSHAKE_CACHE_TTL_MS) {
    return handshakeCache;
  }

  const endpoints: Array<"/health" | "/version"> = ["/health", "/version"];
  let lastMessage: string | null = null;

  for (const endpoint of endpoints) {
    const response = await safeFetchJson<unknown>(buildApiUrl(endpoint));
    if (!response.ok) {
      lastMessage = toHandshakeMessage(response);
      continue;
    }

    const payload = unwrapPayload(response.data);
    const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const isOk = root.ok === true || typeof root.service === "string";
    if (!isOk) {
      lastMessage = "Invalid backend payload";
      continue;
    }

    const result: BackendHandshakeResult = {
      status: "available",
      service: typeof root.service === "string" && root.service.trim() ? root.service.trim() : "bim-scoring-api",
      endpoint,
      checked_at: new Date().toISOString(),
      message: null,
    };
    handshakeCache = result;
    handshakeCacheAt = now;
    return result;
  }

  const unavailable: BackendHandshakeResult = {
    status: "unavailable",
    service: "Not available",
    endpoint: null,
    checked_at: new Date().toISOString(),
    message: lastMessage || "Backend not available",
  };
  handshakeCache = unavailable;
  handshakeCacheAt = now;
  return unavailable;
}
