import {
  buildPrototypeScopeKey,
  normalizeEvidenceStatus,
  UNKNOWN_ACTIVE_PERIOD_KEY,
  normalizePeriodKey,
  normalizeReviewOutcome,
} from "@/lib/statusModel";

const TRUTH_STORE_KEY = "bim:prototype:truth:v1";
const LEGACY_EVIDENCE_KEY = "bim:role1:evidence:v1";
const LEGACY_REVIEW_KEY = "bim:role2:reviews:v1";
const LEGACY_LOCK_KEY = "bim:role3:period-locks:v1";
const LEGACY_DECISION_KEY = "bim:role3:approval-decisions:v1";
const LEGACY_SNAPSHOT_KEY = "bim:role3:snapshots:v1";

type StoreEvidenceStatus = "DRAFT" | "SUBMITTED" | "NEEDS_REVISION";
type StoreEvidenceType = "FILE" | "URL" | "TEXT";
type StoreReviewOutcome = "ACCEPTABLE" | "NEEDS REVISION" | "REJECTED";
type StoreApprovalDecision = "APPROVE PERIOD" | "REJECT APPROVAL";

type StoreEvidenceItem = {
  id: string;
  project_id: string;
  period_id: string | null;
  scope_key: string;
  bim_use_id: string;
  indicator_ids: string[];
  type: StoreEvidenceType;
  title: string;
  description: string;
  external_url: string | null;
  text_content: string | null;
  file_view_url: string | null;
  file_download_url: string | null;
  file_reference_url: string | null;
  status: StoreEvidenceStatus;
  review_reason: string | null;
  review_decision: StoreReviewOutcome | null;
  reviewer_user_id: string | null;
  reviewed_at: string | null;
  version: number | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  storage_label: "Local draft (prototype, not used in scoring)";
};

type StoreReviewHistoryEntry = {
  review_outcome: StoreReviewOutcome;
  review_reason: string;
  reviewed_by: string;
  reviewed_at: string;
};

type StoreReviewRecord = {
  evidence_id: string;
  scope_key: string;
  review_outcome: StoreReviewOutcome;
  review_reason: string;
  reviewed_by: string;
  reviewed_at: string;
  review_history: StoreReviewHistoryEntry[];
};

type StoreReviewStatusCount = {
  ACCEPTABLE: number;
  NEEDS_REVISION: number;
  REJECTED: number;
  AWAITING_REVIEW: number;
};

type StorePeriodLockRecord = {
  project_id: string;
  period_id: string;
  scope_key: string;
  status: "LOCKED";
  locked_by: string;
  locked_at: string;
};

type StoreApprovalDecisionRecord = {
  project_id: string;
  period_id: string;
  scope_key: string;
  decision: StoreApprovalDecision;
  reason: string;
  decided_by: string;
  decided_at: string;
};

type StoreSnapshotRecord = {
  snapshot_id?: string;
  project_id: string;
  period_id: string;
  scope_key: string;
  approved_by: string;
  approved_at: string;
  final_bim_score: number | null;
  breakdown: Array<{ perspective_id: string; score: number | null }>;
  evidence_counts: StoreReviewStatusCount;
  note: "Prototype snapshot (not used for audit/compliance)";
};

type StoreProjectMeta = {
  project_id: string;
  project_name: string | null;
  project_code: string | null;
  week_anchor: string | null;
  updated_at: string;
};

type StorePeriodMeta = {
  project_id: string;
  period_id: string;
  scope_key: string;
  period_label: string | null;
  updated_at: string;
};

