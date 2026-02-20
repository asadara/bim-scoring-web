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

const DEV_API_OVERRIDE_STORAGE_KEY = "bim_dev_api_base_override_v1";

function readDevApiBaseOverride(): string | null {
  if (typeof window === "undefined") return null;
  // Safety: only allow override when running locally in development.
  const appEnv = (process.env.NEXT_PUBLIC_APP_ENV || "").trim().toLowerCase();
  if (appEnv !== "development") return null;
  const host = window.location.hostname;
  if (host !== "localhost" && host !== "127.0.0.1") return null;

  const raw = window.localStorage.getItem(DEV_API_OVERRIDE_STORAGE_KEY);
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (!isAbsoluteUrl(value)) return null;
  return value.replace(/\/+$/, "");
}

export function getApiBaseUrl(): string {
  const override = readDevApiBaseOverride();
  if (override) return override;
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

function extractHttpStatus(text: string): number | null {
  const match = text.match(/\bhttp\s+(\d{3})\b/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toUserFacingErrorMessage(
  error: unknown,
  fallback = "Terjadi kendala saat memproses permintaan."
): string {
  const raw = toErrorMessage(error).trim();
  if (!raw) return fallback;

  const normalized = raw.toLowerCase();
  const statusFromText = extractHttpStatus(raw);

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("cors") ||
    normalized.includes("backend unavailable") ||
    normalized.includes("backend not available") ||
    normalized.includes("request timeout")
  ) {
    return "Koneksi ke layanan backend sedang bermasalah. Coba lagi beberapa saat.";
  }

  if (
    normalized.includes("unexpected token") ||
    normalized.includes("not valid json") ||
    normalized.includes("invalid json") ||
    normalized.includes("parse error") ||
    normalized.includes("invalid payload")
  ) {
    return "Respons server tidak valid. Coba ulangi dalam beberapa saat.";
  }

  const status =
    statusFromText ||
    (normalized.includes("forbidden") ? 403 : null) ||
    (normalized.includes("unauthorized") ? 401 : null);
  if (status) {
    if (status === 401 || status === 403) {
      return "Akses ditolak. Pastikan akun dan role Anda sudah sesuai.";
    }
    if (status === 404) {
      return "Data yang diminta tidak ditemukan.";
    }
    if (status >= 500) {
      return "Server sedang bermasalah. Silakan coba lagi nanti.";
    }
    return "Permintaan ke server gagal. Silakan coba lagi.";
  }

  // Preserve concise business errors from API, but avoid leaking overly technical text.
  if (raw.length <= 140 && !/[<>{}]/.test(raw)) return raw;
  return fallback;
}

export function toUserFacingSafeFetchError(
  result: SafeFetchFail,
  fallback = "Permintaan ke server gagal."
): string {
  if (result.kind === "backend_unavailable") {
    return toUserFacingErrorMessage(result.error || result.kind, fallback);
  }
  if (result.kind === "http_error") {
    return toUserFacingErrorMessage(
      `HTTP ${result.status || 500}${result.error ? ` ${result.error}` : ""}`,
      fallback
    );
  }
  return toUserFacingErrorMessage(result.error || "Invalid payload", fallback);
}

function snippet(text: string, limit = 220): string {
  if (!text) return "";
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit)}...`;
}

const DEFAULT_FETCH_TIMEOUT_MS = 25_000;

function getFetchTimeoutMs(): number {
  const raw = process.env.NEXT_PUBLIC_FETCH_TIMEOUT_MS;
  if (typeof raw !== "string" || !raw.trim()) return DEFAULT_FETCH_TIMEOUT_MS;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_FETCH_TIMEOUT_MS;
  return value;
}

function isAbortError(error: unknown): boolean {
  // DOMException name is "AbortError" in browsers.
  if (!error || typeof error !== "object") return false;
  return (error as { name?: unknown }).name === "AbortError";
}

export async function safeFetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<SafeFetchResult<T>> {
  const timeoutMs = getFetchTimeoutMs();
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Respect external cancel signals while still enforcing our timeout.
    if (init?.signal) {
      if (init.signal.aborted) {
        controller.abort();
      } else {
        init.signal.addEventListener("abort", () => controller.abort(), { once: true });
      }
    }

    const response = await fetch(url, { ...init, signal: controller.signal });

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
    if (isAbortError(error)) {
      return {
        ok: false,
        kind: "backend_unavailable",
        error: `Request timeout after ${timeoutMs}ms`,
      };
    }
    return {
      ok: false,
      kind: "backend_unavailable",
      error: toErrorMessage(error),
    };
  } finally {
    clearTimeout(timeoutHandle);
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
