import {
  DataMode,
  IndicatorRecord,
  LocalEvidenceItem,
  LocalEvidenceWithReview,
  ProjectRecord,
  ReviewOutcome,
  ScoringPeriod,
  applyPrototypeReview,
  fetchEvidenceListReadMode,
  fetchIndicatorsReadMode,
  fetchProjectPeriodsReadMode,
  fetchProjectReadMode,
  getLocalEvidenceById,
  isRealBackendWriteEnabled,
  listAllLocalEvidenceWithReview,
  listLocalEvidenceWithReview,
  mapEvidenceRowsWithReview,
  resolvePeriodLockWithPrototype,
  resolvePeriodStatusLabelWithPrototype,
  selectActivePeriod,
  selectPeriodByJakartaDate,
  syncReviewedEvidenceFromBackend,
} from "@/lib/role1TaskLayer";
import {
  normalizePrototypePeriodId,
} from "@/lib/prototypeStore";
import {
  BackendWriteError,
  callBackendWrite,
  classifyBackendIssue,
} from "@/lib/backendWriteClient";
import { UNKNOWN_ACTIVE_PERIOD_KEY } from "@/lib/statusModel";
import { getStoredCredential } from "@/lib/userCredential";

export async function fetchIndicatorsStrict(projectId: string): Promise<IndicatorRecord[]> {
  const result = await fetchIndicatorsReadMode(projectId);
  if (result.mode === "prototype") {
    throw new Error(result.backend_message || "Backend not available");
  }
  return result.data;
}

export async function fetchRole2ProjectContext(
  projectId: string,
  periodIdOverride?: string | null
): Promise<{
  project: ProjectRecord;
  active_period: ScoringPeriod | null;
  period_status_label: string;
  period_locked: boolean;
  data_mode: DataMode;
  backend_message: string | null;
}> {
  const credential = getStoredCredential();
  if (credential.role === "role2" && Array.isArray(credential.scoped_project_ids) && credential.scoped_project_ids.length > 0) {
    const allowed = new Set(credential.scoped_project_ids);
    if (!allowed.has(projectId)) {
      throw new Error("Project berada di luar scope role2 yang ditetapkan admin.");
    }
  }

  const [projectResult, periodsResult] = await Promise.all([
    fetchProjectReadMode(projectId),
    fetchProjectPeriodsReadMode(projectId),
  ]);

  const project = projectResult.data;
  const overrideId = typeof periodIdOverride === "string" && periodIdOverride.trim() ? periodIdOverride.trim() : null;
  const overridePeriod =
    overrideId ? periodsResult.data.find((row) => String(row?.id) === overrideId) || null : null;
  const activePeriod =
    overridePeriod ??
    selectPeriodByJakartaDate(periodsResult.data) ??
    selectActivePeriod(periodsResult.data);
  const backendStatus = activePeriod?.status ?? null;
  const dataMode: DataMode =
    projectResult.mode === "prototype" || periodsResult.mode === "prototype" ? "prototype" : "backend";

  return {
    project,
    active_period: activePeriod,
    period_status_label: resolvePeriodStatusLabelWithPrototype(projectId, activePeriod?.id ?? null, backendStatus),
    period_locked: resolvePeriodLockWithPrototype(projectId, activePeriod?.id ?? null, backendStatus),
    data_mode: dataMode,
    backend_message: projectResult.backend_message || periodsResult.backend_message || null,
  };
}

export function listSubmittedEvidenceByProject(
  projectId: string,
  periodId: string | null
): LocalEvidenceWithReview[] {
  return listLocalEvidenceWithReview(projectId, periodId).filter((row) => row.effective_status === "SUBMITTED");
}

