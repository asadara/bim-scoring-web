import {
  DataMode,
  LOCKED_READ_ONLY_ERROR,
  NA_TEXT,
  ProjectRecord,
  PrototypeApprovalDecisionRecord,
  PrototypeSnapshotRecord,
  ReviewStatusCount,
  appendPrototypeApprovalDecision,
  appendPrototypeSnapshot,
  buildReviewStatusCounts,
  fetchEvidenceListReadMode,
  fetchProjectsReadMode,
  fetchProjectReadMode,
  fetchProjectPeriodsReadMode,
  getPrototypePeriodLock,
  isRealBackendWriteEnabled,
  listLocalEvidence,
  listPrototypeApprovalDecisions,
  listPrototypeSnapshots,
  resolvePeriodLockWithPrototype,
  resolvePeriodStatusLabelWithPrototype,
  selectActivePeriod,
  setPrototypePeriodLock,
} from "@/lib/role1TaskLayer";
import {
  getPrototypePeriodMetaFromStore,
  getPrototypeProjectMetaFromStore,
  listPrototypePeriodIdsByProjectFromStore,
  listPrototypeProjectIdsFromStore,
  normalizePrototypePeriodId,
} from "@/lib/prototypeStore";
import { SafeFetchFail, buildApiUrl, safeFetchJson } from "@/lib/http";
import {
  BackendWriteError,
  callBackendWrite,
  classifyBackendIssue,
} from "@/lib/backendWriteClient";
import { UNKNOWN_ACTIVE_PERIOD_KEY } from "@/lib/statusModel";

export type SummaryBreakdownRow = {
  perspective_id: string;
  score: number | null;
};

export type SummaryConfidence = {
  coverage: number | null;
  frequency: number | null;
  confidence: number | null;
  indicators_with_submission: number | null;
  total_active_indicators: number | null;
  total_submission: number | null;
  target_submission: number | null;
};

export type ReadOnlySummary = {
  total_score: number | null;
  confidence: SummaryConfidence | null;
  breakdown: SummaryBreakdownRow[];
};

export type ApproverProjectRow = {
  project: ProjectRecord;
  period_id: string | null;
  period_label: string;
  period_status_label: string;
  approval_status: string;
  data_mode: DataMode;
  backend_message: string | null;
};

export type ApproverProjectContext = {
  project: ProjectRecord;
  period_id: string | null;
  period_version: number | null;
  period_label: string;
  period_status_label: string;
  period_locked: boolean;
  summary: ReadOnlySummary;
  summary_available: boolean;
  evidence_counts: ReviewStatusCount;
  latest_decision: PrototypeApprovalDecisionRecord | null;
  snapshots: PrototypeSnapshotRecord[];
  data_mode: DataMode;
  backend_message: string | null;
};