type PrototypeTruthStore = {
  version: 1;
  evidence_items: StoreEvidenceItem[];
  review_records: Record<string, StoreReviewRecord>;
  approval_decisions: StoreApprovalDecisionRecord[];
  snapshots: StoreSnapshotRecord[];
  period_locks: StorePeriodLockRecord[];
  project_meta: Record<string, StoreProjectMeta>;
  period_meta: Record<string, StorePeriodMeta>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  const text = asString(value).trim();
  return text || null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function readRawStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeRawStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizePeriodId(value: string | null | undefined): string {
  return normalizePeriodKey(value);
}

function createEmptyStore(): PrototypeTruthStore {
  return {
    version: 1,
    evidence_items: [],
    review_records: {},
    approval_decisions: [],
    snapshots: [],
    period_locks: [],
    project_meta: {},
    period_meta: {},
  };
}

function normalizeEvidenceRow(row: unknown): StoreEvidenceItem | null {
  if (!isObject(row)) return null;
  const id = asString(row.id).trim();
  const projectId = asString(row.project_id).trim();
  if (!id || !projectId) return null;

  const periodId = asNullableString(row.period_id);
  const status = normalizeEvidenceStatus(row.status);

  const typeValue = asString(row.type).trim();
  const type: StoreEvidenceType =
    typeValue === "URL" || typeValue === "TEXT" ? typeValue : "FILE";

  return {
    id,
    project_id: projectId,
    period_id: periodId,
    scope_key: buildPrototypeScopeKey(projectId, periodId),
    bim_use_id: asString(row.bim_use_id).trim(),
    indicator_ids: parseArray<string>(row.indicator_ids).map((idItem) => asString(idItem)).filter(Boolean),
    type,
    title: asString(row.title),
    description: asString(row.description),
    external_url: asNullableString(row.external_url),
    text_content: asNullableString(row.text_content),
    file_view_url: asNullableString(row.file_view_url),
    file_download_url: asNullableString(row.file_download_url),
    file_reference_url: asNullableString(row.file_reference_url),
    status,
    review_reason: asNullableString(row.review_reason),
    review_decision: normalizeReviewOutcome(row.review_decision),
    reviewer_user_id: asNullableString(row.reviewer_user_id),
    reviewed_at: asNullableString(row.reviewed_at),
    version: asFiniteNumber(row.version),
    created_at: asString(row.created_at) || new Date().toISOString(),
    updated_at: asString(row.updated_at) || new Date().toISOString(),
    submitted_at: asNullableString(row.submitted_at),
    storage_label: "Local draft (prototype, not used in scoring)",
  };
}

function normalizeReviewHistoryEntry(row: unknown): StoreReviewHistoryEntry | null {
  if (!isObject(row)) return null;
  const reviewedAt = asString(row.reviewed_at);
  const reviewedBy = asString(row.reviewed_by).trim();
  const reason = asString(row.review_reason).trim();
  const outcome = normalizeReviewOutcome(row.review_outcome);
  if (!reviewedAt || !reviewedBy || !reason) return null;
  if (!outcome) return null;

  return {
    review_outcome: outcome,
    review_reason: reason,
    reviewed_by: reviewedBy,
    reviewed_at: reviewedAt,
  };
}

function normalizeReviewRecord(row: unknown): StoreReviewRecord | null {
  if (!isObject(row)) return null;
  const evidenceId = asString(row.evidence_id).trim();
  if (!evidenceId) return null;
  const explicitScope = asString(row.scope_key).trim() || null;

  const history = parseArray<unknown>(row.review_history)
    .map((entry) => normalizeReviewHistoryEntry(entry))
    .filter((entry): entry is StoreReviewHistoryEntry => Boolean(entry))
    .sort((a, b) => a.reviewed_at.localeCompare(b.reviewed_at));

  const latest = history[history.length - 1];
  const fallbackOutcome = normalizeReviewOutcome(row.review_outcome);
  const fallbackReason = asString(row.review_reason).trim();
  const fallbackReviewer = asString(row.reviewed_by).trim();
  const fallbackReviewedAt = asString(row.reviewed_at);

  if (!latest) {
    if (
      !fallbackOutcome ||
      !fallbackReason ||
      !fallbackReviewer ||
      !fallbackReviewedAt
    ) {
      return null;
    }

    return {
      evidence_id: evidenceId,
      scope_key: explicitScope || "",
      review_outcome: fallbackOutcome,
      review_reason: fallbackReason,
      reviewed_by: fallbackReviewer,
      reviewed_at: fallbackReviewedAt,
      review_history: [
        {
          review_outcome: fallbackOutcome,
          review_reason: fallbackReason,
          reviewed_by: fallbackReviewer,
          reviewed_at: fallbackReviewedAt,
        },
      ],
    };
  }

  return {
    evidence_id: evidenceId,
    scope_key: explicitScope || "",
    review_outcome: latest.review_outcome,
    review_reason: latest.review_reason,
    reviewed_by: latest.reviewed_by,
    reviewed_at: latest.reviewed_at,
    review_history: history,
  };
}

function normalizeDecisionRecord(row: unknown): StoreApprovalDecisionRecord | null {
  if (!isObject(row)) return null;
  const projectId = asString(row.project_id).trim();
  const periodId = normalizePeriodId(asNullableString(row.period_id));
  const decision = asString(row.decision).trim();
  const reason = asString(row.reason).trim();
  const decidedBy = asString(row.decided_by).trim();
  const decidedAt = asString(row.decided_at);
  if (!projectId || !reason || !decidedBy || !decidedAt) return null;
  if (decision !== "APPROVE PERIOD" && decision !== "REJECT APPROVAL") return null;

  return {
    project_id: projectId,
    period_id: periodId,
    scope_key: buildPrototypeScopeKey(projectId, periodId),
    decision,
    reason,
    decided_by: decidedBy,
    decided_at: decidedAt,
  };
}

function normalizeLockRecord(row: unknown): StorePeriodLockRecord | null {
  if (!isObject(row)) return null;
  const projectId = asString(row.project_id).trim();
  const periodId = normalizePeriodId(asNullableString(row.period_id));
  const lockedBy = asString(row.locked_by).trim();
  const lockedAt = asString(row.locked_at);
  if (!projectId || !lockedBy || !lockedAt) return null;

  return {
    project_id: projectId,
    period_id: periodId,
    scope_key: buildPrototypeScopeKey(projectId, periodId),
    status: "LOCKED",
    locked_by: lockedBy,
    locked_at: lockedAt,
  };
}

function normalizeSnapshotRecord(row: unknown): StoreSnapshotRecord | null {
  if (!isObject(row)) return null;
  const payload = isObject(row.payload) ? row.payload : {};
  const approval = isObject(payload.approval) ? payload.approval : {};
  const scoringSummary = isObject(payload.scoring_summary)
    ? payload.scoring_summary
    : isObject(row.scoring_summary)
      ? row.scoring_summary
      : {};

  const projectId =
    asString(row.project_id).trim() ||
    asString(payload.project_id).trim() ||
    asString(payload.projectId).trim();
  const periodIdRaw =
    asNullableString(row.period_id) ||
    asNullableString(payload.period_id) ||
    asNullableString(payload.periodId) ||
    (isObject(payload.period) ? asNullableString(payload.period.id) : null);
  const periodId = normalizePeriodId(periodIdRaw);
  if (!projectId) return null;

  const approvedBy =
    asString(row.approved_by).trim() ||
    asString(row.approver_user_id).trim() ||
    asString(approval.approver_user_id).trim() ||
    "Approver (Prototype)";
  const approvedAt =
    asString(row.approved_at) ||
    asString(row.created_at) ||
    asString(approval.approved_at) ||
    new Date().toISOString();

  const breakdownSource = parseArray<unknown>(
    row.breakdown ??
    row.perspective_breakdown ??
    scoringSummary.perspectives ??
    payload.perspectives
  );
  const breakdown = breakdownSource
    .map((entry) => {
      if (!isObject(entry)) return null;
      const perspectiveId =
        asString(entry.perspective_id).trim() ||
        asString(entry.id).trim() ||
        asString(entry.perspective).trim();
      if (!perspectiveId) return null;
      return {
        perspective_id: perspectiveId,
        score:
          asFiniteNumber(entry.score) ??
          asFiniteNumber(entry.weighted_score) ??
          asFiniteNumber(entry.average_score) ??
          asFiniteNumber(entry.total_score),
      };
    })
    .filter((entry): entry is { perspective_id: string; score: number | null } => Boolean(entry));

  const countsRaw =
    (isObject(row.evidence_counts) ? row.evidence_counts : null) ||
    (isObject(payload.evidence_counts) ? payload.evidence_counts : null) ||
    {};
  const evidenceCounts: StoreReviewStatusCount = {
    ACCEPTABLE: asFiniteNumber(countsRaw.ACCEPTABLE) ?? 0,
    NEEDS_REVISION: asFiniteNumber(countsRaw.NEEDS_REVISION) ?? 0,
    REJECTED: asFiniteNumber(countsRaw.REJECTED) ?? 0,
    AWAITING_REVIEW: asFiniteNumber(countsRaw.AWAITING_REVIEW) ?? 0,
  };

  const snapshotId = asNullableString(row.snapshot_id);

  return {
    snapshot_id: snapshotId || undefined,
    project_id: projectId,
    period_id: periodId,
    scope_key: buildPrototypeScopeKey(projectId, periodId),
    approved_by: approvedBy,
    approved_at: approvedAt,
    final_bim_score:
      asFiniteNumber(row.final_bim_score) ??
      asFiniteNumber(row.total_score) ??
      asFiniteNumber(scoringSummary.total_score),
    breakdown,
    evidence_counts: evidenceCounts,
    note: "Prototype snapshot (not used for audit/compliance)",
  };
}

function dedupeByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(keyFn(item), item);
  }
  return [...map.values()];
}

