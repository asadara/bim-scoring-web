import {
  getPrototypePeriodLockFromStore,
  getPrototypePeriodMetaFromStore,
  getPrototypeProjectMetaFromStore,
  getPrototypePeriodStatusFromStore,
  listPrototypeApprovalDecisionsFromStore,
  listPrototypeEvidenceItemsFromStore,
  listPrototypePeriodLocksFromStore,
  listPrototypeProjectIdsFromStore,
  listPrototypeReviewsMapFromStore,
  listPrototypeSnapshotsFromStore,
  listPrototypePeriodIdsByProjectFromStore,
  normalizePrototypePeriodId,
  rememberPrototypePeriodMetaInStore,
  rememberPrototypeProjectMetaInStore,
  savePrototypeEvidenceItemsToStore,
  upsertPrototypePeriodLockInStore,
  upsertPrototypeReviewRecordInStore,
  appendPrototypeApprovalDecisionToStore,
  appendPrototypeSnapshotToStore,
} from "@/lib/prototypeStore";
import { SafeFetchFail, buildApiUrl, safeFetchJson } from "@/lib/http";
import { FEATURE_REAL_BACKEND_WRITE } from "@/lib/featureFlags";
import {
  BackendWriteError,
  callBackendWrite,
  classifyBackendIssue,
} from "@/lib/backendWriteClient";
import {
  CanonicalEvidenceLifecycleStatus,
  CanonicalPeriodStatus,
  UNKNOWN_ACTIVE_PERIOD_KEY,
  buildPrototypeScopeKey,
  normalizeEvidenceStatus,
  normalizePeriodStatus as normalizePeriodStatusModel,
  normalizeReviewOutcome,
  reviewOutcomeToEvidenceStatus,
} from "@/lib/statusModel";

export { normalizePrototypePeriodId } from "@/lib/prototypeStore";

export const NA_TEXT = "Not available";
export const NO_BIM_USE_ID = "__NOT_AVAILABLE__";
export const LOCKED_READ_ONLY_ERROR = "LOCKED (read-only)";
export const PROTOTYPE_WRITE_DISABLED_MESSAGE = "Prototype mode (backend write disabled)";

export function isRealBackendWriteEnabled(): boolean {
  return FEATURE_REAL_BACKEND_WRITE;
}

export type PeriodStatus = CanonicalPeriodStatus;
export type EvidenceStatus = "DRAFT" | "SUBMITTED" | "NEEDS_REVISION";
export type EvidenceLifecycleStatus = CanonicalEvidenceLifecycleStatus;
export type EvidenceType = "FILE" | "URL" | "TEXT";
export type ReviewOutcome = "ACCEPTABLE" | "NEEDS REVISION" | "REJECTED";
export type ApprovalDecision = "APPROVE PERIOD" | "REJECT APPROVAL";
export type DataMode = "backend" | "prototype";

export type ProjectRecord = {
  id: string;
  code: string | null;
  name: string | null;
  phase: string | null;
  is_active: boolean | null;
};

export type ScoringPeriod = {
  id: string;
  project_id: string | null;
  year: number | null;
  week: number | null;
  start_date: string | null;
  end_date: string | null;
  status: PeriodStatus | null;
  version: number | null;
};

export type IndicatorRecord = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  perspective_id: string | null;
  bim_use_id: string | null;
  bim_use_tags: string[];
};

export type BimUseGroup = {
  bim_use_id: string;
  label: string;
  indicators: IndicatorRecord[];
};

export type Role1Context = {
  project: ProjectRecord;
  periods: ScoringPeriod[];
  active_period: ScoringPeriod | null;
  period_status_label: string;
  period_locked: boolean;
  indicators: IndicatorRecord[];
  bim_uses: BimUseGroup[];
  data_mode: DataMode;
  backend_message: string | null;
};

export type LocalEvidenceItem = {
  id: string;
  project_id: string;
  period_id: string | null;
  bim_use_id: string;
  indicator_ids: string[];
  type: EvidenceType;
  title: string;
  description: string;
  external_url: string | null;
  text_content: string | null;
  file_view_url: string | null;
  file_download_url: string | null;
  file_reference_url: string | null;
  status: EvidenceStatus;
  review_reason: string | null;
  review_decision: ReviewOutcome | null;
  reviewer_user_id: string | null;
  reviewed_at: string | null;
  version: number | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  storage_label: "Local draft (prototype, not used in scoring)";
};

export type EvidenceDraftInput = {
  id?: string;
  project_id: string;
  period_id: string | null;
  bim_use_id: string;
  indicator_ids: string[];
  type: EvidenceType;
  title: string;
  description: string;
  external_url?: string | null;
  text_content?: string | null;
  file_view_url?: string | null;
  file_download_url?: string | null;
  file_reference_url?: string | null;
  status: EvidenceStatus;
  review_reason?: string | null;
};

export type PrototypeReviewHistoryEntry = {
  review_outcome: ReviewOutcome;
  review_reason: string;
  reviewed_by: string;
  reviewed_at: string;
};

export type PrototypeReviewRecord = {
  evidence_id: string;
  scope_key: string;
  review_outcome: ReviewOutcome;
  review_reason: string;
  reviewed_by: string;
  reviewed_at: string;
  review_history: PrototypeReviewHistoryEntry[];
};

export type ReviewStatusCount = {
  ACCEPTABLE: number;
  NEEDS_REVISION: number;
  REJECTED: number;
  AWAITING_REVIEW: number;
};

export type PrototypePeriodLockRecord = {
  project_id: string;
  period_id: string;
  scope_key: string;
  status: "LOCKED";
  locked_by: string;
  locked_at: string;
};

export type PrototypeApprovalDecisionRecord = {
  project_id: string;
  period_id: string;
  scope_key: string;
  decision: ApprovalDecision;
  reason: string;
  decided_by: string;
  decided_at: string;
};

export type PrototypeSnapshotRecord = {
  snapshot_id?: string;
  project_id: string;
  period_id: string;
  scope_key: string;
  approved_by: string;
  approved_at: string;
  final_bim_score: number | null;
  breakdown: Array<{ perspective_id: string; score: number | null }>;
  evidence_counts: ReviewStatusCount;
  note: "Prototype snapshot (not used for audit/compliance)";
};

export type LocalEvidenceWithReview = LocalEvidenceItem & {
  effective_status: EvidenceLifecycleStatus;
  latest_review_outcome: ReviewOutcome | null;
  latest_review_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_history: PrototypeReviewHistoryEntry[];
};

type ReadResult<T> = {
  data: T;
  mode: DataMode;
  backend_message: string | null;
};

