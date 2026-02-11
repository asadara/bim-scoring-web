export type AppEnvironment = "development" | "staging" | "production";

const ALLOWED_ENVIRONMENTS: ReadonlySet<AppEnvironment> = new Set([
  "development",
  "staging",
  "production",
]);

const API_BASE_BY_ENV: Record<AppEnvironment, string> = {
  development: (
    process.env.NEXT_PUBLIC_BIM_SCORING_API_BASE_URL_DEVELOPMENT ??
    process.env.NEXT_PUBLIC_API_BASE_URL_DEVELOPMENT ??
    ""
  ).trim(),
  staging: (
    process.env.NEXT_PUBLIC_BIM_SCORING_API_BASE_URL_STAGING ??
    process.env.NEXT_PUBLIC_API_BASE_URL_STAGING ??
    ""
  ).trim(),
  production: (
    process.env.NEXT_PUBLIC_BIM_SCORING_API_BASE_URL_PRODUCTION ??
    process.env.NEXT_PUBLIC_API_BASE_URL_PRODUCTION ??
    ""
  ).trim(),
};

function parseBoolean(value: string | undefined): boolean | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  throw new Error(
    `Invalid NEXT_PUBLIC_FEATURE_REAL_BACKEND_WRITE value "${value}". Allowed: true/false/1/0/on/off/yes/no`
  );
}

export function getAppEnvironment(): AppEnvironment {
  const raw = process.env.NEXT_PUBLIC_APP_ENV;
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error(
      'Missing required env var: NEXT_PUBLIC_APP_ENV (allowed: "development", "staging", "production")'
    );
  }

  const normalized = raw.trim().toLowerCase() as AppEnvironment;
  if (!ALLOWED_ENVIRONMENTS.has(normalized)) {
    throw new Error(
      `Unknown NEXT_PUBLIC_APP_ENV "${raw}". Allowed values: development, staging, production`
    );
  }

  return normalized;
}

export function getApiBaseUrlFromEnv(): string {
  const appEnv = getAppEnvironment();
  const value = API_BASE_BY_ENV[appEnv];
  if (!value) {
    const suffix = appEnv.toUpperCase();
    throw new Error(
      `Missing API base URL for NEXT_PUBLIC_APP_ENV=${appEnv}. Set NEXT_PUBLIC_BIM_SCORING_API_BASE_URL_${suffix} or NEXT_PUBLIC_API_BASE_URL_${suffix}.`
    );
  }
  return value.replace(/\/+$/, "");
}

export function getFeatureRealBackendWrite(): boolean {
  const override = parseBoolean(process.env.NEXT_PUBLIC_FEATURE_REAL_BACKEND_WRITE);
  if (override !== null) return override;
  // Default OFF in staging/production and also OFF by default in development unless explicitly enabled.
  return false;
}

export function validatePublicRuntimeEnv(): void {
  getAppEnvironment();
  getApiBaseUrlFromEnv();
  getFeatureRealBackendWrite();
}
