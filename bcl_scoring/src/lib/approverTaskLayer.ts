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
  formatPeriodLabel,
  getPrototypePeriodLock,
  isRealBackendWriteEnabled,
  listPrototypeApprovalDecisions,
  listPrototypeSnapshots,
  PROTOTYPE_WRITE_DISABLED_MESSAGE,
  resolvePeriodLockWithPrototype,
  resolvePeriodStatusLabelWithPrototype,
  selectActivePeriod,
  selectPeriodByJakartaDate,
  setPrototypePeriodLock,
} from "@/lib/role1TaskLayer";
import {
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

export type PmpArea15Status = "OK" | "MINOR" | "NOT_OK" | "INCOMPLETE" | "NOT_MAPPED" | "NOT_CONFIGURED";

export type PmpArea15ControlSummary = {
  control_id: string;
  phase: string;
  title: string;
  description: string | null;
  mandatory: boolean;
  matched_indicator_count: number;
  scored_indicator_count: number;
  evidence_ready_count: number;
  average_score_0_5: number | null;
  score_100: number | null;
  status: PmpArea15Status;
  export_status: string;
  blockers: string[];
};

export type PmpArea15PhaseSummary = {
  phase: string;
  status: PmpArea15Status;
  export_status: string;
  score_100: number | null;
  mandatory_count: number;
  mapped_count: number;
  ok_count: number;
  minor_count: number;
  not_ok_count: number;
  incomplete_count: number;
  not_mapped_count: number;
};

export type PmpArea15ComplianceSummary = {
  version: string | null;
  source_of_truth: string | null;
  intent: string | null;
  overall_status: PmpArea15Status;
  overall_export_status: string;
  overall_score_100: number | null;
  export_ready: boolean;
  hold_point_ready: boolean;
  total_bim_score_100: number | null;
  phase_summaries: PmpArea15PhaseSummary[];
  controls: PmpArea15ControlSummary[];
  mapping_status: {
    configured_control_count: number;
    mandatory_control_count: number;
    mapped_control_count: number;
    unmapped_control_count: number;
  };
};

export type ReadOnlySummary = {
  total_score: number | null;
  confidence: SummaryConfidence | null;
  breakdown: SummaryBreakdownRow[];
  compliance: PmpArea15ComplianceSummary | null;
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

export const APPROVAL_GATE_POLICY = {
  min_coverage_ratio: 0.6,
  min_reviewed_evidence: 3,
  min_scored_perspectives: 4,
} as const;

export type ApprovalGateEvaluation = {
  is_eligible: boolean;
  failures: string[];
  metrics: {
    coverage_ratio: number | null;
    reviewed_evidence_count: number;
    scored_perspectives_count: number;
    awaiting_review_count: number;
    pmp_bridge_available: boolean;
    pmp_hold_point_ready: boolean;
  };
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

function toPmpArea15Status(value: unknown): PmpArea15Status {
  const text = asString(value).trim().toUpperCase();
  if (
    text === "OK" ||
    text === "MINOR" ||
    text === "NOT_OK" ||
    text === "INCOMPLETE" ||
    text === "NOT_MAPPED" ||
    text === "NOT_CONFIGURED"
  ) {
    return text as PmpArea15Status;
  }
  return "NOT_CONFIGURED";
}

function toPmpArea15ComplianceSummary(value: unknown): PmpArea15ComplianceSummary | null {
  const root = safeObject(value);
  if (Object.keys(root).length === 0) return null;

  const mappingStatusRoot = safeObject(root.mapping_status);
  const phaseRows = Array.isArray(root.phase_summaries) ? root.phase_summaries : [];
  const controlRows = Array.isArray(root.controls) ? root.controls : [];

  return {
    version: asString(root.version).trim() || null,
    source_of_truth: asString(root.source_of_truth).trim() || null,
    intent: asString(root.intent).trim() || null,
    overall_status: toPmpArea15Status(root.overall_status),
    overall_export_status: asString(root.overall_export_status).trim() || NA_TEXT,
    overall_score_100: asNumber(root.overall_score_100),
    export_ready: root.export_ready === true,
    hold_point_ready: root.hold_point_ready === true,
    total_bim_score_100: asNumber(root.total_bim_score_100),
    phase_summaries: phaseRows.map((entry) => {
      const item = safeObject(entry);
      return {
        phase: asString(item.phase).trim() || NA_TEXT,
        status: toPmpArea15Status(item.status),
        export_status: asString(item.export_status).trim() || NA_TEXT,
        score_100: asNumber(item.score_100),
        mandatory_count: asNumber(item.mandatory_count) ?? 0,
        mapped_count: asNumber(item.mapped_count) ?? 0,
        ok_count: asNumber(item.ok_count) ?? 0,
        minor_count: asNumber(item.minor_count) ?? 0,
        not_ok_count: asNumber(item.not_ok_count) ?? 0,
        incomplete_count: asNumber(item.incomplete_count) ?? 0,
        not_mapped_count: asNumber(item.not_mapped_count) ?? 0,
      } satisfies PmpArea15PhaseSummary;
    }),
    controls: controlRows.map((entry) => {
      const item = safeObject(entry);
      return {
        control_id: asString(item.control_id).trim() || "UNDEFINED_CONTROL",
        phase: asString(item.phase).trim() || NA_TEXT,
        title: asString(item.title).trim() || "Untitled control",
        description: asString(item.description).trim() || null,
        mandatory: item.mandatory !== false,
        matched_indicator_count: asNumber(item.matched_indicator_count) ?? 0,
        scored_indicator_count: asNumber(item.scored_indicator_count) ?? 0,
        evidence_ready_count: asNumber(item.evidence_ready_count) ?? 0,
        average_score_0_5: asNumber(item.average_score_0_5),
        score_100: asNumber(item.score_100),
        status: toPmpArea15Status(item.status),
        export_status: asString(item.export_status).trim() || NA_TEXT,
        blockers: Array.isArray(item.blockers)
          ? item.blockers.map((entry) => asString(entry).trim()).filter(Boolean)
          : [],
      } satisfies PmpArea15ControlSummary;
    }),
    mapping_status: {
      configured_control_count: asNumber(mappingStatusRoot.configured_control_count) ?? 0,
      mandatory_control_count: asNumber(mappingStatusRoot.mandatory_control_count) ?? 0,
      mapped_control_count: asNumber(mappingStatusRoot.mapped_control_count) ?? 0,
      unmapped_control_count: asNumber(mappingStatusRoot.unmapped_control_count) ?? 0,
    },
  };
}

export async function fetchReadOnlySummary(projectId: string, periodId: string | null): Promise<ReadOnlySummary> {
  const result = await fetchReadOnlySummaryReadMode(projectId, periodId);
  if (result.mode === "prototype") {
    throw new Error(result.backend_message || "Not available");
  }
  return result.data;
}

function fallbackSummaryFromPrototypeSnapshots(
  projectId: string,
  periodId: string
): {
  data: ReadOnlySummary;
  mode: DataMode;
  backend_message: string | null;
  available: boolean;
} | null {
  const latest = listSnapshotsForPeriod(projectId, periodId)[0] || null;
  if (!latest) return null;

  const totalCount =
    latest.evidence_counts.ACCEPTABLE +
    latest.evidence_counts.NEEDS_REVISION +
    latest.evidence_counts.REJECTED +
    latest.evidence_counts.AWAITING_REVIEW;
  const reviewedCount =
    latest.evidence_counts.ACCEPTABLE +
    latest.evidence_counts.NEEDS_REVISION +
    latest.evidence_counts.REJECTED;
  const coverage = totalCount > 0 ? Math.max(0, Math.min(1, reviewedCount / totalCount)) : null;

  return {
      data: {
        total_score: latest.final_bim_score ?? null,
        confidence: {
        coverage,
        frequency: null,
        confidence: null,
        indicators_with_submission: null,
        total_active_indicators: null,
        total_submission: null,
        target_submission: null,
      },
      breakdown: Array.isArray(latest.breakdown)
        ? latest.breakdown.map((row) => ({
            perspective_id: row.perspective_id,
            score: row.score,
          }))
        : [],
      compliance: null,
    },
    mode: "prototype",
    backend_message: PROTOTYPE_WRITE_DISABLED_MESSAGE,
    available: true,
  };
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
        compliance: null,
      },
      mode: "backend",
      backend_message: "Period is Not available",
      available: false,
    };
  }

  if (!isRealBackendWriteEnabled()) {
    const fallback = fallbackSummaryFromPrototypeSnapshots(projectId, periodId);
    if (fallback) return fallback;
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
        compliance: null,
      },
      mode: "backend",
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
    const complianceRoot = safeObject(root.compliance);
    const compliance = toPmpArea15ComplianceSummary(complianceRoot.pmp_area15);
    return {
      data: {
        total_score: totalScore,
        confidence,
        breakdown,
        compliance,
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
        compliance: null,
      },
      mode: "backend",
      backend_message: e instanceof Error ? e.message : "Invalid backend payload",
      available: false,
    };
  }
}