function resolvePeriodStatus(period: Record<string, unknown>): PeriodStatus | null {
  const byString =
    normalizePeriodStatusModel(period.status) ||
    normalizePeriodStatusModel(period.period_status) ||
    normalizePeriodStatusModel(period.lock_status);
  if (byString) return byString;

  if ("is_locked" in period) {
    const byIsLocked = normalizePeriodStatusModel(period.is_locked);
    if (byIsLocked) return byIsLocked;
  }
  if ("locked" in period) {
    const byLocked = normalizePeriodStatusModel(period.locked);
    if (byLocked) return byLocked;
  }

  const lockedAt = period.locked_at;
  if (typeof lockedAt === "string" && lockedAt.trim()) return "LOCKED";

  return null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  const text = asString(value).trim();
  return text ? text : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const BIM_USE_ALL = "All BIM Use";

const BIM_USE_BY_INDICATOR_CODE: Record<string, string[]> = {
  "P1-01": [BIM_USE_ALL],
  "P1-02": [BIM_USE_ALL],
  "P1-03": [BIM_USE_ALL],
  "P1-04": ["Coordination", "4D", "5D"],
  "P1-05": ["Clash Detection", "Coordination"],
  "P1-06": ["Value / Risk"],
  "P1-07": ["Risk Reduction"],
  "P1-08": ["Publishing / Delivery"],
  "P2-01": ["Design Coordination"],
  "P2-02": ["Clash Detection"],
  "P2-03": ["BCF / Issue Mgmt"],
  "P2-04": ["Detailed Design"],
  "P2-05": ["5D"],
  "P2-06": ["4D"],
  "P2-07": ["Progress Update"],
  "P2-08": ["Coordination"],
  "P2-09": [BIM_USE_ALL],
  "P2-10": ["Model-Based Delivery"],
  "P3-01": [BIM_USE_ALL],
  "P3-02": [BIM_USE_ALL],
  "P3-03": ["5D / Asset Data"],
  "P3-04": [BIM_USE_ALL],
  "P3-05": ["Coordination"],
  "P3-06": [BIM_USE_ALL],
  "P3-07": [BIM_USE_ALL],
  "P3-08": ["Clash Detection"],
  "P4-01": [BIM_USE_ALL],
  "P4-02": [BIM_USE_ALL],
  "P4-03": [BIM_USE_ALL],
  "P4-04": [BIM_USE_ALL],
  "P4-05": [BIM_USE_ALL],
  "P4-06": ["Coordination"],
  "P5-01": ["Coordination"],
  "P5-02": ["Clash Detection"],
  "P5-03": ["5D"],
  "P5-04": ["Coordination"],
  "P5-05": ["4D"],
  "P5-06": ["Asset Information"],
  "P5-07": ["Reporting"],
  "P5-08": ["Strategic Use"],
};

const BIM_USE_LABEL_ALIASES: Record<string, string> = {
  all: BIM_USE_ALL,
  "all bim use": BIM_USE_ALL,
  "clash / coordination": "Clash Detection / Coordination",
};

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeBimUseLabel(value: string): string | null {
  const cleaned = normalizeWhitespace(value);
  if (!cleaned) return null;
  const alias = BIM_USE_LABEL_ALIASES[cleaned.toLowerCase()];
  if (alias) return alias;
  return cleaned;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function parseBimUseTagsFromRaw(value: string | null): string[] {
  if (!value) return [];
  const cleaned = normalizeWhitespace(value);
  if (!cleaned || isUuidLike(cleaned)) return [];

  const aliased = normalizeBimUseLabel(cleaned);
  if (!aliased) return [];
  if (aliased !== cleaned || !cleaned.includes("/")) return [aliased];

  const splitTags = cleaned
    .split("/")
    .map((item) => normalizeBimUseLabel(item))
    .filter((item): item is string => Boolean(item));

  return uniqueStrings(splitTags);
}

function parseBimUseTagsFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) {
    const flattened = value
      .map((entry) => normalizeBimUseLabel(asString(entry)))
      .filter((entry): entry is string => Boolean(entry));
    return uniqueStrings(flattened);
  }
  return parseBimUseTagsFromRaw(asNullableString(value));
}

function resolveIndicatorBimUseTags(item: {
  code: string;
  bim_use_id: string | null;
  bim_use_tags: unknown;
}): string[] {
  const byPayloadTags = parseBimUseTagsFromUnknown(item.bim_use_tags);
  if (byPayloadTags.length > 0) return byPayloadTags;

  const code = normalizeWhitespace(String(item.code || "")).toUpperCase();
  const byCode = BIM_USE_BY_INDICATOR_CODE[code];
  if (Array.isArray(byCode) && byCode.length > 0) return [...byCode];

  const byRaw = parseBimUseTagsFromRaw(item.bim_use_id);
  if (byRaw.length > 0) return byRaw;

  return [];
}

export function formatBimUseDisplay(value: string | null | undefined): string {
  const cleaned = asNullableString(value);
  if (!cleaned || cleaned === NO_BIM_USE_ID) return NA_TEXT;
  const normalized = normalizeBimUseLabel(cleaned);
  return normalized || cleaned;
}

function toSafeErrorMessage(failure: SafeFetchFail): string {
  if (failure.kind === "backend_unavailable") {
    return "Backend not available";
  }
  if (failure.kind === "http_error") {
    const status = failure.status ? `HTTP ${failure.status}` : "HTTP error";
    return `${status}${failure.error ? ` - ${failure.error}` : ""}`;
  }
  return `Invalid backend payload${failure.error ? ` (${failure.error})` : ""}`;
}

function mergeMode(items: DataMode[]): DataMode {
  return items.includes("prototype") ? "prototype" : "backend";
}

function unwrapPayload(payload: unknown): { ok: true; data: unknown } | { ok: false; error: string } {
  if (payload && typeof payload === "object" && "ok" in payload) {
    const wrapped = payload as { ok?: boolean; error?: string; data?: unknown };
    if (wrapped.ok === false) return { ok: false, error: wrapped.error || "API returned ok=false" };
    return { ok: true, data: wrapped.data };
  }
  return { ok: true, data: payload };
}

function fallbackProject(projectId: string): ProjectRecord {
  const meta = getPrototypeProjectMetaFromStore(projectId);
  return {
    id: projectId,
    code: meta?.project_code || null,
    name: meta?.project_name || null,
    phase: null,
    is_active: null,
  };
}

function fallbackProjects(): ProjectRecord[] {
  return listPrototypeProjectIdsFromStore().map((projectId) => fallbackProject(projectId));
}

function fallbackPeriods(projectId: string): ScoringPeriod[] {
  const periodIds = listPrototypePeriodIdsByProjectFromStore(projectId);
  return periodIds.map((periodId) => {
    const meta = getPrototypePeriodMetaFromStore(projectId, periodId);
    const item: ScoringPeriod = {
      id: periodId,
      project_id: projectId,
      year: null,
      week: null,
      start_date: null,
      end_date: null,
      status: null,
      version: null,
    };
    const label = meta?.period_label || "";
    const match = label.match(/^(\d{4})\s+W(\d{1,2})$/i);
    if (match) {
      item.year = Number(match[1]);
      item.week = Number(match[2]);
    }
    return item;
  });
}

export function formatPeriodLabel(period: ScoringPeriod | null): string {
  if (!period) return NA_TEXT;
  const parts: string[] = [];

  const hasYearWeek = period.year !== null || period.week !== null;
  const hasRange = Boolean(period.start_date || period.end_date);

  // Prefer human-readable period identity. Hide raw UUID metadata from UI.
  if (!hasYearWeek && !hasRange) {
    return NA_TEXT;
  }

  if (period.year !== null || period.week !== null) {
    parts.push(`${period.year ?? NA_TEXT} W${period.week ?? NA_TEXT}`);
  }
  if (period.start_date || period.end_date) {
    parts.push(`${period.start_date ?? NA_TEXT} - ${period.end_date ?? NA_TEXT}`);
  }
  return parts.join(" | ");
}

export function formatProjectLabel(project: ProjectRecord | null): string {
  if (!project) return NA_TEXT;
  const name = asNullableString(project.name);
  const code = asNullableString(project.code);
  if (name && code) return `${name} - ${code}`;
  if (name) return name;
  if (code) return code;
  return project.id || NA_TEXT;
}

export async function fetchProjectsReadMode(): Promise<ReadResult<ProjectRecord[]>> {
  const response = await safeFetchJson<unknown>(buildApiUrl("/projects"));
  if (!response.ok) {
    return {
      data: fallbackProjects(),
      mode: "prototype",
      backend_message: toSafeErrorMessage(response),
    };
  }

  const unwrapped = unwrapPayload(response.data);
  if (!unwrapped.ok) {
    return {
      data: fallbackProjects(),
      mode: "prototype",
      backend_message: unwrapped.error,
    };
  }

  const rows = Array.isArray(unwrapped.data) ? unwrapped.data : [];
  const mapped = rows
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: asString(item.id || item.project_id),
        code: asNullableString(item.code || item.project_code),
        name: asNullableString(item.name || item.project_name),
        phase: asNullableString(item.phase),
        is_active: typeof item.is_active === "boolean" ? item.is_active : null,
      };
    })
    .filter((row) => row.id);

  for (const row of mapped) {
    rememberPrototypeProjectMetaInStore({
      project_id: row.id,
      project_name: row.name,
      project_code: row.code,
    });
  }

  return {
    data: mapped,
    mode: "backend",
    backend_message: null,
  };
}