export type ApproverHomeContext = {
  rows: ApproverProjectRow[];
  data_mode: DataMode;
  backend_message: string | null;
};

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizePayload(payload: unknown): unknown {
  const item = safeObject(payload);
  if (Object.prototype.hasOwnProperty.call(item, "ok")) {
    if (item.ok === false) throw new Error(asString(item.error) || "API returned ok=false");
    return item.data;
  }
  return payload;
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

function normalizePeriodId(periodId: string | null): string {
  return normalizePrototypePeriodId(periodId);
}

function requirePeriodId(periodId: string | null): string {
  const normalized = normalizePeriodId(periodId);
  if (!normalized || normalized === UNKNOWN_ACTIVE_PERIOD_KEY) {
    throw new Error("Period is Not available");
  }
  return normalized;
}

function formatPeriodLabel(params: { periodId: string | null; year: number | null; week: number | null }): string {
  if (params.year !== null || params.week !== null) {
    return `${params.year ?? NA_TEXT} W${params.week ?? NA_TEXT}`;
  }
  return NA_TEXT;
}

function formatPeriodLabelFallback(projectId: string, periodId: string | null): string {
  if (!periodId) return NA_TEXT;
  const meta = getPrototypePeriodMetaFromStore(projectId, periodId);
  return meta?.period_label || NA_TEXT;
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

function fallbackPeriodId(projectId: string): string | null {
  return listPrototypePeriodIdsByProjectFromStore(projectId)[0] || null;
}

function toSummaryBreakdown(value: unknown): SummaryBreakdownRow[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((row) => {
      const item = safeObject(row);
      const perspectiveId = asString(item.perspective_id || item.id).trim();
      if (!perspectiveId) return null;
      const score =
        asNumber(item.weighted_score) ??
        asNumber(item.score) ??
        asNumber(item.average_score) ??
        asNumber(item.total_score);
      return {
        perspective_id: perspectiveId,
        score,
      } satisfies SummaryBreakdownRow;
    })
    .filter((row): row is SummaryBreakdownRow => Boolean(row));
}

function toSummaryConfidence(value: unknown): SummaryConfidence | null {
  const item = safeObject(value);
  const parsed: SummaryConfidence = {
    coverage: asNumber(item.coverage),
    frequency: asNumber(item.frequency),
    confidence: asNumber(item.confidence),
    indicators_with_submission: asNumber(item.indicators_with_submission),
    total_active_indicators: asNumber(item.total_active_indicators),
    total_submission: asNumber(item.total_submission),
    target_submission: asNumber(item.target_submission),
  };

  const hasAnyValue = Object.values(parsed).some((entry) => entry !== null);
  return hasAnyValue ? parsed : null;
}

export async function fetchReadOnlySummary(projectId: string, periodId: string | null): Promise<ReadOnlySummary> {
  const result = await fetchReadOnlySummaryReadMode(projectId, periodId);
  if (result.mode === "prototype") {
    throw new Error(result.backend_message || "Not available");
  }
  return result.data;
}

export async function fetchReadOnlySummaryReadMode(projectId: string, periodId: string | null): Promise<{
  data: ReadOnlySummary;
  mode: DataMode;
  backend_message: string | null;
  available: boolean;
}> {
  if (!periodId) {
    return {
      data: {
        total_score: null,
        confidence: null,
        breakdown: [],
      },
      mode: "prototype",
      backend_message: "Period is Not available",
      available: false,
    };
  }

  const response = await safeFetchJson<unknown>(
    buildApiUrl(
      `/projects/${encodeURIComponent(projectId)}/periods/${encodeURIComponent(periodId)}/summary`
    )
  );
  if (!response.ok) {
    return {
      data: {
        total_score: null,
        confidence: null,
        breakdown: [],
      },
      mode: "prototype",
      backend_message: toSafeErrorMessage(response),
      available: false,
    };
  }

  try {
    const payload = normalizePayload(response.data);
    const root = safeObject(payload);
    const totalScore = asNumber(root.total_score);
    const confidence = toSummaryConfidence(root.confidence);
    const breakdown = toSummaryBreakdown(root.perspectives);
    return {
      data: {
        total_score: totalScore,
        confidence,
        breakdown,
      },
      mode: "backend",
      backend_message: null,
      available: true,
    };
  } catch (e) {
    return {
      data: {
        total_score: null,
        confidence: null,
        breakdown: [],
      },
      mode: "prototype",
      backend_message: e instanceof Error ? e.message : "Invalid backend payload",
      available: false,
    };
  }
}

export function getLatestApprovalDecision(projectId: string, periodId: string | null): PrototypeApprovalDecisionRecord | null {
  const normalized = normalizePeriodId(periodId);
  const items = listPrototypeApprovalDecisions().filter(
    (row) => row.project_id === projectId && row.period_id === normalized
  );
  if (!items.length) return null;

  return items
    .slice()
    .sort((a, b) => String(b.decided_at).localeCompare(String(a.decided_at)))[0];
}

export function listSnapshotsForPeriod(projectId: string, periodId: string | null): PrototypeSnapshotRecord[] {
  const normalized = normalizePeriodId(periodId);
  return listPrototypeSnapshots()
    .filter((row) => row.project_id === projectId && row.period_id === normalized)
    .sort((a, b) => String(b.approved_at).localeCompare(String(a.approved_at)));
}

export async function fetchApproverHomeContext(): Promise<ApproverHomeContext> {
  const projectsResult = await fetchProjectsReadMode();
  let projects: ProjectRecord[] = projectsResult.data;

  if (projects.length === 0) {
    projects = listPrototypeProjectIdsFromStore().map((projectId) => fallbackProject(projectId));
  }

  const rows = await Promise.all(
    projects.map(async (project) => {
      const periodsResult = await fetchProjectPeriodsReadMode(project.id);
      const activePeriod = selectActivePeriod(periodsResult.data);

      const periodId = activePeriod?.id ?? fallbackPeriodId(project.id);
      const backendStatus = activePeriod?.status ?? null;
      const periodStatusLabel = resolvePeriodStatusLabelWithPrototype(project.id, periodId, backendStatus);
      const latestDecision = getLatestApprovalDecision(project.id, periodId);
      const dataMode: DataMode =
        projectsResult.mode === "prototype" || periodsResult.mode === "prototype" ? "prototype" : "backend";

      return {
        project,
        period_id: periodId,
        period_label: activePeriod
          ? formatPeriodLabel({ periodId, year: activePeriod.year, week: activePeriod.week })
          : formatPeriodLabelFallback(project.id, periodId),
        period_status_label: periodStatusLabel,
        approval_status:
          latestDecision?.decision || (periodId ? (periodStatusLabel === "LOCKED" ? "APPROVED" : "OPEN") : NA_TEXT),
        data_mode: dataMode,
        backend_message: projectsResult.backend_message || periodsResult.backend_message || null,
      } satisfies ApproverProjectRow;
    })
  );

  rows.sort((a, b) =>
    String(a.project.name || a.project.code || a.project.id).localeCompare(
      String(b.project.name || b.project.code || b.project.id)
    )
  );

  const dataMode: DataMode =
    projectsResult.mode === "prototype" || rows.some((row) => row.data_mode === "prototype")
      ? "prototype"
      : "backend";
  const backendMessage =
    projectsResult.backend_message || rows.map((row) => row.backend_message).find((item) => Boolean(item)) || null;

  return {
    rows,
    data_mode: dataMode,
    backend_message: backendMessage,
  };
}

export async function fetchApproverHomeRows(): Promise<ApproverProjectRow[]> {
  const context = await fetchApproverHomeContext();
  return context.rows;
}

export async function fetchApproverProjectContext(projectId: string): Promise<ApproverProjectContext> {
  const [projectResult, periodsResult] = await Promise.all([
    fetchProjectReadMode(projectId),
    fetchProjectPeriodsReadMode(projectId),
  ]);

  const project = projectResult.data || fallbackProject(projectId);
  const periods = periodsResult.data;

  const active = selectActivePeriod(periods);
  const periodId = active?.id ?? fallbackPeriodId(projectId);
  const backendStatus = active?.status ?? null;
  const periodStatusLabel = resolvePeriodStatusLabelWithPrototype(projectId, periodId, backendStatus);
  const periodLocked = resolvePeriodLockWithPrototype(projectId, periodId, backendStatus);

  const summaryResult = await fetchReadOnlySummaryReadMode(projectId, periodId);
  let summary: ReadOnlySummary = summaryResult.data;
  let summaryAvailable = summaryResult.available;

  const evidenceResult = await fetchEvidenceListReadMode(projectId, periodId);
  const evidenceCounts = buildReviewStatusCounts(
    evidenceResult.data.length > 0 ? evidenceResult.data : listLocalEvidence(projectId, periodId)
  );
  const latestDecision = getLatestApprovalDecision(projectId, periodId);
  const snapshots = listSnapshotsForPeriod(projectId, periodId);
  const dataMode: DataMode =
    projectResult.mode === "prototype" ||
    periodsResult.mode === "prototype" ||
    summaryResult.mode === "prototype" ||
    evidenceResult.mode === "prototype"
      ? "prototype"
      : "backend";

  if (!summaryAvailable && snapshots.length > 0) {
    const latestSnapshot = snapshots[0];
    summary = {
      total_score: latestSnapshot.final_bim_score,
      confidence: null,
      breakdown: latestSnapshot.breakdown.map((row) => ({
        perspective_id: row.perspective_id,
        score: row.score,
      })),
    };
    summaryAvailable = true;
  }

  return {
    project,
    period_id: periodId,
    period_version: active?.version ?? null,
    period_label: active
      ? formatPeriodLabel({ periodId, year: active.year, week: active.week })
      : formatPeriodLabelFallback(projectId, periodId),
    period_status_label: periodStatusLabel,
    period_locked: periodLocked,
    summary,
    summary_available: summaryAvailable,
    evidence_counts: evidenceCounts,
    latest_decision: latestDecision,
    snapshots,
    data_mode: dataMode,
    backend_message:
      projectResult.backend_message ||
      periodsResult.backend_message ||
      summaryResult.backend_message ||
      evidenceResult.backend_message ||
      null,
  };
}

function normalizeWriteError(error: unknown): Error {
  if (error instanceof BackendWriteError) {
    const issue = classifyBackendIssue(error);
    if (issue === "unavailable") return new Error("Backend unavailable");
    return new Error(`HTTP ${error.status ?? 500} ${error.code} - ${error.message}`);
  }
  if (error instanceof Error) return error;
  return new Error("Backend approval write failed");
}

type ApproveWriteResponse = {
  period_id: string;
  status: "LOCKED";
  locked_at: string;
  locked_by: string;
  snapshot_id: string;
};

type RejectWriteResponse = {
  period_id: string;
  status: "OPEN";
  rejected_at: string;
  rejected_by: string;
};

export async function applyApproverDecision(input: {
  project_id: string;
  period_id: string | null;
  period_version: number | null;
  decision: "APPROVE PERIOD" | "REJECT APPROVAL";
  reason: string;
  final_bim_score: number | null;
  breakdown: SummaryBreakdownRow[];
  evidence_counts: ReviewStatusCount;
}): Promise<{
  decision_record: PrototypeApprovalDecisionRecord;
  lock_record: ReturnType<typeof getPrototypePeriodLock>;
  snapshot_record: PrototypeSnapshotRecord | null;
}> {
  if (!input.reason.trim()) {
    throw new Error("Reason wajib diisi.");
  }

  if (input.decision === "APPROVE PERIOD" && input.evidence_counts.AWAITING_REVIEW > 0) {
    throw new Error("Tidak dapat APPROVE PERIOD karena masih ada evidence berstatus Awaiting review.");
  }

  if (getPrototypePeriodLock(input.project_id, input.period_id)) {
    throw new Error(LOCKED_READ_ONLY_ERROR);
  }
  if (!isRealBackendWriteEnabled()) {
    const decisionRecord = appendPrototypeApprovalDecision({
      project_id: input.project_id,
      period_id: input.period_id,
      decision: input.decision,
      reason: input.reason,
      decided_by: "Approver (Prototype)",
    });

    if (input.decision === "APPROVE PERIOD") {
      const lockRecord = setPrototypePeriodLock({
        project_id: input.project_id,
        period_id: input.period_id,
        locked_by: "Approver (Prototype)",
      });

      const snapshotRecord = appendPrototypeSnapshot({
        project_id: input.project_id,
        period_id: input.period_id,
        approved_by: "Approver (Prototype)",
        final_bim_score: input.final_bim_score,
        breakdown: input.breakdown,
        evidence_counts: input.evidence_counts,
      });

      return {
        decision_record: decisionRecord,
        lock_record: lockRecord,
        snapshot_record: snapshotRecord,
      };
    }

    return {
      decision_record: decisionRecord,
      lock_record: getPrototypePeriodLock(input.project_id, input.period_id),
      snapshot_record: null,
    };
  }

  const periodId = requirePeriodId(input.period_id);
  if (!Number.isInteger(input.period_version)) {
    throw new Error("Period version is Not available");
  }

  try {
    if (input.decision === "APPROVE PERIOD") {
      const payload = {
        period_id: periodId,
        reason: input.reason.trim(),
        if_match_version: input.period_version,
      };

      const result = await callBackendWrite<ApproveWriteResponse>({
        path: `/periods/${encodeURIComponent(periodId)}/approve`,
        method: "POST",
        actorRole: "role3",
        body: payload,
        idempotencyScope: "period-approve",
        idempotencyPayload: payload,
      });

      const decisionRecord = appendPrototypeApprovalDecision({
        project_id: input.project_id,
        period_id: periodId,
        decision: "APPROVE PERIOD",
        reason: input.reason,
        decided_by: result.locked_by || "Approver",
      });

      const lockRecord = setPrototypePeriodLock({
        project_id: input.project_id,
        period_id: periodId,
        locked_by: result.locked_by || "Approver",
      });

      const snapshotRecord = appendPrototypeSnapshot({
        project_id: input.project_id,
        period_id: periodId,
        approved_by: result.locked_by || "Approver",
        approved_at: result.locked_at,
        snapshot_id: result.snapshot_id,
        final_bim_score: input.final_bim_score,
        breakdown: input.breakdown,
        evidence_counts: input.evidence_counts,
      });

      return {
        decision_record: decisionRecord,
        lock_record: lockRecord,
        snapshot_record: snapshotRecord,
      };
    }

    const payload = {
      period_id: periodId,
      reason: input.reason.trim(),
      if_match_version: input.period_version,
    };
    const result = await callBackendWrite<RejectWriteResponse>({
      path: `/periods/${encodeURIComponent(periodId)}/reject`,
      method: "POST",
      actorRole: "role3",
      body: payload,
      idempotencyScope: "period-reject",
      idempotencyPayload: payload,
    });

    const decisionRecord = appendPrototypeApprovalDecision({
      project_id: input.project_id,
      period_id: periodId,
      decision: "REJECT APPROVAL",
      reason: input.reason,
      decided_by: result.rejected_by || "Approver",
    });

    return {
      decision_record: decisionRecord,
      lock_record: getPrototypePeriodLock(input.project_id, input.period_id),
      snapshot_record: null,
    };
  } catch (error) {
    throw normalizeWriteError(error);
  }
}