function normalizeCoverageRatio(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (value <= 1) return Math.max(0, Math.min(1, value));
  return Math.max(0, Math.min(1, value / 100));
}

export function evaluateApprovalGates(input: {
  breakdown: SummaryBreakdownRow[];
  confidence_coverage: number | null;
  evidence_counts: ReviewStatusCount;
  pmp_area15: PmpArea15ComplianceSummary | null;
}): ApprovalGateEvaluation {
  const coverageRatio = normalizeCoverageRatio(input.confidence_coverage);
  const reviewedEvidenceCount =
    input.evidence_counts.ACCEPTABLE +
    input.evidence_counts.NEEDS_REVISION +
    input.evidence_counts.REJECTED;
  const scoredPerspectivesCount = input.breakdown.filter(
    (row) => row.score !== null && Number.isFinite(row.score) && row.score > 0
  ).length;
  const awaitingReviewCount = input.evidence_counts.AWAITING_REVIEW;
  const pmpBridgeAvailable = Boolean(input.pmp_area15);
  const pmpHoldPointReady = input.pmp_area15?.hold_point_ready === true;

  const failures: string[] = [];
  if (!pmpBridgeAvailable) {
    failures.push("Bridge PMP Area 15 belum tersedia.");
  } else if (!pmpHoldPointReady) {
    failures.push(
      `Hold point PMP Area 15 belum ready (status ${input.pmp_area15?.overall_status || NA_TEXT}).`
    );
  }
  if (awaitingReviewCount > 0) {
    failures.push(`Awaiting review harus 0 (saat ini ${awaitingReviewCount})`);
  }
  if (coverageRatio === null || coverageRatio < APPROVAL_GATE_POLICY.min_coverage_ratio) {
    const current = coverageRatio === null ? NA_TEXT : `${Math.round(coverageRatio * 100)}%`;
    failures.push(
      `Coverage minimal ${Math.round(APPROVAL_GATE_POLICY.min_coverage_ratio * 100)}% (saat ini ${current})`
    );
  }
  if (reviewedEvidenceCount < APPROVAL_GATE_POLICY.min_reviewed_evidence) {
    failures.push(
      `Evidence reviewed minimal ${APPROVAL_GATE_POLICY.min_reviewed_evidence} (saat ini ${reviewedEvidenceCount})`
    );
  }
  if (scoredPerspectivesCount < APPROVAL_GATE_POLICY.min_scored_perspectives) {
    failures.push(
      `Perspektif terskor minimal ${APPROVAL_GATE_POLICY.min_scored_perspectives} (saat ini ${scoredPerspectivesCount})`
    );
  }

  return {
    is_eligible: failures.length === 0,
    failures,
    metrics: {
      coverage_ratio: coverageRatio,
      reviewed_evidence_count: reviewedEvidenceCount,
      scored_perspectives_count: scoredPerspectivesCount,
      awaiting_review_count: awaitingReviewCount,
      pmp_bridge_available: pmpBridgeAvailable,
      pmp_hold_point_ready: pmpHoldPointReady,
    },
  };
}