export async function fetchProjects(): Promise<ProjectRecord[]> {
  const result = await fetchProjectsReadMode();
  return result.data;
}

export async function fetchProjectReadMode(projectId: string): Promise<ReadResult<ProjectRecord>> {
  const response = await safeFetchJson<unknown>(buildApiUrl(`/projects/${encodeURIComponent(projectId)}`));
  if (!response.ok) {
    return {
      data: fallbackProject(projectId),
      mode: "prototype",
      backend_message: toSafeErrorMessage(response),
    };
  }

  const unwrapped = unwrapPayload(response.data);
  if (!unwrapped.ok) {
    return {
      data: fallbackProject(projectId),
      mode: "prototype",
      backend_message: unwrapped.error,
    };
  }

  const row = (unwrapped.data ?? {}) as Record<string, unknown>;
  const project = {
    id: asString(row.id || row.project_id || projectId),
    code: asNullableString(row.code || row.project_code),
    name: asNullableString(row.name || row.project_name),
    phase: asNullableString(row.phase),
    is_active: typeof row.is_active === "boolean" ? row.is_active : null,
  };

  rememberPrototypeProjectMetaInStore({
    project_id: project.id,
    project_name: project.name,
    project_code: project.code,
  });

  return {
    data: project,
    mode: "backend",
    backend_message: null,
  };
}

export async function fetchProject(projectId: string): Promise<ProjectRecord> {
  const result = await fetchProjectReadMode(projectId);
  return result.data;
}

export async function fetchProjectPeriodsReadMode(projectId: string): Promise<ReadResult<ScoringPeriod[]>> {
  const response = await safeFetchJson<unknown>(
    buildApiUrl(`/projects/${encodeURIComponent(projectId)}/periods`)
  );
  if (!response.ok) {
    return {
      data: fallbackPeriods(projectId),
      mode: "prototype",
      backend_message: toSafeErrorMessage(response),
    };
  }

  const unwrapped = unwrapPayload(response.data);
  if (!unwrapped.ok) {
    return {
      data: fallbackPeriods(projectId),
      mode: "prototype",
      backend_message: unwrapped.error,
    };
  }

  const rows = Array.isArray(unwrapped.data) ? unwrapped.data : [];
  const mapped = rows
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: asString(item.id || item.period_id),
        project_id: asNullableString(item.project_id),
        year: asNumber(item.year),
        week: asNumber(item.week),
        start_date: asNullableString(item.start_date),
        end_date: asNullableString(item.end_date),
        status: resolvePeriodStatus(item),
        version: asNumber(item.version),
      } satisfies ScoringPeriod;
    })
    .filter((row) => row.id);

  for (const row of mapped) {
    const label = `${row.year ?? NA_TEXT} W${row.week ?? NA_TEXT}`;
    rememberPrototypePeriodMetaInStore({
      project_id: projectId,
      period_id: row.id,
      period_label: label,
    });
  }

  return {
    data: mapped,
    mode: "backend",
    backend_message: null,
  };
}

export async function fetchProjectPeriods(projectId: string): Promise<ScoringPeriod[]> {
  const result = await fetchProjectPeriodsReadMode(projectId);
  return result.data;
}

export async function fetchIndicatorsReadMode(projectId: string): Promise<ReadResult<IndicatorRecord[]>> {
  const candidates = [
    buildApiUrl(`/projects/${encodeURIComponent(projectId)}/indicators`),
    buildApiUrl(`/projects/${encodeURIComponent(projectId)}/indicator_definitions`),
    buildApiUrl(`/projects/${encodeURIComponent(projectId)}/indicator-definitions`),
  ];

  let lastFailure: SafeFetchFail | null = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const url = candidates[index];
    const response = await safeFetchJson<unknown>(url);
    if (!response.ok) {
      lastFailure = response;
      continue;
    }

    const unwrapped = unwrapPayload(response.data);
    if (!unwrapped.ok) {
      return {
        data: [],
        mode: "prototype",
        backend_message: unwrapped.error,
      };
    }

    const rows = Array.isArray(unwrapped.data) ? unwrapped.data : [];
    const mapped = rows
      .map((row) => {
        const item = row as Record<string, unknown>;
        const id = asString(item.id || item.indicator_id || item.project_indicator_id);
        const code = asString(item.code);
        const title = asString(item.title || item.name || item.indicator_title);
        const bimUseId = asNullableString(item.bim_use_id);
        const bimUseTags = resolveIndicatorBimUseTags({
          code,
          bim_use_id: bimUseId,
          bim_use_tags: item.bim_use_tags,
        });
        return {
          id,
          code,
          title,
          description: asNullableString(item.description),
          perspective_id: asNullableString(item.perspective_id || item.perspective),
          bim_use_id: bimUseTags[0] || bimUseId,
          bim_use_tags: bimUseTags,
        } satisfies IndicatorRecord;
      })
      .filter((row) => row.id && row.code && row.title);

    // Endpoint prioritas pertama bisa valid tetapi kosong pada project baru.
    // Dalam kasus itu, lanjut coba endpoint fallback agar BIM Use tetap tersedia.
    if (mapped.length === 0 && index < candidates.length - 1) {
      continue;
    }

    return {
      data: mapped,
      mode: "backend",
      backend_message: null,
    };
  }

  return {
    data: [],
    mode: "prototype",
    backend_message: lastFailure ? toSafeErrorMessage(lastFailure) : "Backend not available",
  };
}

export async function fetchIndicators(projectId: string): Promise<IndicatorRecord[]> {
  const result = await fetchIndicatorsReadMode(projectId);
  return result.data;
}

function inferEvidenceType(rawType: unknown, row: Record<string, unknown>): EvidenceType {
  const type = asString(rawType).trim().toUpperCase();
  if (type === "FILE" || type === "URL" || type === "TEXT") return type;
  if (asNullableString(row.text_content || row.text_note)) return "TEXT";
  if (asNullableString(row.external_url || row.url || row.uri)) return "URL";
  return "FILE";
}

function inferEvidenceStatus(rawStatus: unknown): EvidenceStatus {
  const value = asString(rawStatus).trim().toUpperCase();
  if (value === "NEEDS_REVISION" || value === "NEEDS REVISION") return "NEEDS_REVISION";
  if (value === "SUBMITTED" || value === "ACCEPTED" || value === "REJECTED") return "SUBMITTED";
  return "DRAFT";
}

function mapFlatEvidenceRows(
  rows: unknown[],
  params: { projectId: string; periodId: string | null }
): LocalEvidenceItem[] {
  return rows
    .map((row, index) => {
      const item = row as Record<string, unknown>;
      const id = asString(item.id || item.evidence_id).trim();
      if (!id) return null;

      const createdAt = asNullableString(item.created_at || item.uploaded_at) || new Date().toISOString();
      const updatedAt = asNullableString(item.updated_at || item.created_at || item.uploaded_at) || createdAt;
      const type = inferEvidenceType(item.type, item);
      const status = inferEvidenceStatus(item.status);
      const title = asString(item.title || item.name || id).trim();
      const description = asString(item.description || item.notes || "").trim();
      const url = asNullableString(item.external_url || item.url || item.uri);

      return {
        id,
        project_id: params.projectId,
        period_id: asNullableString(item.period_id) || params.periodId,
        bim_use_id: asString(item.bim_use_id || "").trim(),
        indicator_ids: Array.isArray(item.indicator_ids)
          ? item.indicator_ids.map((entry) => asString(entry)).filter(Boolean)
          : [],
        type,
        title: title || `Evidence ${index + 1}`,
        description,
        external_url: type === "URL" ? url : asNullableString(item.external_url),
        text_content: type === "TEXT" ? asNullableString(item.text_content || item.text_note) : null,
        file_view_url: type === "FILE" ? asNullableString(item.view_url || item.file_view_url) : null,
        file_download_url: type === "FILE" ? asNullableString(item.download_url || item.file_download_url) : null,
        file_reference_url: type === "FILE" ? url : null,
        status,
        review_reason: asNullableString(item.review_reason),
        review_decision: toBackendReviewOutcome(item.review_decision),
        reviewer_user_id: asNullableString(item.reviewer_user_id),
        reviewed_at: asNullableString(item.reviewed_at),
        version: asNumber(item.version),
        created_at: createdAt,
        updated_at: updatedAt,
        submitted_at: status === "SUBMITTED" ? updatedAt : null,
        storage_label: "Local draft (prototype, not used in scoring)",
      } satisfies LocalEvidenceItem;
    })
    .filter((row): row is LocalEvidenceItem => Boolean(row));
}