function mergeReviewRecords(
  base: Record<string, StoreReviewRecord>,
  incoming: Record<string, StoreReviewRecord>
): Record<string, StoreReviewRecord> {
  const merged: Record<string, StoreReviewRecord> = { ...base };

  for (const evidenceId of Object.keys(incoming)) {
    const current = merged[evidenceId];
    const next = incoming[evidenceId];
    if (!current) {
      merged[evidenceId] = next;
      continue;
    }

    const history = dedupeByKey(
      [...current.review_history, ...next.review_history],
      (entry) => `${entry.reviewed_at}|${entry.reviewed_by}|${entry.review_outcome}|${entry.review_reason}`
    ).sort((a, b) => a.reviewed_at.localeCompare(b.reviewed_at));

    const latest = history[history.length - 1];
    merged[evidenceId] = {
      evidence_id: evidenceId,
      scope_key: next.scope_key || current.scope_key,
      review_outcome: latest.review_outcome,
      review_reason: latest.review_reason,
      reviewed_by: latest.reviewed_by,
      reviewed_at: latest.reviewed_at,
      review_history: history,
    };
  }

  return merged;
}

function getSnapshotUniqueKey(item: StoreSnapshotRecord): string {
  return `${item.snapshot_id || ""}|${item.scope_key}|${item.approved_at}`;
}