async function fetchDashboardSummaryReadMode(
  projectId: string,
  year: number | null,
  week: number | null
): Promise<{
  data: ReadOnlySummary;
  mode: DataMode;
  backend_message: string | null;
  available: boolean;
}> {
  if (year === null || week === null) {
    return {
      data: {
        total_score: null,
        confidence: null,
        breakdown: [],
        compliance: null,
      },
      mode: "backend",
      backend_message: "Period label is Not available",
      available: false,
    };
  }

  const query = new URLSearchParams({
    project_id: projectId,
    year: String(year),
    week: String(week),
    trend_granularity: "month",
    audit: "true",
  });
  const response = await safeFetchJson<unknown>(
    buildApiUrl(`/summary/v2/bcl/dashboard?${query.toString()}`)
  );
  if (!response.ok) {
    return {
      data: {
        total_score: null,
        confidence: null,
        breakdown: [],
        compliance: null,
      },
      mode: "backend",
      backend_message: toSafeErrorMessage(response),
      available: false,
    };
  }

  try {
    const payload = normalizePayload(response.data);
    const root = safeObject(payload);
    const cards = Array.isArray(root.cards) ? root.cards : [];
    const scoreCard = cards.find((item) => safeObject(item).id === "score");
    const perspectivesCard = cards.find((item) => safeObject(item).id === "perspectives");

    const totalScore =
      asNumber(safeObject(scoreCard).value) ??
      asNumber(root.total_score);

    let breakdown = toSummaryBreakdown(safeObject(perspectivesCard).items);
    if (breakdown.length === 0) {
      breakdown = toSummaryBreakdown(root.perspectives);
    }

    if (totalScore === null && breakdown.length === 0) {
      return {
        data: {
          total_score: null,
          confidence: null,
          breakdown: [],
          compliance: null,
        },
        mode: "backend",
        backend_message: "Dashboard summary not available",
        available: false,
      };
    }

    return {
      data: {
        total_score: totalScore,
        confidence: null,
        breakdown,
        compliance: null,
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
        compliance: null,
      },
      mode: "backend",
      backend_message: e instanceof Error ? e.message : "Invalid dashboard payload",
      available: false,
    };
  }
}