function mapIndicatorEvidencePayload(
  payload: unknown,
  params: { projectId: string; periodId: string | null }
): LocalEvidenceItem[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const rows = Array.isArray(root.data) ? root.data : [];
  const flattened = new Map<string, LocalEvidenceItem>();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const evidenceRows = Array.isArray((row as Record<string, unknown>).evidence)
      ? ((row as Record<string, unknown>).evidence as unknown[])
      : [];
    const normalized = mapFlatEvidenceRows(evidenceRows, params);
    for (const item of normalized) {
      if (flattened.has(item.id)) continue;
      flattened.set(item.id, item);
    }
  }

  return [...flattened.values()];
}

export async function fetchEvidenceListReadMode(
  projectId: string,
  periodId: string | null
): Promise<ReadResult<LocalEvidenceItem[]>> {
  const periodKey = normalizePrototypePeriodId(periodId);
  const localFallback = listLocalEvidence(projectId, periodKey);
  const query = periodKey ? `?period_id=${encodeURIComponent(periodKey)}` : "";
  const candidates = [
    buildApiUrl(`/periods/${encodeURIComponent(periodKey)}/evidences`),
    buildApiUrl(`/projects/${encodeURIComponent(projectId)}/periods/${encodeURIComponent(periodKey)}/evidence`),
    buildApiUrl(
      `/projects/${encodeURIComponent(projectId)}/periods/${encodeURIComponent(periodKey)}/indicator-evidence`
    ),
    buildApiUrl(`/projects/${encodeURIComponent(projectId)}/evidence${query}`),
    buildApiUrl(`/projects/${encodeURIComponent(projectId)}/evidence`),
  ];

  let lastFailure: SafeFetchFail | null = null;

  for (const url of candidates) {
    const response = await safeFetchJson<unknown>(url);
    if (!response.ok) {
      lastFailure = response;
      continue;
    }
    const unwrapped = unwrapPayload(response.data);
    if (!unwrapped.ok) {
      return {
        data: localFallback,
        mode: "prototype",
        backend_message: unwrapped.error,
      };
    }

    const payload = unwrapped.data;
    let mappedRows: LocalEvidenceItem[] = [];
    if (Array.isArray(payload)) {
      mappedRows = mapFlatEvidenceRows(payload, { projectId, periodId: periodKey });
    } else {
      mappedRows = mapIndicatorEvidencePayload(payload, { projectId, periodId: periodKey });
      if (mappedRows.length === 0) {
        const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
        const embeddedData = Array.isArray(root.data) ? root.data : [];
        mappedRows = mapFlatEvidenceRows(embeddedData, { projectId, periodId: periodKey });
      }
    }

    if (mappedRows.length === 0) continue;
    return {
      data: mappedRows.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))),
      mode: "backend",
      backend_message: null,
    };
  }

  return {
    data: localFallback,
    mode: "prototype",
    backend_message: lastFailure ? toSafeErrorMessage(lastFailure) : "Backend not available",
  };
}

function readAllEvidenceItems(): LocalEvidenceItem[] {
  return listPrototypeEvidenceItemsFromStore() as LocalEvidenceItem[];
}

function writeAllEvidenceItems(items: LocalEvidenceItem[]): void {
  savePrototypeEvidenceItemsToStore(items);
}

function readAllPrototypeReviews(): Record<string, PrototypeReviewRecord> {
  return listPrototypeReviewsMapFromStore() as Record<string, PrototypeReviewRecord>;
}

function toLocalEvidence(input: EvidenceDraftInput): LocalEvidenceItem {
  const now = new Date().toISOString();
  const id = input.id || crypto.randomUUID();
  const normalizedStatus = normalizeEvidenceStatus(input.status);

  return {
    id,
    project_id: input.project_id,
    period_id: input.period_id,
    bim_use_id: input.bim_use_id,
    indicator_ids: [...input.indicator_ids],
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    external_url: asNullableString(input.external_url),
    text_content: input.text_content?.trim() || null,
    file_view_url: asNullableString(input.file_view_url),
    file_download_url: asNullableString(input.file_download_url),
    file_reference_url: asNullableString(input.file_reference_url),
    status: normalizedStatus,
    review_reason: asNullableString(input.review_reason),
    review_decision: null,
    reviewer_user_id: null,
    reviewed_at: null,
    version: null,
    created_at: now,
    updated_at: now,
    submitted_at: normalizedStatus === "SUBMITTED" ? now : null,
    storage_label: "Local draft (prototype, not used in scoring)",
  };
}

