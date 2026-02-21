import {
  DataMode,
  NA_TEXT,
  normalizePrototypePeriodId,
  PrototypeApprovalDecisionRecord,
  PrototypeSnapshotRecord,
  ReviewStatusCount,
  getPrototypePeriodLock,
  listPrototypeApprovalDecisions,
} from "@/lib/role1TaskLayer";
import { buildApiUrl, safeFetchJson, toUserFacingSafeFetchError } from "@/lib/http";
import { getPrototypePeriodStatusFromStore } from "@/lib/prototypeStore";

export type AuditSnapshotView = {
  snapshot_id: string;
  snapshot: PrototypeSnapshotRecord;
};

export type AuditGovernanceEvent = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_id: string | null;
  created_at: string;
};

function normalizeSnapshotId(snapshot: PrototypeSnapshotRecord, index: number): string {
  if (snapshot.snapshot_id && snapshot.snapshot_id.trim()) return snapshot.snapshot_id.trim();
  return `${snapshot.project_id}::${snapshot.period_id}::${snapshot.approved_at}::${index}`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  const text = asString(value).trim();
  return text || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function unwrapPayload(payload: unknown): { ok: true; data: unknown } | { ok: false; error: string } {
  if (payload && typeof payload === "object" && "ok" in payload) {
    const wrapped = payload as { ok?: boolean; error?: string; data?: unknown };
    if (wrapped.ok === false) return { ok: false, error: wrapped.error || "API returned ok=false" };
    return { ok: true, data: wrapped.data };
  }
  return { ok: true, data: payload };
}

function toSafeErrorMessage(result: Awaited<ReturnType<typeof safeFetchJson<unknown>>>): string {
  if (result.ok) return "";
  return toUserFacingSafeFetchError(result, "Backend belum tersedia.");
}

function toSnapshotRecord(row: Record<string, unknown>): PrototypeSnapshotRecord | null {
  const snapshotId = asNullableString(row.snapshot_id || row.id);
  const projectId = asNullableString(row.project_id);
  const periodId = asNullableString(row.period_id);
  if (!projectId || !periodId) return null;

  const payload =
    row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {};
  const approval =
    payload.approval && typeof payload.approval === "object"
      ? (payload.approval as Record<string, unknown>)
      : {};
  const summary =
    payload.scoring_summary && typeof payload.scoring_summary === "object"
      ? (payload.scoring_summary as Record<string, unknown>)
      : {};
  const breakdownRows = Array.isArray(summary.perspectives)
    ? (summary.perspectives as unknown[])
    : Array.isArray(payload.breakdown)
      ? (payload.breakdown as unknown[])
      : [];

  const breakdown = breakdownRows
    .map((entry) => {
      const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      const perspectiveId = asNullableString(item.perspective_id || item.id);
      if (!perspectiveId) return null;
      const score =
        asNumber(item.score) ??
        asNumber(item.weighted_score) ??
        asNumber(item.total_score) ??
        null;
      return {
        perspective_id: perspectiveId,
        score,
      };
    })
    .filter((entry): entry is { perspective_id: string; score: number | null } => Boolean(entry));

  const countsSource =
    payload.evidence_counts && typeof payload.evidence_counts === "object"
      ? (payload.evidence_counts as Record<string, unknown>)
      : {};

  return {
    snapshot_id: snapshotId || undefined,
    project_id: projectId,
    period_id: periodId,
    scope_key: `proto:${projectId}:${normalizePrototypePeriodId(periodId)}`,
    approved_by: asNullableString(approval.approver_user_id) || "Approver",
    approved_at: asNullableString(approval.approved_at) || asNullableString(row.created_at) || new Date().toISOString(),
    final_bim_score: asNumber(summary.total_score),
    breakdown,
    evidence_counts: {
      ACCEPTABLE: asNumber(countsSource.ACCEPTABLE) ?? 0,
      NEEDS_REVISION: asNumber(countsSource.NEEDS_REVISION) ?? 0,
      REJECTED: asNumber(countsSource.REJECTED) ?? 0,
      AWAITING_REVIEW: asNumber(countsSource.AWAITING_REVIEW) ?? 0,
    },
    note: "Prototype snapshot (not used for audit/compliance)",
  };
}

async function fetchBackendSnapshots(): Promise<{
  data: AuditSnapshotView[];
  mode: DataMode;
  backend_message: string | null;
}> {
  const candidates = [buildApiUrl("/summary_snapshots")];

  let lastMessage: string | null = null;
  for (const url of candidates) {
    const response = await safeFetchJson<unknown>(url);
    if (!response.ok) {
      lastMessage = toSafeErrorMessage(response);
      continue;
    }

    const unwrapped = unwrapPayload(response.data);
    if (!unwrapped.ok) {
      lastMessage = unwrapped.error;
      continue;
    }

    const payload = unwrapped.data;
    const payloadObject =
      payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
    const rows = Array.isArray(payload)
      ? (payload as unknown[])
      : Array.isArray(payloadObject?.data)
        ? ((payloadObject.data || []) as unknown[])
        : null;

    // If endpoint responded with unknown shape, try next candidate (if any).
    if (!rows) {
      lastMessage = "Snapshot data endpoint returned invalid payload";
      continue;
    }

    const mapped = rows
      .map((entry) => {
        const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
        return toSnapshotRecord(row);
      })
      .filter((entry): entry is PrototypeSnapshotRecord => Boolean(entry))
      .map((snapshot, index) => ({
        snapshot_id: normalizeSnapshotId(snapshot, index),
        snapshot,
      }))
      .sort((a, b) => String(b.snapshot.approved_at).localeCompare(String(a.snapshot.approved_at)));

    return {
      data: mapped,
      mode: "backend",
      backend_message: null,
    };
  }

  return {
    data: [],
    mode: "backend",
    backend_message: lastMessage || "Backend unavailable",
  };
}

export function listAuditSnapshots(): AuditSnapshotView[] {
  const snapshots: PrototypeSnapshotRecord[] = [];

  return snapshots
    .map((snapshot, index) => ({
      snapshot_id: normalizeSnapshotId(snapshot, index),
      snapshot,
    }))
    .sort((a, b) => String(b.snapshot.approved_at).localeCompare(String(a.snapshot.approved_at)));
}

export async function fetchAuditSnapshotsReadMode(): Promise<{
  data: AuditSnapshotView[];
  mode: DataMode;
  backend_message: string | null;
}> {
  return await fetchBackendSnapshots();
}

function toGovernanceEvent(row: unknown, index: number): AuditGovernanceEvent | null {
  const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
  const createdAt = asNullableString(item.created_at) || null;
  const action = asNullableString(item.action) || null;
  const entityType = asNullableString(item.entity_type) || null;
  if (!createdAt || !action || !entityType) return null;

  return {
    id: asNullableString(item.id) || `${createdAt}::${action}::${index}`,
    action,
    entity_type: entityType,
    entity_id: asNullableString(item.entity_id),
    actor_id: asNullableString(item.actor_id),
    created_at: createdAt,
  };
}

export async function fetchAdminAuditLogsReadMode(input: {
  role: string;
  actor_id?: string | null;
  limit?: number;
}): Promise<{
  data: AuditGovernanceEvent[];
  mode: DataMode;
  backend_message: string | null;
}> {
  const role = asString(input.role).trim().toLowerCase();
  if (role !== "admin") {
    return {
      data: [],
      mode: "backend",
      backend_message: "Recent governance events require Admin role",
    };
  }

  const params = new URLSearchParams({
    limit: String(input.limit && input.limit > 0 ? input.limit : 20),
  });

  const headers = new Headers();
  headers.set("x-actor-role", "admin");
  headers.set("x-actor-id", asString(input.actor_id).trim() || "audit-read");

  const response = await safeFetchJson<unknown>(buildApiUrl(`/admin/audit-logs?${params.toString()}`), {
    headers,
  });

  if (!response.ok) {
    return {
      data: [],
      mode: "backend",
      backend_message: toSafeErrorMessage(response),
    };
  }

  const unwrapped = unwrapPayload(response.data);
  if (!unwrapped.ok) {
    return {
      data: [],
      mode: "backend",
      backend_message: unwrapped.error,
    };
  }

  const rows = Array.isArray(unwrapped.data) ? unwrapped.data : [];
  const mapped = rows
    .map((row, index) => toGovernanceEvent(row, index))
    .filter((row): row is AuditGovernanceEvent => Boolean(row))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  return {
    data: mapped,
    mode: "backend",
    backend_message: null,
  };
}

export function getAuditSnapshotById(snapshotId: string): AuditSnapshotView | null {
  const all = listAuditSnapshots();
  const hit = all.find((row) => row.snapshot_id === snapshotId);
  return hit ?? null;
}

export function listDecisionsForSnapshot(snapshot: PrototypeSnapshotRecord): PrototypeApprovalDecisionRecord[] {
  return listPrototypeApprovalDecisions()
    .filter((row) => row.project_id === snapshot.project_id && row.period_id === snapshot.period_id)
    .sort((a, b) => String(b.decided_at).localeCompare(String(a.decided_at)));
}

export function getSnapshotLockStatus(snapshot: PrototypeSnapshotRecord): string {
  const lock = getPrototypePeriodLock(snapshot.project_id, snapshot.period_id);
  if (lock?.status) return lock.status;
  return getPrototypePeriodStatusFromStore(snapshot.project_id, snapshot.period_id) || "LOCKED";
}

export function getSubmittedCountFromSnapshot(counts: ReviewStatusCount): number {
  return counts.ACCEPTABLE + counts.NEEDS_REVISION + counts.REJECTED + counts.AWAITING_REVIEW;
}

export function toOptionalPeriodId(periodId: string): string | null {
  const normalized = normalizePrototypePeriodId(periodId);
  if (normalized === "UNKNOWN_ACTIVE") return null;
  return normalized || null;
}

export function buildAuditExportPayload(input: {
  snapshot_id: string;
  snapshot: PrototypeSnapshotRecord;
  decisions: PrototypeApprovalDecisionRecord[];
  lock_status: string;
}) {
  return {
    snapshot_id: input.snapshot_id,
    snapshot: input.snapshot,
    lock_status: input.lock_status,
    decisions: input.decisions,
    note: "Read-only Auditor View export",
  };
}

export type PrintableAuditIsoRow = {
  control_area: string;
  iso_reference: string;
  indicative_mapping: string;
};

export type PrintableAuditBreakdownRow = {
  perspective_id: string;
  score: string;
  weight: string;
};

export type PrintableAuditStage = {
  title: string;
  role: string;
  meaning: string;
  not_done: string;
};

export type PrintableAuditSnapshot = {
  title: string;
  disclaimer: string;
  file_name: string;
  snapshot_header: {
    project_name: string;
    project_id: string;
    period_id: string;
    approved_by: string;
    approved_at: string;
    lock_status: string;
    snapshot_id: string;
  };
  final_score: {
    total_score: string;
    breakdown: PrintableAuditBreakdownRow[];
  };
  evidence_review_counts: {
    acceptable: string;
    needs_revision: string;
    rejected: string;
    awaiting_review: string;
  };
  narrative_audit_trail: PrintableAuditStage[];
  iso_mapping: {
    label: string;
    rows: PrintableAuditIsoRow[];
  };
};

const PDF_TITLE = "BIM Scoring Platform — Snapshot Export (Reference)";
const PDF_DISCLAIMER = "Reference only — not a compliance claim";
const PDF_PERSPECTIVES = ["P1", "P2", "P3", "P4", "P5"];

function asText(value: unknown): string {
  if (typeof value === "string") {
    const cleaned = value.trim();
    return cleaned || NA_TEXT;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return NA_TEXT;
}

function sanitizeFilenamePart(value: string): string {
  const cleaned = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "Not_available";
}

function findBreakdownScore(
  rows: PrototypeSnapshotRecord["breakdown"],
  perspectiveId: string
): string {
  const hit = rows.find((row) => row.perspective_id === perspectiveId);
  if (!hit) return NA_TEXT;
  return asText(hit.score);
}

function findBreakdownWeight(
  rows: PrototypeSnapshotRecord["breakdown"],
  perspectiveId: string
): string {
  const dynamicRows = rows as Array<Record<string, unknown>>;
  const hit = dynamicRows.find((row) => asText(row.perspective_id) === perspectiveId);
  if (!hit) return NA_TEXT;

  const weight =
    hit.weight ??
    hit.perspective_weight ??
    hit.weights ??
    hit.weight_value;
  return asText(weight);
}

function normalizeLockStatus(value: string): string {
  const text = asText(value);
  if (text === "LOCKED" || text === "OPEN") return text;
  return text;
}

export function buildSnapshotPdfFilename(input: {
  project_name_or_id: string;
  period_id: string;
  snapshot_id: string;
}): string {
  const projectKey = sanitizeFilenamePart(input.project_name_or_id);
  const periodKey = sanitizeFilenamePart(input.period_id);
  const snapshotKey = sanitizeFilenamePart(input.snapshot_id);
  return `BIM-Scoring-Snapshot_${projectKey}_${periodKey}_${snapshotKey}.pdf`;
}

export function buildPrintableAuditSnapshot(input: {
  snapshot_id: string;
  snapshot: PrototypeSnapshotRecord;
  lock_status: string;
  project_name: string | null;
  latest_decision: PrototypeApprovalDecisionRecord | null;
  submitted_count: number;
  iso_reference_label: string;
  iso_reference_rows: PrintableAuditIsoRow[];
}): PrintableAuditSnapshot {
  const projectName = asText(input.project_name || "");
  const projectId = asText(input.snapshot.project_id);
  const periodId = asText(input.snapshot.period_id);
  const snapshotId = asText(input.snapshot_id);
  const latestDecision = input.latest_decision;
  const decisionText = asText(latestDecision?.decision);
  const reasonText = asText(latestDecision?.reason);
  const submittedCountText = asText(input.submitted_count);
  const lockStatus = normalizeLockStatus(input.lock_status);

  return {
    title: PDF_TITLE,
    disclaimer: PDF_DISCLAIMER,
    file_name: buildSnapshotPdfFilename({
      project_name_or_id: projectName !== NA_TEXT ? projectName : projectId,
      period_id: periodId,
      snapshot_id: snapshotId,
    }),
    snapshot_header: {
      project_name: projectName,
      project_id: projectId,
      period_id: periodId,
      approved_by: asText(input.snapshot.approved_by),
      approved_at: asText(input.snapshot.approved_at),
      lock_status: lockStatus,
      snapshot_id: snapshotId,
    },
    final_score: {
      total_score: asText(input.snapshot.final_bim_score),
      breakdown: PDF_PERSPECTIVES.map((perspectiveId) => ({
        perspective_id: perspectiveId,
        score: findBreakdownScore(input.snapshot.breakdown, perspectiveId),
        weight: findBreakdownWeight(input.snapshot.breakdown, perspectiveId),
      })),
    },
    evidence_review_counts: {
      acceptable: asText(input.snapshot.evidence_counts?.ACCEPTABLE),
      needs_revision: asText(input.snapshot.evidence_counts?.NEEDS_REVISION),
      rejected: asText(input.snapshot.evidence_counts?.REJECTED),
      awaiting_review: asText(input.snapshot.evidence_counts?.AWAITING_REVIEW),
    },
    narrative_audit_trail: [
      {
        title: "Evidence Submission (Role 1)",
        role: "BIM Koordinator Proyek",
        meaning: `Proyek submit evidence untuk indikator terkait (submitted count: ${submittedCountText}).`,
        not_done: "Tidak melakukan review, approval, atau locking period.",
      },
      {
        title: "Review Eligibility (Role 2)",
        role: "HO Reviewer",
        meaning: "Menilai kelayakan evidence (Acceptable/Needs Revision/Rejected) berdasarkan konteks review.",
        not_done: "Tidak melakukan approval period dan tidak mengubah skor.",
      },
      {
        title: "Approval Decision (Role 3)",
        role: "BIM Manager/KaDiv BIM",
        meaning: `Keputusan level period: ${decisionText}. Reason: ${reasonText}.`,
        not_done: "Tidak melakukan edit evidence, indikator, atau score entry.",
      },
      {
        title: "Snapshot Created (System)",
        role: "System record layer (backend)",
        meaning: "Snapshot immutable dibuat saat approval dan disimpan append-only.",
        not_done: "Tidak mengklaim compliance final; hanya rekam jejak referensi internal.",
      },
    ],
    iso_mapping: {
      label: asText(input.iso_reference_label),
      rows: input.iso_reference_rows.map((row) => ({
        control_area: asText(row.control_area),
        iso_reference: asText(row.iso_reference),
        indicative_mapping: asText(row.indicative_mapping),
      })),
    },
  };
}