export function getLatestApprovalDecision(projectId: string, periodId: string | null): PrototypeApprovalDecisionRecord | null {
  const periodKey = normalizePrototypePeriodId(periodId);
  return (
    listPrototypeApprovalDecisions()
      .filter(
        (row) =>
          row.project_id === projectId &&
          normalizePrototypePeriodId(row.period_id) === periodKey
      )
      .sort((a, b) => String(b.decided_at).localeCompare(String(a.decided_at)))[0] || null
  );
}

export function listSnapshotsForPeriod(projectId: string, periodId: string | null): PrototypeSnapshotRecord[] {
  const periodKey = normalizePrototypePeriodId(periodId);
  return listPrototypeSnapshots()
    .filter(
      (row) =>
        row.project_id === projectId &&
        normalizePrototypePeriodId(row.period_id) === periodKey
    )
    .sort((a, b) => String(b.approved_at).localeCompare(String(a.approved_at)));
}

export async function fetchApproverHomeContext(): Promise<ApproverHomeContext> {
  const projectsResult = await fetchProjectsReadMode();
  const projects: ProjectRecord[] = projectsResult.data;

  const rows = await Promise.all(
    projects.map(async (project) => {
      const periodsResult = await fetchProjectPeriodsReadMode(project.id);
      const activePeriod = selectPeriodByJakartaDate(periodsResult.data) ?? selectActivePeriod(periodsResult.data);

      const periodId = activePeriod?.id ?? null;
      const backendStatus = activePeriod?.status ?? null;
      const periodStatusLabel = resolvePeriodStatusLabelWithPrototype(project.id, periodId, backendStatus);
      const latestDecision = getLatestApprovalDecision(project.id, periodId);
      const dataMode: DataMode =
        projectsResult.mode === "prototype" || periodsResult.mode === "prototype" ? "prototype" : "backend";

      return {
        project,
        period_id: periodId,
        period_label: activePeriod ? formatPeriodLabel(activePeriod) : NA_TEXT,
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

export async function fetchApproverProjectContext(
  projectId: string,
  periodIdOverride?: string | null
): Promise<ApproverProjectContext> {
  const [projectResult, periodsResult] = await Promise.all([
    fetchProjectReadMode(projectId),
    fetchProjectPeriodsReadMode(projectId),
  ]);

  const project = projectResult.data;
  const periods = periodsResult.data;

  const overrideId = typeof periodIdOverride === "string" && periodIdOverride.trim() ? periodIdOverride.trim() : null;
  const overridePeriod = overrideId ? periods.find((row) => String(row?.id) === overrideId) || null : null;
  const active = overridePeriod ?? selectPeriodByJakartaDate(periods) ?? selectActivePeriod(periods);
  const periodId = active?.id ?? overrideId ?? null;
  const backendStatus = active?.status ?? null;
  const periodStatusLabel = resolvePeriodStatusLabelWithPrototype(projectId, periodId, backendStatus);
  const periodLocked = resolvePeriodLockWithPrototype(projectId, periodId, backendStatus);

  const summaryResult = await fetchReadOnlySummaryReadMode(projectId, periodId);
  let summary: ReadOnlySummary = summaryResult.data;
  let summaryAvailable = summaryResult.available;
  let dashboardSummaryResult: {
    data: ReadOnlySummary;
    mode: DataMode;
    backend_message: string | null;
    available: boolean;
  } = {
    data: {
      total_score: null,
      confidence: null,
      breakdown: [],
      compliance: null,
    },
    mode: "backend",
    backend_message: null,
    available: false,
  };
  let summarySourceMode: DataMode = summaryResult.mode;

  const evidenceResult = await fetchEvidenceListReadMode(projectId, periodId);
  const evidenceCounts = buildReviewStatusCounts(evidenceResult.data);
  const latestDecision = getLatestApprovalDecision(projectId, periodId);
  const snapshots = listSnapshotsForPeriod(projectId, periodId);

  if (!summaryAvailable) {
    dashboardSummaryResult = await fetchDashboardSummaryReadMode(projectId, active?.year ?? null, active?.week ?? null);
    if (dashboardSummaryResult.available) {
      summary = dashboardSummaryResult.data;
      summaryAvailable = true;
      summarySourceMode = dashboardSummaryResult.mode;
    }
  }

  const dataMode: DataMode =
    projectResult.mode === "prototype" ||
    periodsResult.mode === "prototype" ||
    summarySourceMode === "prototype" ||
    evidenceResult.mode === "prototype"
      ? "prototype"
      : "backend";

  const summaryBackendMessage =
    summarySourceMode === "backend"
      ? null
      : dashboardSummaryResult.backend_message || summaryResult.backend_message || null;

  return {
    project,
    period_id: periodId,
    period_version: active?.version ?? null,
    period_label: active ? formatPeriodLabel(active) : NA_TEXT,
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
      summaryBackendMessage ||
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
  summary_confidence_coverage: number | null;
  evidence_counts: ReviewStatusCount;
  pmp_area15: PmpArea15ComplianceSummary | null;
}): Promise<{
  decision_record: PrototypeApprovalDecisionRecord;
  lock_record: ReturnType<typeof getPrototypePeriodLock>;
  snapshot_record: PrototypeSnapshotRecord | null;
}> {
  if (!input.reason.trim()) {
    throw new Error("Reason wajib diisi.");
  }

  if (input.decision === "APPROVE PERIOD") {
    const gates = evaluateApprovalGates({
      breakdown: input.breakdown,
      confidence_coverage: input.summary_confidence_coverage,
      evidence_counts: input.evidence_counts,
      pmp_area15: input.pmp_area15,
    });
    if (!gates.is_eligible) {
      throw new Error(`Tidak dapat APPROVE PERIOD karena gating policy belum terpenuhi: ${gates.failures.join(" | ")}`);
    }
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
  const periodVersion = Number.isInteger(input.period_version) ? input.period_version : 1;

  try {
    if (input.decision === "APPROVE PERIOD") {
      const payload = {
        period_id: periodId,
        reason: input.reason.trim(),
        if_match_version: periodVersion,
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
      if_match_version: periodVersion,
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