function normalizeStorePayload(payload: unknown): PrototypeTruthStore {
  const empty = createEmptyStore();
  if (!isObject(payload)) return empty;

  const reviewRecordsRaw = isObject(payload.review_records) ? payload.review_records : {};
  const reviewRecords: Record<string, StoreReviewRecord> = {};
  for (const key of Object.keys(reviewRecordsRaw)) {
    const normalized = normalizeReviewRecord(reviewRecordsRaw[key]);
    if (normalized) reviewRecords[key] = normalized;
  }

  const projectMetaRaw = isObject(payload.project_meta) ? payload.project_meta : {};
  const projectMeta: Record<string, StoreProjectMeta> = {};
  for (const key of Object.keys(projectMetaRaw)) {
    const row = projectMetaRaw[key];
    if (!isObject(row)) continue;
    const projectId = asString(row.project_id).trim() || key;
    if (!projectId) continue;
    projectMeta[projectId] = {
      project_id: projectId,
      project_name: asNullableString(row.project_name),
      project_code: asNullableString(row.project_code),
      week_anchor: asNullableString(row.week_anchor),
      updated_at: asString(row.updated_at) || new Date().toISOString(),
    };
  }

  const periodMetaRaw = isObject(payload.period_meta) ? payload.period_meta : {};
  const periodMeta: Record<string, StorePeriodMeta> = {};
  for (const key of Object.keys(periodMetaRaw)) {
    const row = periodMetaRaw[key];
    if (!isObject(row)) continue;
    const projectId = asString(row.project_id).trim();
    const periodId = normalizePeriodId(asNullableString(row.period_id));
    if (!projectId) continue;
    const mapKey = buildPrototypeScopeKey(projectId, periodId);
    periodMeta[mapKey] = {
      project_id: projectId,
      period_id: periodId,
      scope_key: buildPrototypeScopeKey(projectId, periodId),
      period_label: asNullableString(row.period_label),
      updated_at: asString(row.updated_at) || new Date().toISOString(),
    };
  }

  const evidenceItems = parseArray<unknown>(payload.evidence_items)
    .map((row) => normalizeEvidenceRow(row))
    .filter((row): row is StoreEvidenceItem => Boolean(row));
  const evidenceById = new Map<string, StoreEvidenceItem>(evidenceItems.map((row) => [row.id, row]));
  const reviewedWithScope: Record<string, StoreReviewRecord> = {};
  for (const evidenceId of Object.keys(reviewRecords)) {
    const record = reviewRecords[evidenceId];
    const evidence = evidenceById.get(evidenceId);
    const scopeKey = record.scope_key || evidence?.scope_key || "";
    if (!scopeKey) continue;
    reviewedWithScope[evidenceId] = {
      ...record,
      scope_key: scopeKey,
    };
  }

  return {
    version: 1,
    evidence_items: evidenceItems,
    review_records: reviewedWithScope,
    approval_decisions: parseArray<unknown>(payload.approval_decisions)
      .map((row) => normalizeDecisionRecord(row))
      .filter((row): row is StoreApprovalDecisionRecord => Boolean(row)),
    snapshots: parseArray<unknown>(payload.snapshots)
      .map((row) => normalizeSnapshotRecord(row))
      .filter((row): row is StoreSnapshotRecord => Boolean(row)),
    period_locks: parseArray<unknown>(payload.period_locks)
      .map((row) => normalizeLockRecord(row))
      .filter((row): row is StorePeriodLockRecord => Boolean(row)),
    project_meta: projectMeta,
    period_meta: periodMeta,
  };
}

