import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import ApproverLayout from "@/components/ApproverLayout";
import InfoTooltip from "@/components/InfoTooltip";
import { DataMode } from "@/lib/role1TaskLayer";
import { NA_TEXT } from "@/lib/role1TaskLayer";
import {
  ApproverProjectRow,
  evaluateApprovalGates,
  fetchApproverProjectContext,
  fetchApproverHomeContext,
} from "@/lib/approverTaskLayer";
import { useCredential } from "@/lib/useCredential";

type ApprovalQueueFilter = "ready" | "blocked" | "waiting" | "locked" | "all";
type ApprovalReadinessKind = "ready" | "blocked" | "waiting" | "locked";

type ApproverInsightRow = {
  row: ApproverProjectRow;
  awaitingReview: number | null;
  needsRevisionCount: number | null;
  totalScore: number | null;
  gateFailures: string[];
  readinessKind: ApprovalReadinessKind;
  readinessLabel: string;
  readinessNote: string;
};

function readinessSortValue(kind: ApprovalReadinessKind): number {
  if (kind === "ready") return 0;
  if (kind === "blocked") return 1;
  if (kind === "waiting") return 2;
  return 3;
}

export default function ApproverHomePage() {
  const router = useRouter();
  const credential = useCredential();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ApproverProjectRow[]>([]);
  const [insightRows, setInsightRows] = useState<ApproverInsightRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<ApprovalQueueFilter>("ready");
  const [dataMode, setDataMode] = useState<DataMode>("backend");
  const [backendMessage, setBackendMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchApproverHomeContext();
        const sourceRows =
          credential.role === "role3" &&
          Array.isArray(credential.scoped_project_ids) &&
          credential.scoped_project_ids.length > 0
            ? data.rows.filter((row) => credential.scoped_project_ids?.includes(row.project.id))
            : data.rows;
        if (!mounted) return;
        setRows(sourceRows);

        const insightList = await Promise.all(
          sourceRows.map(async (row) => {
            try {
              const context = await fetchApproverProjectContext(row.project.id);
              const awaitingReview = context.evidence_counts.AWAITING_REVIEW;
              const needsRevisionCount = context.evidence_counts.NEEDS_REVISION;
              const totalScore = context.summary.total_score;
              const gate = evaluateApprovalGates({
                breakdown: context.summary.breakdown,
                confidence_coverage: context.summary.confidence?.coverage ?? null,
                evidence_counts: context.evidence_counts,
                pmp_area15: context.summary.compliance,
              });
              const readinessKind: ApprovalReadinessKind =
                row.period_status_label === "LOCKED"
                  ? "locked"
                  : !row.period_id || !context.summary_available
                    ? "waiting"
                    : gate.is_eligible
                      ? "ready"
                      : "blocked";
              const readinessLabel =
                readinessKind === "locked"
                  ? "Locked"
                  : readinessKind === "ready"
                    ? "Ready for decision"
                    : readinessKind === "blocked"
                      ? "Blocked"
                      : !row.period_id
                        ? "No active package"
                        : "Waiting summary";
              const readinessNote =
                readinessKind === "locked"
                  ? "Period sudah terkunci"
                  : !row.period_id
                    ? "Admin perlu set period aktif"
                    : readinessKind === "ready"
                      ? "Buka decision package"
                      : !context.summary_available
                        ? "Summary score belum tersedia"
                        : gate.failures[0] || `${awaitingReview} evidence belum direview`;

              return {
                row,
                awaitingReview,
                needsRevisionCount,
                totalScore,
                gateFailures: gate.failures,
                readinessKind,
                readinessLabel,
                readinessNote,
              } satisfies ApproverInsightRow;
            } catch {
              return {
                row,
                awaitingReview: null,
                needsRevisionCount: null,
                totalScore: null,
                gateFailures: ["Detail gate belum tersedia"],
                readinessKind: row.period_status_label === "LOCKED" ? "locked" : "waiting",
                readinessLabel: row.period_status_label === "LOCKED" ? "Locked" : "Unknown",
                readinessNote: "Detail gate belum tersedia",
              } satisfies ApproverInsightRow;
            }
          })
        );

        if (!mounted) return;
        setInsightRows(
          insightList.sort((a, b) => {
            const byReadiness = readinessSortValue(a.readinessKind) - readinessSortValue(b.readinessKind);
            if (byReadiness !== 0) return byReadiness;
            return String(a.row.project.name || a.row.project.code || a.row.project.id).localeCompare(
              String(b.row.project.name || b.row.project.code || b.row.project.id)
            );
          })
        );
        setDataMode(data.data_mode);
        setBackendMessage(data.backend_message);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setRows([]);
        setInsightRows([]);
        setDataMode("backend");
        setBackendMessage(e instanceof Error ? e.message : "Backend not available");
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    const refresh = () => {
      load();
    };

    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      mounted = false;
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [credential.role, credential.scoped_project_ids]);

  const headerProjectLabel = useMemo(() => {
    if (loading) return "Loading approval queue...";
    if (rows.length === 0) return "No project pending approval";
    if (rows.length === 1) return rows[0].project.name || rows[0].project.code || "1 project pending approval";
    return `${rows.length} projects pending approval`;
  }, [loading, rows]);

  const headerPeriodLabel = useMemo(() => {
    if (loading) return "Checking active period...";
    if (rows.length === 0) return "No active period";
    const labels = [...new Set(rows.map((row) => row.period_label).filter((value) => value && value !== NA_TEXT))];
    if (labels.length === 1) return labels[0];
    if (labels.length > 1) return `${labels.length} active periods (multi-project)`;
    return "Not synced";
  }, [loading, rows]);

  const headerPeriodStatus = useMemo(() => {
    if (loading) return "Syncing...";
    if (rows.length === 0) return "No submitted evidence";
    const statuses = [
      ...new Set(rows.map((row) => row.period_status_label).filter((value) => value && value !== NA_TEXT)),
    ];
    if (statuses.length === 1) return statuses[0];
    if (statuses.length > 1) return "Mixed";
    return "Not synced";
  }, [loading, rows]);

  const readyProjects = useMemo(
    () => insightRows.filter((row) => row.readinessKind === "ready").length,
    [insightRows]
  );
  const blockedProjects = useMemo(
    () => insightRows.filter((row) => row.readinessKind === "blocked").length,
    [insightRows]
  );
  const lockedProjects = useMemo(
    () => insightRows.filter((row) => row.readinessKind === "locked").length,
    [insightRows]
  );
  const waitingProjects = useMemo(
    () => insightRows.filter((row) => row.readinessKind === "waiting").length,
    [insightRows]
  );
  const averageVisibleScore = useMemo(() => {
    const values = insightRows.map((row) => row.totalScore).filter((value): value is number => value !== null);
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [insightRows]);

  const firstProjectId = useMemo(() => rows[0]?.project.id || null, [rows]);
  const firstReadyProjectId = useMemo(
    () => insightRows.find((row) => row.readinessKind === "ready")?.row.project.id || null,
    [insightRows]
  );
  const firstBlockedProjectId = useMemo(
    () => insightRows.find((row) => row.readinessKind === "blocked")?.row.project.id || null,
    [insightRows]
  );
  const visibleRows = useMemo(() => {
    if (activeFilter === "all") return insightRows;
    return insightRows.filter((row) => row.readinessKind === activeFilter);
  }, [activeFilter, insightRows]);
  const openProjectApproval = (targetProjectId: string) => {
    void router.push(`/approve/projects/${targetProjectId}`);
  };

  return (
    <ApproverLayout
      title="Approval Package"
      subtitle="Paket keputusan final untuk score window aktif: cek blocker, buka package siap putuskan, lalu lock snapshot."
      projectName={headerProjectLabel}
      periodLabel={headerPeriodLabel}
      periodStatusLabel={headerPeriodStatus}
      backendMode={dataMode}
      backendMessage={backendMessage}
    >
      <section className="task-grid-3" aria-label="Approver operational summary">
        {firstProjectId ? (
          <Link className="summary-card summary-card-action" href={`/approve/projects/${firstProjectId}`}>
            <span>Projects in queue</span>
            <strong>{rows.length}</strong>
            <small>Open first project context</small>
          </Link>
        ) : (
          <article className="summary-card">
            <span>Projects in queue</span>
            <strong>{rows.length}</strong>
          </article>
        )}
        {firstReadyProjectId ? (
          <Link className="summary-card summary-card-action" href={`/approve/projects/${firstReadyProjectId}/decision`}>
            <span>Ready for decision</span>
            <strong>{readyProjects}</strong>
            <small>Open first ready package</small>
          </Link>
        ) : (
          <article className="summary-card">
            <span>Ready for decision</span>
            <strong>{readyProjects}</strong>
          </article>
        )}
        {firstBlockedProjectId ? (
          <Link className="summary-card summary-card-action" href={`/approve/projects/${firstBlockedProjectId}/awaiting-review`}>
            <span>Blocked packages</span>
            <strong>{blockedProjects}</strong>
            <small>See first blocker queue</small>
          </Link>
        ) : (
          <article className="summary-card">
            <span>Blocked packages</span>
            <strong>{blockedProjects}</strong>
          </article>
        )}
        {firstProjectId ? (
          <Link className="summary-card summary-card-action" href={`/approve/projects/${firstProjectId}`}>
            <span>Locked periods</span>
            <strong>{lockedProjects}</strong>
            <small>Review lock status</small>
          </Link>
        ) : (
          <article className="summary-card">
            <span>Locked periods</span>
            <strong>{lockedProjects}</strong>
          </article>
        )}
        <article className="summary-card">
          <span>Waiting data</span>
          <strong>{waitingProjects}</strong>
          <small>Missing active period or summary</small>
        </article>
        <article className="summary-card">
          <span>Average score (visible)</span>
          <strong>{averageVisibleScore === null ? NA_TEXT : averageVisibleScore.toFixed(2)}</strong>
          <small>Across visible summaries</small>
        </article>
      </section>

      <section className="task-panel">
        <div className="task-panel-inline-help">
          <InfoTooltip
            id="role3-home-approval-info"
            label="Informasi alur approval Role 3"
            lines={[
              "BIM Manager memproses approve/reject period setelah review evidence selesai.",
              "Review tidak mengubah skor dan bukan approval period.",
              "Sumber data approval/summary: database backend.",
            ]}
          />
        </div>
        {loading ? <p>Loading...</p> : null}
        {error ? <p className="error-box">{error}</p> : null}

        {!loading && !error && rows.length === 0 ? (
          <p className="empty-state">No approval packages available in your scope.</p>
        ) : null}

        {!loading && !error && rows.length > 0 ? (
          <div className="approval-cockpit">
            <div className="approval-cockpit-toolbar" role="tablist" aria-label="Approval package queue filter">
              {([
                ["ready", `Ready (${readyProjects})`],
                ["blocked", `Blocked (${blockedProjects})`],
                ["waiting", `Waiting (${waitingProjects})`],
                ["locked", `Locked (${lockedProjects})`],
                ["all", `All (${insightRows.length})`],
              ] as Array<[ApprovalQueueFilter, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={activeFilter === value ? "approval-filter-active" : ""}
                  onClick={() => setActiveFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {visibleRows.length === 0 ? (
              <p className="empty-state">Tidak ada package pada queue ini.</p>
            ) : null}
            {visibleRows.length > 0 ? (
            <div className="admin-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Period</th>
                  <th>Gate blocker</th>
                  <th>Score</th>
                  <th>Next action</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((insight) => (
                  <tr
                    key={insight.row.project.id}
                    className="table-row-clickable"
                    role="link"
                    tabIndex={0}
                    onClick={() => openProjectApproval(insight.row.project.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openProjectApproval(insight.row.project.id);
                      }
                    }}
                    aria-label={`Open approval context for ${
                      insight.row.project.name || insight.row.project.code || insight.row.project.id
                    }`}
                  >
                    <td>
                      <strong>{insight.row.project.name || insight.row.project.code || NA_TEXT}</strong>
                      <br />
                      <small>Package status: {insight.row.approval_status || NA_TEXT}</small>
                    </td>
                    <td>
                      {insight.row.period_label || NA_TEXT}
                      <br />
                      <small>Status: {insight.row.period_status_label || NA_TEXT}</small>
                    </td>
                    <td>
                      {insight.gateFailures[0] || "No blocker"}
                      <br />
                      <small>
                        Awaiting: {insight.awaitingReview ?? NA_TEXT} | Revision: {insight.needsRevisionCount ?? NA_TEXT}
                      </small>
                    </td>
                    <td>{insight.totalScore === null ? NA_TEXT : insight.totalScore.toFixed(2)}</td>
                    <td>
                      <strong>{insight.readinessLabel}</strong>
                      <br />
                      <small>{insight.readinessNote}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </ApproverLayout>
  );
}
