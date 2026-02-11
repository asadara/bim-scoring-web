export const UNKNOWN_PROJECT_KEY = "UNKNOWN_PROJECT";
export const UNKNOWN_ACTIVE_PERIOD_KEY = "UNKNOWN_ACTIVE";

export type CanonicalPeriodStatus = "OPEN" | "LOCKED";
export type CanonicalStoredEvidenceStatus = "DRAFT" | "SUBMITTED" | "NEEDS_REVISION";
export type CanonicalReviewOutcome = "ACCEPTABLE" | "NEEDS REVISION" | "REJECTED";
export type CanonicalEvidenceLifecycleStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "ACCEPTABLE"
  | "NEEDS_REVISION"
  | "REJECTED";

function asTrimmedUpper(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function normalizePeriodKey(periodId: string | null | undefined): string {
  const text = typeof periodId === "string" ? periodId.trim() : "";
  if (!text || text === "__NOT_AVAILABLE__") return UNKNOWN_ACTIVE_PERIOD_KEY;
  return text;
}

export function buildPrototypeScopeKey(
  projectId: string | null | undefined,
  periodId: string | null | undefined
): string {
  const projectKey =
    typeof projectId === "string" && projectId.trim()
      ? projectId.trim()
      : UNKNOWN_PROJECT_KEY;
  return `proto:${projectKey}:${normalizePeriodKey(periodId)}`;
}

export function normalizePeriodStatus(raw: unknown): CanonicalPeriodStatus | null {
  const value = asTrimmedUpper(raw);
  if (value === "OPEN") return "OPEN";
  if (value === "LOCKED") return "LOCKED";
  if (typeof raw === "boolean") return raw ? "LOCKED" : "OPEN";
  return null;
}

export function normalizeEvidenceStatus(raw: unknown): CanonicalStoredEvidenceStatus {
  const value = asTrimmedUpper(raw);
  if (value === "SUBMITTED") return "SUBMITTED";
  if (value === "NEEDS_REVISION" || value === "NEEDS REVISION") return "NEEDS_REVISION";
  return "DRAFT";
}

export function normalizeReviewOutcome(raw: unknown): CanonicalReviewOutcome | null {
  const value = asTrimmedUpper(raw);
  if (value === "ACCEPTABLE") return "ACCEPTABLE";
  if (value === "NEEDS_REVISION" || value === "NEEDS REVISION") return "NEEDS REVISION";
  if (value === "REJECTED") return "REJECTED";
  return null;
}

export function reviewOutcomeToEvidenceStatus(
  outcome: CanonicalReviewOutcome
): "ACCEPTABLE" | "NEEDS_REVISION" | "REJECTED" {
  if (outcome === "NEEDS REVISION") return "NEEDS_REVISION";
  if (outcome === "ACCEPTABLE") return "ACCEPTABLE";
  return "REJECTED";
}