function loadLegacyStore(): PrototypeTruthStore {
  const evidenceRows = parseArray<unknown>(readRawStorage<unknown>(LEGACY_EVIDENCE_KEY));
  const reviewMapRaw = readRawStorage<unknown>(LEGACY_REVIEW_KEY);
  const decisionRows = parseArray<unknown>(readRawStorage<unknown>(LEGACY_DECISION_KEY));
  const snapshotRows = parseArray<unknown>(readRawStorage<unknown>(LEGACY_SNAPSHOT_KEY));
  const lockRows = parseArray<unknown>(readRawStorage<unknown>(LEGACY_LOCK_KEY));

  const reviewMap = isObject(reviewMapRaw) ? reviewMapRaw : {};
  const normalizedReviews: Record<string, StoreReviewRecord> = {};
  for (const key of Object.keys(reviewMap)) {
    const normalized = normalizeReviewRecord(reviewMap[key]);
    if (normalized) normalizedReviews[key] = normalized;
  }

  return {
    version: 1,
    evidence_items: evidenceRows
      .map((row) => normalizeEvidenceRow(row))
      .filter((row): row is StoreEvidenceItem => Boolean(row)),
    review_records: normalizedReviews,
    approval_decisions: decisionRows
      .map((row) => normalizeDecisionRecord(row))
      .filter((row): row is StoreApprovalDecisionRecord => Boolean(row)),
    snapshots: snapshotRows
      .map((row) => normalizeSnapshotRecord(row))
      .filter((row): row is StoreSnapshotRecord => Boolean(row)),
    period_locks: lockRows
      .map((row) => normalizeLockRecord(row))
      .filter((row): row is StorePeriodLockRecord => Boolean(row)),
    project_meta: {},
    period_meta: {},
  };
}