export function listLocalEvidence(projectId: string, periodId: string | null): LocalEvidenceItem[] {
  const periodKey = normalizePrototypePeriodId(periodId);
  return readAllEvidenceItems()
    .filter((row) => row.project_id === projectId)
    .filter((row) => normalizePrototypePeriodId(row.period_id) === periodKey)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

export function listAllLocalEvidence(): LocalEvidenceItem[] {
  return readAllEvidenceItems().sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

export function getLocalEvidenceById(evidenceId: string): LocalEvidenceItem | null {
  const hit = readAllEvidenceItems().find((row) => row.id === evidenceId);
  return hit ?? null;
}

export function saveLocalEvidence(input: EvidenceDraftInput): LocalEvidenceItem {
  assertWritable(input.project_id, input.period_id);

  const all = readAllEvidenceItems();
  const existing = input.id ? all.find((row) => row.id === input.id) : null;
  const next = toLocalEvidence(input);

  if (existing) {
    next.created_at = existing.created_at;
    next.updated_at = new Date().toISOString();
    next.version = existing.version;
    next.review_decision = existing.review_decision;
    next.reviewer_user_id = existing.reviewer_user_id;
    next.reviewed_at = existing.reviewed_at;
    if (next.status === "SUBMITTED") next.submitted_at = next.updated_at;
    if (next.status === "DRAFT") {
      next.submitted_at = existing.submitted_at;
    }
  }

  const withoutExisting = all.filter((row) => row.id !== next.id);
  withoutExisting.push(next);
  writeAllEvidenceItems(withoutExisting);
  rememberPrototypePeriodMetaInStore({
    project_id: next.project_id,
    period_id: next.period_id,
    period_label: next.period_id,
  });
  return next;
}

type BackendEvidenceWriteResponse = {
  evidence_id: string;
  period_id: string | null;
  project_id: string | null;
  status: string | null;
  version: number | null;
  submitted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  type: string | null;
  title: string | null;
  uri: string | null;
  notes: string | null;
};

function toStoredEvidenceStatus(raw: unknown): EvidenceStatus {
  const value = asString(raw).trim().toUpperCase();
  if (value === "NEEDS_REVISION" || value === "NEEDS REVISION") return "NEEDS_REVISION";
  if (value === "SUBMITTED" || value === "ACCEPTED" || value === "REJECTED") return "SUBMITTED";
  return "DRAFT";
}

function toBackendReviewOutcome(raw: unknown): ReviewOutcome | null {
  const value = asString(raw).trim().toUpperCase();
  if (value === "ACCEPTABLE") return "ACCEPTABLE";
  if (value === "NEEDS_REVISION" || value === "NEEDS REVISION") return "NEEDS REVISION";
  if (value === "REJECTED") return "REJECTED";
  return null;
}

function requirePeriodId(periodId: string | null): string {
  const normalized = normalizePrototypePeriodId(periodId);
  if (!normalized || normalized === UNKNOWN_ACTIVE_PERIOD_KEY) {
    throw new Error("Period is Not available");
  }
  return normalized;
}

function resolveEvidenceUri(input: EvidenceDraftInput): string | null {
  if (input.type === "URL") return asNullableString(input.external_url);
  if (input.type === "FILE") {
    return (
      asNullableString(input.file_reference_url) ||
      asNullableString(input.file_view_url) ||
      asNullableString(input.file_download_url)
    );
  }
  return null;
}

function resolveEvidenceNotes(input: EvidenceDraftInput): string | null {
  if (input.type === "TEXT") {
    return asNullableString(input.text_content) || asNullableString(input.description);
  }
  return asNullableString(input.description);
}

function toDraftForWrite(input: EvidenceDraftInput): EvidenceDraftInput {
  return {
    ...input,
    status: "DRAFT",
  };
}

function upsertLocalEvidenceRecord(next: LocalEvidenceItem, removeIds: string[] = []): LocalEvidenceItem {
  const all = readAllEvidenceItems().filter((row) => row.id !== next.id && !removeIds.includes(row.id));
  all.push(next);
  writeAllEvidenceItems(all);
  rememberPrototypePeriodMetaInStore({
    project_id: next.project_id,
    period_id: next.period_id,
    period_label: next.period_id,
  });
  return next;
}

function syncLocalEvidenceFromBackend(params: {
  draft: EvidenceDraftInput;
  backend: BackendEvidenceWriteResponse;
  removeIds?: string[];
}): LocalEvidenceItem {
  const existing = params.draft.id ? getLocalEvidenceById(params.draft.id) : null;
  const evidenceId = asString(params.backend.evidence_id || params.draft.id || "").trim();
  const type = inferEvidenceType(params.backend.type, {}) as EvidenceType;
  const status = toStoredEvidenceStatus(params.backend.status);
  const now = new Date().toISOString();
  const notes = asNullableString(params.backend.notes);
  const uri = asNullableString(params.backend.uri);

  const next: LocalEvidenceItem = {
    id: evidenceId || (existing?.id || crypto.randomUUID()),
    project_id: asNullableString(params.backend.project_id) || params.draft.project_id,
    period_id: asNullableString(params.backend.period_id) || params.draft.period_id,
    bim_use_id: existing?.bim_use_id ?? params.draft.bim_use_id,
    indicator_ids: existing?.indicator_ids ?? [...params.draft.indicator_ids],
    type,
    title: asNullableString(params.backend.title) || params.draft.title.trim(),
    description: notes || params.draft.description.trim(),
    external_url:
      type === "URL" ? uri || asNullableString(params.draft.external_url) : asNullableString(params.draft.external_url),
    text_content:
      type === "TEXT" ? notes || asNullableString(params.draft.text_content) : asNullableString(params.draft.text_content),
    file_view_url: type === "FILE" ? asNullableString(params.draft.file_view_url) : null,
    file_download_url: type === "FILE" ? asNullableString(params.draft.file_download_url) : null,
    file_reference_url: type === "FILE" ? uri || asNullableString(params.draft.file_reference_url) : null,
    status,
    review_reason: existing?.review_reason ?? null,
    review_decision: existing?.review_decision ?? null,
    reviewer_user_id: existing?.reviewer_user_id ?? null,
    reviewed_at: existing?.reviewed_at ?? null,
    version: asNumber(params.backend.version) || existing?.version || null,
    created_at: asNullableString(params.backend.created_at) || existing?.created_at || now,
    updated_at: asNullableString(params.backend.updated_at) || now,
    submitted_at:
      asNullableString(params.backend.submitted_at) ||
      (status === "SUBMITTED" ? asNullableString(params.backend.updated_at) || now : null),
    storage_label: "Local draft (prototype, not used in scoring)",
  };

  return upsertLocalEvidenceRecord(next, params.removeIds || []);
}

function normalizeWriteError(error: unknown): Error {
  if (error instanceof BackendWriteError) {
    const issue = classifyBackendIssue(error);
    if (issue === "unavailable") {
      return new Error("Backend unavailable");
    }
    return new Error(`HTTP ${error.status ?? 500} ${error.code} - ${error.message}`);
  }
  if (error instanceof Error) return error;
  return new Error("Backend write failed");
}

async function createEvidenceToBackend(input: EvidenceDraftInput): Promise<BackendEvidenceWriteResponse> {
  const periodId = requirePeriodId(input.period_id);
  const payload = {
    period_id: periodId,
    indicator_ids: [...input.indicator_ids],
    type: input.type,
    title: input.title.trim(),
    uri: resolveEvidenceUri(input),
    notes: resolveEvidenceNotes(input),
  };
  return await callBackendWrite<BackendEvidenceWriteResponse>({
    path: `/periods/${encodeURIComponent(periodId)}/evidences`,
    method: "POST",
    actorRole: "role1",
    body: payload,
    idempotencyScope: "evidence-create",
    idempotencyPayload: payload,
  });
}

async function updateEvidenceToBackend(input: EvidenceDraftInput, ifMatchVersion: number): Promise<BackendEvidenceWriteResponse> {
  const periodId = requirePeriodId(input.period_id);
  const evidenceId = asString(input.id || "").trim();
  if (!evidenceId) throw new Error("Evidence id is required for update");

  const payload = {
    evidence_id: evidenceId,
    period_id: periodId,
    if_match_version: ifMatchVersion,
    indicator_ids: [...input.indicator_ids],
    type: input.type,
    title: input.title.trim(),
    uri: resolveEvidenceUri(input),
    notes: resolveEvidenceNotes(input),
  };
  return await callBackendWrite<BackendEvidenceWriteResponse>({
    path: `/periods/${encodeURIComponent(periodId)}/evidences/${encodeURIComponent(evidenceId)}`,
    method: "PUT",
    actorRole: "role1",
    body: payload,
    idempotencyScope: "evidence-update",
    idempotencyPayload: payload,
  });
}

async function submitEvidenceToBackend(params: {
  period_id: string | null;
  evidence_id: string;
  if_match_version: number;
}): Promise<BackendEvidenceWriteResponse> {
  const periodId = requirePeriodId(params.period_id);
  const payload = {
    period_id: periodId,
    evidence_id: params.evidence_id,
    if_match_version: params.if_match_version,
  };
  return await callBackendWrite<BackendEvidenceWriteResponse>({
    path: `/periods/${encodeURIComponent(periodId)}/evidences/${encodeURIComponent(params.evidence_id)}/submit`,
    method: "POST",
    actorRole: "role1",
    body: payload,
    idempotencyScope: "evidence-submit",
    idempotencyPayload: payload,
  });
}

export async function saveEvidenceWithBackendWrite(input: EvidenceDraftInput): Promise<LocalEvidenceItem> {
  if (!FEATURE_REAL_BACKEND_WRITE) {
    return saveLocalEvidence(input);
  }

  try {
    const localExisting = input.id ? getLocalEvidenceById(input.id) : null;
    const localVersion = asNumber(localExisting?.version);
    const canUpdateDraft = Boolean(localExisting && localExisting.status === "DRAFT" && localVersion !== null);
    const draftInput = toDraftForWrite(input);

    const writtenDraft = canUpdateDraft
      ? await updateEvidenceToBackend(draftInput, localVersion as number)
      : await createEvidenceToBackend(draftInput);

    return syncLocalEvidenceFromBackend({
      draft: input,
      backend: writtenDraft,
      removeIds:
        input.id && input.id !== writtenDraft.evidence_id && localExisting?.status === "DRAFT"
          ? [input.id]
          : [],
    });
  } catch (error) {
    throw normalizeWriteError(error);
  }
}

export async function submitEvidenceWithBackendWrite(input: EvidenceDraftInput): Promise<LocalEvidenceItem> {
  if (!FEATURE_REAL_BACKEND_WRITE) {
    return saveLocalEvidence({
      ...input,
      status: "SUBMITTED",
    });
  }

  try {
    const localExisting = input.id ? getLocalEvidenceById(input.id) : null;
    const localVersion = asNumber(localExisting?.version);
    const canUpdateDraft = Boolean(localExisting && localExisting.status === "DRAFT" && localVersion !== null);
    const draftInput = toDraftForWrite(input);

    const draftWrite = canUpdateDraft
      ? await updateEvidenceToBackend(draftInput, localVersion as number)
      : await createEvidenceToBackend(draftInput);

    const draftSynced = syncLocalEvidenceFromBackend({
      draft: input,
      backend: draftWrite,
      removeIds:
        input.id && input.id !== draftWrite.evidence_id && localExisting?.status === "DRAFT"
          ? [input.id]
          : [],
    });
    const submitVersion = asNumber(draftWrite.version);
    if (submitVersion === null) {
      throw new Error("Evidence version is required for submit");
    }

    const submitted = await submitEvidenceToBackend({
      period_id: draftSynced.period_id,
      evidence_id: draftSynced.id,
      if_match_version: submitVersion,
    });

    return syncLocalEvidenceFromBackend({
      draft: {
        ...input,
        id: draftSynced.id,
      },
      backend: submitted,
    });
  } catch (error) {
    throw normalizeWriteError(error);
  }
}

export function syncReviewedEvidenceFromBackend(input: {
  evidence_id: string;
  decision: string;
  reason: string;
  reviewed_at: string;
  reviewer_user_id: string;
  status: string;
  version: number;
}): LocalEvidenceItem | null {
  const evidence = getLocalEvidenceById(input.evidence_id);
  if (!evidence) return null;

  const nextStatus = toStoredEvidenceStatus(input.status);
  const updated: LocalEvidenceItem = {
    ...evidence,
    status: nextStatus,
    review_reason: asNullableString(input.reason),
    review_decision: toBackendReviewOutcome(input.decision),
    reviewer_user_id: asNullableString(input.reviewer_user_id),
    reviewed_at: asNullableString(input.reviewed_at),
    version: asNumber(input.version),
    updated_at: asNullableString(input.reviewed_at) || new Date().toISOString(),
  };
  upsertLocalEvidenceRecord(updated);

  const outcome = toBackendReviewOutcome(input.decision);
  if (outcome) {
    upsertPrototypeReviewRecordInStore({
      evidence_id: evidence.id,
      scope_key: buildPrototypeScopeKey(evidence.project_id, evidence.period_id),
      review_outcome: outcome,
      review_reason: asNullableString(input.reason) || "",
      reviewed_by: input.reviewer_user_id || "HO Reviewer",
      reviewed_at: asNullableString(input.reviewed_at) || new Date().toISOString(),
      review_history: [
        ...(getPrototypeReview(evidence.id, evidence.project_id, evidence.period_id)?.review_history || []),
        {
          review_outcome: outcome,
          review_reason: asNullableString(input.reason) || "",
          reviewed_by: input.reviewer_user_id || "HO Reviewer",
          reviewed_at: asNullableString(input.reviewed_at) || new Date().toISOString(),
        },
      ],
    });
  }

  return updated;
}

export function markEvidenceAsDraft(evidenceId: string): LocalEvidenceItem | null {
  const all = readAllEvidenceItems();
  const hit = all.find((row) => row.id === evidenceId);
  if (!hit) return null;
  assertWritable(hit.project_id, hit.period_id);

  hit.status = "DRAFT";
  hit.updated_at = new Date().toISOString();
  hit.review_decision = null;
  hit.review_reason = null;
  hit.reviewer_user_id = null;
  hit.reviewed_at = null;
  writeAllEvidenceItems(all);
  return hit;
}

type CountableEvidence = {
  status: EvidenceStatus;
  effective_status?: EvidenceLifecycleStatus;
};

export function buildEvidenceCounts(items: CountableEvidence[]): Record<EvidenceStatus, number> {
  const counter: Record<EvidenceStatus, number> = {
    DRAFT: 0,
    SUBMITTED: 0,
    NEEDS_REVISION: 0,
  };

  for (const item of items) {
    const key = item.effective_status || item.status;
    if (key === "DRAFT" || key === "SUBMITTED" || key === "NEEDS_REVISION") {
      counter[key] += 1;
      continue;
    }
    // ACCEPTABLE/REJECTED remain submitted for Role 1 task counters.
    counter.SUBMITTED += 1;
  }

  return counter;
}

export function statusLabel(status: EvidenceStatus): string {
  if (status === "DRAFT") return "Draft";
  if (status === "SUBMITTED") return "Submitted";
  return "Needs Revision";
}

export function resolvePeriodLock(status: PeriodStatus | null): boolean {
  return status === "LOCKED";
}

export function selectActivePeriod(periods: ScoringPeriod[]): ScoringPeriod | null {
  if (!Array.isArray(periods) || periods.length === 0) return null;
  const openPeriod = periods.find((period) => period?.status === "OPEN");
  return openPeriod || periods[0] || null;
}

function toTimestamp(value: string | null): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function deriveEffectiveStatus(
  item: LocalEvidenceItem,
  review: PrototypeReviewRecord | null
): EvidenceLifecycleStatus {
  const reviewDecision = review?.review_outcome || item.review_decision;
  const reviewTimestamp = review?.reviewed_at || item.reviewed_at;
  if (item.status !== "SUBMITTED") return item.status;
  if (!reviewDecision || !reviewTimestamp) return item.status;

  const submittedAt = toTimestamp(item.submitted_at || item.updated_at);
  const reviewedAt = toTimestamp(reviewTimestamp);

  if (submittedAt > reviewedAt) return "SUBMITTED";
  const normalizedOutcome = normalizeReviewOutcome(reviewDecision);
  if (!normalizedOutcome) return "SUBMITTED";
  return reviewOutcomeToEvidenceStatus(normalizedOutcome);
}

function mergeEvidenceWithReview(item: LocalEvidenceItem): LocalEvidenceWithReview {
  const review = getPrototypeReview(item.id, item.project_id, item.period_id);
  const mergedReviewOutcome = review?.review_outcome ?? item.review_decision ?? null;
  const mergedReviewReason = review?.review_reason ?? item.review_reason ?? null;
  const mergedReviewedAt = review?.reviewed_at ?? item.reviewed_at ?? null;
  const mergedReviewer = review?.reviewed_by ?? item.reviewer_user_id ?? null;
  return {
    ...item,
    effective_status: deriveEffectiveStatus(item, review),
    latest_review_outcome: mergedReviewOutcome,
    latest_review_reason: mergedReviewReason,
    reviewed_by: mergedReviewer,
    reviewed_at: mergedReviewedAt,
    review_history: review?.review_history ?? [],
  };
}

export function listLocalEvidenceWithReview(projectId: string, periodId: string | null): LocalEvidenceWithReview[] {
  return listLocalEvidence(projectId, periodId).map(mergeEvidenceWithReview);
}

export function listAllLocalEvidenceWithReview(): LocalEvidenceWithReview[] {
  return listAllLocalEvidence().map(mergeEvidenceWithReview);
}

export function mapEvidenceRowsWithReview(rows: LocalEvidenceItem[]): LocalEvidenceWithReview[] {
  return rows.map(mergeEvidenceWithReview);
}

export function getLocalEvidenceWithReviewById(evidenceId: string): LocalEvidenceWithReview | null {
  const hit = getLocalEvidenceById(evidenceId);
  if (!hit) return null;
  return mergeEvidenceWithReview(hit);
}

export function getPrototypeReview(
  evidenceId: string,
  projectId?: string | null,
  periodId?: string | null
): PrototypeReviewRecord | null {
  const all = readAllPrototypeReviews();
  const hit = all[evidenceId];
  if (!hit) return null;
  if (!projectId) return hit;
  const scopeKey = buildPrototypeScopeKey(projectId, periodId ?? null);
  return hit.scope_key === scopeKey ? hit : null;
}

export function applyPrototypeReview(input: {
  evidence_id: string;
  review_outcome: ReviewOutcome;
  review_reason: string;
  reviewed_by?: string;
}): PrototypeReviewRecord {
  const reviewedBy = input.reviewed_by?.trim() || "HO Reviewer (Prototype)";
  const reviewReason = input.review_reason.trim();
  const normalizedOutcome = normalizeReviewOutcome(input.review_outcome);
  if (!reviewReason) {
    throw new Error("Reason wajib diisi.");
  }
  if (!normalizedOutcome) {
    throw new Error("Outcome tidak valid.");
  }

  const evidence = getLocalEvidenceById(input.evidence_id);
  if (!evidence) {
    throw new Error("Evidence context not found.");
  }

  assertWritable(evidence.project_id, evidence.period_id);

  const reviewedAt = new Date().toISOString();

  const all = readAllPrototypeReviews();
  const existing = all[input.evidence_id];
  const history = Array.isArray(existing?.review_history) ? [...existing.review_history] : [];

  history.push({
    review_outcome: normalizedOutcome,
    review_reason: reviewReason,
    reviewed_by: reviewedBy,
    reviewed_at: reviewedAt,
  });

  const next: PrototypeReviewRecord = {
    evidence_id: input.evidence_id,
    scope_key: buildPrototypeScopeKey(evidence.project_id, evidence.period_id),
    review_outcome: normalizedOutcome,
    review_reason: reviewReason,
    reviewed_by: reviewedBy,
    reviewed_at: reviewedAt,
    review_history: history,
  };

  all[input.evidence_id] = next;
  const evidenceRows = readAllEvidenceItems();
  const evidenceIndex = evidenceRows.findIndex((row) => row.id === input.evidence_id);
  if (evidenceIndex >= 0) {
    evidenceRows[evidenceIndex] = {
      ...evidenceRows[evidenceIndex],
      status: normalizedOutcome === "NEEDS REVISION" ? "NEEDS_REVISION" : "SUBMITTED",
      review_reason: reviewReason,
      review_decision: normalizedOutcome,
      reviewer_user_id: reviewedBy,
      reviewed_at: reviewedAt,
      updated_at: reviewedAt,
    };
    writeAllEvidenceItems(evidenceRows);
  }
  upsertPrototypeReviewRecordInStore({
    evidence_id: next.evidence_id,
    scope_key: buildPrototypeScopeKey(evidence.project_id, evidence.period_id),
    review_outcome: next.review_outcome,
    review_reason: next.review_reason,
    reviewed_by: next.reviewed_by,
    reviewed_at: next.reviewed_at,
    review_history: next.review_history,
  });
  return next;
}

function getRelevantReviewedAt(item: LocalEvidenceItem, review: PrototypeReviewRecord | null): number {
  if (!review) return 0;
  const submittedAt = toTimestamp(item.submitted_at || item.updated_at);
  const reviewedAt = toTimestamp(review.reviewed_at);
  if (submittedAt > reviewedAt) return 0;
  return reviewedAt;
}

export function getEffectiveReviewOutcome(item: LocalEvidenceItem): ReviewOutcome | null {
  if (item.status !== "SUBMITTED") return null;
  const review = getPrototypeReview(item.id, item.project_id, item.period_id);
  if (review) {
    if (!getRelevantReviewedAt(item, review)) return null;
    return review.review_outcome;
  }

  const normalized = normalizeReviewOutcome(item.review_decision);
  if (!normalized) return null;
  const submittedAt = toTimestamp(item.submitted_at || item.updated_at);
  const reviewedAt = toTimestamp(item.reviewed_at);
  if (!reviewedAt || submittedAt > reviewedAt) return null;
  return normalized;
}

export function buildReviewStatusCounts(items: LocalEvidenceItem[]): ReviewStatusCount {
  const counter: ReviewStatusCount = {
    ACCEPTABLE: 0,
    NEEDS_REVISION: 0,
    REJECTED: 0,
    AWAITING_REVIEW: 0,
  };

  for (const item of items) {
    if (item.status === "NEEDS_REVISION") {
      counter.NEEDS_REVISION += 1;
      continue;
    }
    if (item.status !== "SUBMITTED") continue;
    const outcome = getEffectiveReviewOutcome(item);
    if (!outcome) {
      counter.AWAITING_REVIEW += 1;
      continue;
    }
    if (outcome === "ACCEPTABLE") counter.ACCEPTABLE += 1;
    if (outcome === "NEEDS REVISION") counter.NEEDS_REVISION += 1;
    if (outcome === "REJECTED") counter.REJECTED += 1;
  }

  return counter;
}

export function listPrototypePeriodLocks(): PrototypePeriodLockRecord[] {
  return listPrototypePeriodLocksFromStore() as PrototypePeriodLockRecord[];
}

export function listPrototypeApprovalDecisions(): PrototypeApprovalDecisionRecord[] {
  return listPrototypeApprovalDecisionsFromStore() as PrototypeApprovalDecisionRecord[];
}

export function listPrototypeSnapshots(): PrototypeSnapshotRecord[] {
  return listPrototypeSnapshotsFromStore() as PrototypeSnapshotRecord[];
}

export function getPrototypePeriodLock(projectId: string, periodId: string | null): PrototypePeriodLockRecord | null {
  return getPrototypePeriodLockFromStore(projectId, periodId) as PrototypePeriodLockRecord | null;
}

export function isPeriodLockedByPrototype(projectId: string, periodId: string | null): boolean {
  const normalized = normalizePrototypePeriodId(periodId);
  if (!normalized || normalized === UNKNOWN_ACTIVE_PERIOD_KEY) return false;
  return Boolean(getPrototypePeriodLock(projectId, periodId));
}

export function assertWritable(projectId: string, periodId: string | null): void {
  if (isPeriodLockedByPrototype(projectId, periodId)) {
    throw new Error(LOCKED_READ_ONLY_ERROR);
  }
}

export function resolvePeriodLockWithPrototype(
  projectId: string,
  periodId: string | null,
  backendStatus: PeriodStatus | null
): boolean {
  if (resolvePeriodLock(backendStatus)) return true;
  const normalized = normalizePrototypePeriodId(periodId);
  if (!normalized || normalized === UNKNOWN_ACTIVE_PERIOD_KEY) return false;
  return isPeriodLockedByPrototype(projectId, periodId);
}

export function resolvePeriodStatusLabelWithPrototype(
  projectId: string,
  periodId: string | null,
  backendStatus: PeriodStatus | null
): string {
  const locked = resolvePeriodLockWithPrototype(projectId, periodId, backendStatus);
  if (locked) return "LOCKED";
  if (backendStatus) return backendStatus;

  const byStore = getPrototypePeriodStatusFromStore(projectId, periodId);
  if (byStore) return byStore;

  return NA_TEXT;
}

export function appendPrototypeApprovalDecision(input: {
  project_id: string;
  period_id: string | null;
  decision: ApprovalDecision;
  reason: string;
  decided_by?: string;
}): PrototypeApprovalDecisionRecord {
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("Reason wajib diisi.");
  }

  assertWritable(input.project_id, input.period_id);

  const entry: PrototypeApprovalDecisionRecord = {
    project_id: input.project_id,
    period_id: normalizePrototypePeriodId(input.period_id),
    scope_key: buildPrototypeScopeKey(input.project_id, input.period_id),
    decision: input.decision,
    reason,
    decided_by: input.decided_by?.trim() || "Approver (Prototype)",
    decided_at: new Date().toISOString(),
  };
  appendPrototypeApprovalDecisionToStore(entry);
  rememberPrototypePeriodMetaInStore({
    project_id: entry.project_id,
    period_id: entry.period_id,
    period_label: entry.period_id,
  });
  return entry;
}

export function appendPrototypeSnapshot(input: {
  project_id: string;
  period_id: string | null;
  approved_by?: string;
  approved_at?: string;
  snapshot_id?: string;
  final_bim_score: number | null;
  breakdown: Array<{ perspective_id: string; score: number | null }>;
  evidence_counts: ReviewStatusCount;
}): PrototypeSnapshotRecord {
  const entry: PrototypeSnapshotRecord = {
    snapshot_id: input.snapshot_id || crypto.randomUUID(),
    project_id: input.project_id,
    period_id: normalizePrototypePeriodId(input.period_id),
    scope_key: buildPrototypeScopeKey(input.project_id, input.period_id),
    approved_by: input.approved_by?.trim() || "Approver (Prototype)",
    approved_at: input.approved_at || new Date().toISOString(),
    final_bim_score: input.final_bim_score,
    breakdown: [...input.breakdown],
    evidence_counts: input.evidence_counts,
    note: "Prototype snapshot (not used for audit/compliance)",
  };
  appendPrototypeSnapshotToStore(entry);
  rememberPrototypePeriodMetaInStore({
    project_id: entry.project_id,
    period_id: entry.period_id,
    period_label: entry.period_id,
  });
  return entry;
}

export function setPrototypePeriodLock(input: {
  project_id: string;
  period_id: string | null;
  locked_by?: string;
}): PrototypePeriodLockRecord {
  const key = normalizePrototypePeriodId(input.period_id);
  const existing = getPrototypePeriodLock(input.project_id, key);
  if (existing) return existing;

  const entry: PrototypePeriodLockRecord = {
    project_id: input.project_id,
    period_id: key,
    scope_key: buildPrototypeScopeKey(input.project_id, key),
    status: "LOCKED",
    locked_by: input.locked_by?.trim() || "Approver (Prototype)",
    locked_at: new Date().toISOString(),
  };
  upsertPrototypePeriodLockInStore(entry);
  rememberPrototypePeriodMetaInStore({
    project_id: entry.project_id,
    period_id: entry.period_id,
    period_label: entry.period_id,
  });
  return entry;
}

function buildBimUseLabel(value: string, items: IndicatorRecord[]): string {
  const cleaned = String(value || "").trim();
  if (cleaned === NO_BIM_USE_ID) return NA_TEXT;
  if (cleaned) return cleaned;
  if (!items.length) return NA_TEXT;
  const perspective = items[0].perspective_id || "";
  return perspective ? `BIM Use (${perspective})` : NA_TEXT;
}

export function groupIndicatorsByBimUse(items: IndicatorRecord[]): BimUseGroup[] {
  const grouped = new Map<string, Map<string, IndicatorRecord>>();
  const normalizedItems = items.map((item) => {
    const tags = uniqueStrings(
      (Array.isArray(item.bim_use_tags) ? item.bim_use_tags : [])
        .map((tag) => normalizeBimUseLabel(tag || ""))
        .filter((tag): tag is string => Boolean(tag))
    );
    return {
      ...item,
      bim_use_tags: tags,
    };
  });

  const concreteBimUses = new Set<string>();
  for (const item of normalizedItems) {
    for (const tag of item.bim_use_tags) {
      if (tag !== BIM_USE_ALL) concreteBimUses.add(tag);
    }
  }

  const addToGroup = (key: string, item: IndicatorRecord) => {
    if (!grouped.has(key)) grouped.set(key, new Map<string, IndicatorRecord>());
    const byId = grouped.get(key) as Map<string, IndicatorRecord>;
    byId.set(item.id, item);
  };

  const hasAnyAllTag = normalizedItems.some((item) => item.bim_use_tags.includes(BIM_USE_ALL));
  if (concreteBimUses.size === 0 && hasAnyAllTag) {
    concreteBimUses.add(BIM_USE_ALL);
  }

  for (const item of normalizedItems) {
    const tags = item.bim_use_tags;
    if (tags.length === 0) {
      const fallbackRaw = asNullableString(item.bim_use_id);
      const fallbackNormalized = fallbackRaw ? normalizeBimUseLabel(fallbackRaw) : null;
      if (fallbackNormalized && fallbackNormalized !== NO_BIM_USE_ID && !isUuidLike(fallbackNormalized)) {
        addToGroup(fallbackNormalized, item);
      } else {
        addToGroup(NO_BIM_USE_ID, item);
      }
      continue;
    }

    const nonAllTags = tags.filter((tag) => tag !== BIM_USE_ALL);
    for (const tag of nonAllTags) {
      addToGroup(tag, item);
    }

    if (tags.includes(BIM_USE_ALL)) {
      if (concreteBimUses.size > 0) {
        for (const tag of concreteBimUses) {
          addToGroup(tag, item);
        }
      } else {
        addToGroup(BIM_USE_ALL, item);
      }
    }
  }

  return [...grouped.entries()]
    .map(([bimUseId, byId]) => {
      const rows = [...byId.values()];
      const sortedIndicators = rows.sort((a, b) => a.code.localeCompare(b.code));
      const label = buildBimUseLabel(bimUseId === NO_BIM_USE_ID ? "" : bimUseId, sortedIndicators);
      return {
        bim_use_id: bimUseId,
        label,
        indicators: sortedIndicators,
      } satisfies BimUseGroup;
    })
    .sort((a, b) => {
      if (a.bim_use_id === BIM_USE_ALL && b.bim_use_id !== BIM_USE_ALL) return -1;
      if (b.bim_use_id === BIM_USE_ALL && a.bim_use_id !== BIM_USE_ALL) return 1;
      if (a.bim_use_id === NO_BIM_USE_ID && b.bim_use_id !== NO_BIM_USE_ID) return 1;
      if (b.bim_use_id === NO_BIM_USE_ID && a.bim_use_id !== NO_BIM_USE_ID) return -1;
      return a.label.localeCompare(b.label);
    });
}

export async function fetchRole1Context(projectId: string): Promise<Role1Context> {
  const [projectResult, periodsResult, indicatorsResult] = await Promise.all([
    fetchProjectReadMode(projectId),
    fetchProjectPeriodsReadMode(projectId),
    fetchIndicatorsReadMode(projectId),
  ]);

  const project = projectResult.data;
  let periods = periodsResult.data;
  const indicators = indicatorsResult.data;

  if (periods.length === 0) {
    periods = fallbackPeriods(projectId);
  }

  const activePeriod = selectActivePeriod(periods);
  const periodStatus = activePeriod?.status ?? null;
  const periodStatusLabel = resolvePeriodStatusLabelWithPrototype(projectId, activePeriod?.id ?? null, periodStatus);
  const periodLocked = resolvePeriodLockWithPrototype(projectId, activePeriod?.id ?? null, periodStatus);
  const bimUses = groupIndicatorsByBimUse(indicators);
  const dataMode = mergeMode([projectResult.mode, periodsResult.mode, indicatorsResult.mode]);
  const backendMessage = [projectResult, periodsResult, indicatorsResult]
    .map((row) => row.backend_message)
    .find((text) => Boolean(text)) || null;

  return {
    project,
    periods,
    active_period: activePeriod,
    period_status_label: periodStatusLabel,
    period_locked: periodLocked,
    indicators,
    bim_uses: bimUses,
    data_mode: dataMode,
    backend_message: backendMessage,
  };
}