export async function fetchSubmittedEvidenceByProjectReadMode(
  projectId: string,
  periodId: string | null
): Promise<{ data: LocalEvidenceWithReview[]; mode: DataMode; backend_message: string | null }> {
  const result = await fetchEvidenceListReadMode(projectId, periodId);
  const mapped = mapEvidenceRowsWithReview(result.data).filter((row) => row.effective_status === "SUBMITTED");
  return {
    data: mapped,
    mode: result.mode,
    backend_message: result.backend_message,
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizePeriodId(periodId: string | null): string {
  const normalized = normalizePrototypePeriodId(periodId);
  if (!normalized || normalized === UNKNOWN_ACTIVE_PERIOD_KEY) {
    throw new Error("Period is Not available");
  }
  return normalized;
}

function normalizeReviewDecisionForApi(outcome: ReviewOutcome): "ACCEPTABLE" | "NEEDS_REVISION" | "REJECTED" {
  if (outcome === "NEEDS REVISION") return "NEEDS_REVISION";
  if (outcome === "REJECTED") return "REJECTED";
  return "ACCEPTABLE";
}

function normalizeWriteError(error: unknown): Error {
  if (error instanceof BackendWriteError) {
    const issue = classifyBackendIssue(error);
    if (issue === "unavailable") return new Error("Backend unavailable");
    return new Error(`HTTP ${error.status ?? 500} ${error.code} - ${error.message}`);
  }
  if (error instanceof Error) return error;
  return new Error("Backend review failed");
}

type ReviewWriteResponse = {
  evidence_id: string;
  review: {
    decision: string;
    reason: string;
    reviewed_at: string;
    reviewer_user_id: string;
  };
  status: string;
  version: number;
};

export async function applyReviewWrite(input: {
  evidence_id: string;
  review_outcome: ReviewOutcome;
  review_reason: string;
  period_id?: string | null;
  if_match_version?: number | null;
  reviewed_by?: string;
}): Promise<LocalEvidenceItem | null> {
  const evidence = getLocalEvidenceById(input.evidence_id);
  if (!isRealBackendWriteEnabled() && !evidence) {
    throw new Error("Evidence context not found.");
  }

  if (!isRealBackendWriteEnabled()) {
    applyPrototypeReview(input);
    return getLocalEvidenceById(input.evidence_id);
  }

  const periodId = normalizePeriodId(
    asString(input.period_id || "").trim() || evidence?.period_id || null
  );
  const ifMatchVersion = asNumber(input.if_match_version) ?? asNumber(evidence?.version);
  if (ifMatchVersion === null) {
    throw new Error("Evidence version is Not available");
  }

  const payload = {
    period_id: periodId,
    evidence_id: input.evidence_id,
    decision: normalizeReviewDecisionForApi(input.review_outcome),
    reason: input.review_reason.trim(),
    if_match_version: ifMatchVersion,
  };

  try {
    const result = await callBackendWrite<ReviewWriteResponse>({
      path: `/periods/${encodeURIComponent(periodId)}/evidences/${encodeURIComponent(input.evidence_id)}/review`,
      method: "POST",
      actorRole: "role2",
      body: payload,
      idempotencyScope: "evidence-review",
      idempotencyPayload: payload,
    });

    return syncReviewedEvidenceFromBackend({
      evidence_id: asString(result.evidence_id),
      decision: asString(result.review?.decision),
      reason: asString(result.review?.reason),
      reviewed_at: asString(result.review?.reviewed_at),
      reviewer_user_id: asString(result.review?.reviewer_user_id),
      status: asString(result.status),
      version: asNumber(result.version) || ifMatchVersion,
    });
  } catch (error) {
    throw normalizeWriteError(error);
  }
}

export function listSubmittedEvidenceAcrossProjects(): Record<string, LocalEvidenceWithReview[]> {
  const all = listAllLocalEvidenceWithReview();
  const grouped: Record<string, LocalEvidenceWithReview[]> = {};

  for (const row of all) {
    if (row.effective_status !== "SUBMITTED") continue;
    if (!grouped[row.project_id]) grouped[row.project_id] = [];
    grouped[row.project_id].push(row);
  }

  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  }

  return grouped;
}

export function listPrototypeProjectRecords(): ProjectRecord[] {
  return [];
}