function mergeStores(base: PrototypeTruthStore, incoming: PrototypeTruthStore): PrototypeTruthStore {
  const mergedEvidence = dedupeByKey(
    [...base.evidence_items, ...incoming.evidence_items],
    (item) => item.id
  ).sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at)));

  const mergedDecisions = dedupeByKey(
    [...base.approval_decisions, ...incoming.approval_decisions],
    (item) => `${item.project_id}|${item.period_id}|${item.decision}|${item.reason}|${item.decided_by}|${item.decided_at}`
  ).sort((a, b) => String(a.decided_at).localeCompare(String(b.decided_at)));

  const mergedSnapshots = dedupeByKey(
    [...base.snapshots, ...incoming.snapshots],
    (item) => getSnapshotUniqueKey(item)
  ).sort((a, b) => String(a.approved_at).localeCompare(String(b.approved_at)));

  const mergedLocks = dedupeByKey(
    [...base.period_locks, ...incoming.period_locks],
    (item) => `${item.project_id}|${item.period_id}|${item.status}`
  );
  const mergedEvidenceById = new Map<string, StoreEvidenceItem>(
    mergedEvidence.map((item) => [item.id, item])
  );
  const mergedReviews = mergeReviewRecords(base.review_records, incoming.review_records);
  const scopedReviews: Record<string, StoreReviewRecord> = {};
  for (const evidenceId of Object.keys(mergedReviews)) {
    const row = mergedReviews[evidenceId];
    const evidence = mergedEvidenceById.get(evidenceId);
    const scopeKey = row.scope_key || evidence?.scope_key || "";
    if (!scopeKey) continue;
    scopedReviews[evidenceId] = {
      ...row,
      scope_key: scopeKey,
    };
  }

  return {
    version: 1,
    evidence_items: mergedEvidence,
    review_records: scopedReviews,
    approval_decisions: mergedDecisions,
    snapshots: mergedSnapshots,
    period_locks: mergedLocks,
    project_meta: {
      ...base.project_meta,
      ...incoming.project_meta,
    },
    period_meta: {
      ...base.period_meta,
      ...incoming.period_meta,
    },
  };
}

function loadStore(): PrototypeTruthStore {
  if (typeof window === "undefined") return createEmptyStore();
  const raw = readRawStorage<unknown>(TRUTH_STORE_KEY);
  const parsed = normalizeStorePayload(raw);
  const legacy = loadLegacyStore();
  const merged = mergeStores(parsed, legacy);
  writeRawStorage(TRUTH_STORE_KEY, merged);
  return merged;
}

function saveStore(store: PrototypeTruthStore): void {
  writeRawStorage(TRUTH_STORE_KEY, store);
}

function mutateStore(mutator: (current: PrototypeTruthStore) => PrototypeTruthStore): PrototypeTruthStore {
  const current = loadStore();
  const next = mutator(current);
  saveStore(next);
  return next;
}

function periodMetaKey(projectId: string, periodId: string): string {
  return buildPrototypeScopeKey(projectId, periodId);
}

export function normalizePrototypePeriodId(periodId: string | null): string {
  return normalizePeriodId(periodId);
}

export function prototypeProjectPeriodKey(projectId: string, periodId: string | null): string {
  return buildPrototypeScopeKey(projectId, periodId);
}

export function listPrototypeEvidenceItemsFromStore(): StoreEvidenceItem[] {
  return [...loadStore().evidence_items];
}

export function getPrototypeEvidenceByIdFromStore(evidenceId: string): StoreEvidenceItem | null {
  const hit = loadStore().evidence_items.find((row) => row.id === evidenceId);
  return hit || null;
}

export function savePrototypeEvidenceItemsToStore(
  items: Array<StoreEvidenceItem | (Omit<StoreEvidenceItem, "scope_key"> & { scope_key?: string })>
): void {
  const normalizedItems = items.map((item) => ({
    ...item,
    scope_key: buildPrototypeScopeKey(item.project_id, item.period_id),
  }));
  mutateStore((current) => ({
    ...current,
    evidence_items: normalizedItems,
  }));
}

export function listPrototypeReviewsMapFromStore(): Record<string, StoreReviewRecord> {
  return { ...loadStore().review_records };
}

export function upsertPrototypeReviewRecordInStore(record: StoreReviewRecord): void {
  mutateStore((current) => {
    const evidenceScope =
      current.evidence_items.find((item) => item.id === record.evidence_id)?.scope_key || "";
    const normalizedRecord = {
      ...record,
      scope_key: record.scope_key || evidenceScope,
    };
    if (!normalizedRecord.scope_key) return current;
    const mergedReviews = mergeReviewRecords(current.review_records, {
      [normalizedRecord.evidence_id]: normalizedRecord,
    });
    return {
      ...current,
      review_records: mergedReviews,
    };
  });
}

export function listPrototypeApprovalDecisionsFromStore(): StoreApprovalDecisionRecord[] {
  return [...loadStore().approval_decisions];
}

export function appendPrototypeApprovalDecisionToStore(record: StoreApprovalDecisionRecord): void {
  const normalizedRecord = {
    ...record,
    period_id: normalizePeriodId(record.period_id),
    scope_key: buildPrototypeScopeKey(record.project_id, record.period_id),
  };
  mutateStore((current) => ({
    ...current,
    approval_decisions: [...current.approval_decisions, normalizedRecord],
  }));
}

export function listPrototypeSnapshotsFromStore(): StoreSnapshotRecord[] {
  return [...loadStore().snapshots];
}

export function appendPrototypeSnapshotToStore(record: StoreSnapshotRecord): void {
  const normalizedRecord = {
    ...record,
    period_id: normalizePeriodId(record.period_id),
    scope_key: buildPrototypeScopeKey(record.project_id, record.period_id),
  };
  mutateStore((current) => ({
    ...current,
    snapshots: [...current.snapshots, normalizedRecord],
  }));
}

export function listPrototypePeriodLocksFromStore(): StorePeriodLockRecord[] {
  return [...loadStore().period_locks];
}

export function upsertPrototypePeriodLockInStore(record: StorePeriodLockRecord): void {
  const normalizedRecord = {
    ...record,
    period_id: normalizePeriodId(record.period_id),
    scope_key: buildPrototypeScopeKey(record.project_id, record.period_id),
  };
  mutateStore((current) => {
    const exists = current.period_locks.some(
      (row) =>
        row.project_id === normalizedRecord.project_id &&
        row.period_id === normalizedRecord.period_id &&
        row.status === normalizedRecord.status
    );
    if (exists) return current;
    return {
      ...current,
      period_locks: [...current.period_locks, normalizedRecord],
    };
  });
}

export function getPrototypePeriodLockFromStore(
  projectId: string,
  periodId: string | null
): StorePeriodLockRecord | null {
  const normalized = normalizePeriodId(periodId);
  if (!normalized || normalized === UNKNOWN_ACTIVE_PERIOD_KEY) return null;
  const hit = loadStore().period_locks.find(
    (row) => row.project_id === projectId && row.period_id === normalized && row.status === "LOCKED"
  );
  return hit || null;
}

export function getPrototypePeriodStatusFromStore(
  projectId: string,
  periodId: string | null
): "LOCKED" | "OPEN" | null {
  const normalized = normalizePeriodId(periodId);
  if (!normalized || normalized === UNKNOWN_ACTIVE_PERIOD_KEY) return null;
  const lock = getPrototypePeriodLockFromStore(projectId, normalized);
  if (lock) return "LOCKED";

  const store = loadStore();
  const hasActivity =
    store.evidence_items.some(
      (row) => row.project_id === projectId && normalizePeriodId(row.period_id) === normalized
    ) ||
    store.approval_decisions.some(
      (row) => row.project_id === projectId && normalizePeriodId(row.period_id) === normalized
    ) ||
    store.snapshots.some(
      (row) => row.project_id === projectId && normalizePeriodId(row.period_id) === normalized
    ) ||
    Boolean(store.period_meta[periodMetaKey(projectId, normalized)]);

  return hasActivity ? "OPEN" : null;
}

export function listPrototypeProjectIdsFromStore(): string[] {
  const store = loadStore();
  const ids = new Set<string>();

  for (const row of store.evidence_items) ids.add(row.project_id);
  for (const row of store.approval_decisions) ids.add(row.project_id);
  for (const row of store.snapshots) ids.add(row.project_id);
  for (const row of store.period_locks) ids.add(row.project_id);
  for (const key of Object.keys(store.project_meta)) ids.add(key);

  return [...ids].sort((a, b) => a.localeCompare(b));
}

export function listPrototypePeriodIdsByProjectFromStore(projectId: string): string[] {
  const store = loadStore();
  const ids = new Set<string>();

  for (const row of store.evidence_items) {
    if (row.project_id !== projectId) continue;
    ids.add(normalizePeriodId(row.period_id));
  }
  for (const row of store.approval_decisions) {
    if (row.project_id !== projectId) continue;
    ids.add(normalizePeriodId(row.period_id));
  }
  for (const row of store.snapshots) {
    if (row.project_id !== projectId) continue;
    ids.add(normalizePeriodId(row.period_id));
  }
  for (const row of store.period_locks) {
    if (row.project_id !== projectId) continue;
    ids.add(normalizePeriodId(row.period_id));
  }
  for (const key of Object.keys(store.period_meta)) {
    const row = store.period_meta[key];
    if (row.project_id !== projectId) continue;
    ids.add(normalizePeriodId(row.period_id));
  }

  return [...ids].sort((a, b) => b.localeCompare(a));
}

export function rememberPrototypeProjectMetaInStore(input: {
  project_id: string;
  project_name: string | null;
  project_code: string | null;
  week_anchor?: string | null;
}): void {
  const projectId = asString(input.project_id).trim();
  if (!projectId) return;

  const existing = loadStore().project_meta[projectId];

  mutateStore((current) => ({
    ...current,
    project_meta: {
      ...current.project_meta,
      [projectId]: {
        project_id: projectId,
        project_name: asNullableString(input.project_name),
        project_code: asNullableString(input.project_code),
        week_anchor: asNullableString(input.week_anchor) ?? existing?.week_anchor ?? null,
        updated_at: new Date().toISOString(),
      },
    },
  }));
}

export function getPrototypeProjectMetaFromStore(projectId: string): StoreProjectMeta | null {
  const hit = loadStore().project_meta[projectId];
  return hit || null;
}

export function setPrototypeProjectWeekAnchor(projectId: string, weekAnchor: string | null): void {
  const hit = getPrototypeProjectMetaFromStore(projectId);
  rememberPrototypeProjectMetaInStore({
    project_id: projectId,
    project_name: hit?.project_name ?? null,
    project_code: hit?.project_code ?? null,
    week_anchor: weekAnchor,
  });
}

export function rememberPrototypePeriodMetaInStore(input: {
  project_id: string;
  period_id: string | null;
  period_label: string | null;
}): void {
  const projectId = asString(input.project_id).trim();
  if (!projectId) return;
  const periodId = normalizePeriodId(input.period_id);
  const key = periodMetaKey(projectId, periodId);

  mutateStore((current) => ({
    ...current,
    period_meta: {
      ...current.period_meta,
      [key]: {
        project_id: projectId,
        period_id: periodId,
        scope_key: buildPrototypeScopeKey(projectId, periodId),
        period_label: asNullableString(input.period_label),
        updated_at: new Date().toISOString(),
      },
    },
  }));
}

export function getPrototypePeriodMetaFromStore(
  projectId: string,
  periodId: string | null
): StorePeriodMeta | null {
  const normalized = normalizePeriodId(periodId);
  const key = periodMetaKey(projectId, normalized);
  const hit = loadStore().period_meta[key];
  return hit || null;
}
