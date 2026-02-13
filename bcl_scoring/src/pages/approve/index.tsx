import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import ApproverLayout from "@/components/ApproverLayout";
import BackendStatusBanner from "@/components/BackendStatusBanner";
import { DataMode } from "@/lib/role1TaskLayer";
import { NA_TEXT } from "@/lib/role1TaskLayer";
import {
  ApproverProjectRow,
  fetchApproverProjectContext,
  fetchApproverHomeContext,
} from "@/lib/approverTaskLayer";

type ApproverInsightRow = {
  row: ApproverProjectRow;
  awaitingReview: number | null;
  needsRevisionCount: number | null;
  totalScore: number | null;
  readinessLabel: string;
  readinessNote: string;
};

export default function ApproverHomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ApproverProjectRow[]>([]);
  const [insightRows, setInsightRows] = useState<ApproverInsightRow[]>([]);
  const [dataMode, setDataMode] = useState<DataMode>("backend");
  const [backendMessage, setBackendMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchApproverHomeContext();
        if (!mounted) return;
        setRows(data.rows);

        const insightList = await Promise.all(
          data.rows.map(async (row) => {
            try {
              const context = await fetchApproverProjectContext(row.project.id);
              const awaitingReview = context.evidence_counts.AWAITING_REVIEW;
              const needsRevisionCount = context.evidence_counts.NEEDS_REVISION;
              const totalScore = context.summary.total_score;
              const readinessLabel =
                row.period_status_label === "LOCKED"
                  ? "Locked"
                  : !row.period_id
                    ? "Period Not available"
                    : awaitingReview > 0
                      ? "Blocked"
                      : context.summary_available
                        ? "Ready"
                        : "Waiting summary";
              const readinessNote =
                row.period_status_label === "LOCKED"
                  ? "Period sudah terkunci"
                  : !row.period_id
                    ? "Admin perlu set period aktif"
                    : awaitingReview > 0
                      ? `${awaitingReview} evidence belum direview`
                      : context.summary_available
                        ? "Approval dapat diproses"
                        : "Summary score belum tersedia";

              return {
                row,
                awaitingReview,
                needsRevisionCount,
                totalScore,
                readinessLabel,
                readinessNote,
              } satisfies ApproverInsightRow;
            } catch {
              return {
                row,
                awaitingReview: null,
                needsRevisionCount: null,
                totalScore: null,
                readinessLabel: row.period_status_label === "LOCKED" ? "Locked" : "Unknown",
                readinessNote: "Detail gate belum tersedia",
              } satisfies ApproverInsightRow;
            }
          })
        );

        if (!mounted) return;
        setInsightRows(insightList);
        setDataMode(data.data_mode);
        setBackendMessage(data.backend_message);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setRows([]);
        setInsightRows([]);
        setDataMode("prototype");
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
  }, []);

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
    () => insightRows.filter((row) => row.readinessLabel === "Ready").length,
    [insightRows]
  );
  const blockedProjects = useMemo(
    () => insightRows.filter((row) => row.readinessLabel === "Blocked").length,
    [insightRows]
  );
  const lockedProjects = useMemo(
    () => rows.filter((row) => row.period_status_label === "LOCKED").length,
    [rows]
  );
  const averageVisibleScore = useMemo(() => {
    const values = insightRows.map((row) => row.totalScore).filter((value): value is number => value !== null);
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [insightRows]);

  return (
    <ApproverLayout
      title="Period Approval"
      subtitle="Approval final di level period berdasarkan summary read-only dan status review evidence."
      projectName={headerProjectLabel}
      periodLabel={headerPeriodLabel}
      periodStatusLabel={headerPeriodStatus}
    >
      <BackendStatusBanner mode={dataMode} message={backendMessage} />

      <section className="task-grid-3" aria-label="Approver operational summary">
        <article className="summary-card">
          <span>Projects in queue</span>
          <strong>{rows.length}</strong>
        </article>
        <article className="summary-card">
          <span>Ready to approve</span>
          <strong>{readyProjects}</strong>
        </article>
        <article className="summary-card">
          <span>Blocked by review</span>
          <strong>{blockedProjects}</strong>
        </article>
        <article className="summary-card">
          <span>Locked periods</span>
          <strong>{lockedProjects}</strong>
        </article>
        <article className="summary-card">
          <span>Average score (visible)</span>
          <strong>{averageVisibleScore === null ? NA_TEXT : averageVisibleScore.toFixed(2)}</strong>
        </article>
      </section>

      <section className="task-panel">
        <p className="inline-note">
          Mulai setelah review selesai -&gt; approve/reject period dengan reason.
        </p>
        <p className="inline-note">Review tidak mengubah skor dan bukan approval period.</p>
        {loading ? <p>Loading...</p> : null}
        {error ? <p className="error-box">{error}</p> : null}

        {!loading && !error && rows.length === 0 ? (
          <p className="empty-state">No projects available.</p>
        ) : null}

        {!loading && !error && rows.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Period</th>
                  <th>Gate Evidence</th>
                  <th>Score</th>
                  <th>Approval Readiness</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {insightRows.map((insight) => (
                  <tr key={insight.row.project.id}>
                    <td>
                      <strong>{insight.row.project.name || insight.row.project.code || NA_TEXT}</strong>
                      <br />
                      <small>Approval status: {insight.row.approval_status || NA_TEXT}</small>
                    </td>
                    <td>
                      {insight.row.period_label || NA_TEXT}
                      <br />
                      <small>Status: {insight.row.period_status_label || NA_TEXT}</small>
                    </td>
                    <td>
                      Awaiting review: {insight.awaitingReview ?? NA_TEXT}
                      <br />
                      <small>Needs revision: {insight.needsRevisionCount ?? NA_TEXT}</small>
                    </td>
                    <td>{insight.totalScore === null ? NA_TEXT : insight.totalScore.toFixed(2)}</td>
                    <td>
                      <strong>{insight.readinessLabel}</strong>
                      <br />
                      <small>{insight.readinessNote}</small>
                    </td>
                    <td>
                      <div className="item-actions">
                        <Link className="revisi" href={`/approve/projects/${insight.row.project.id}`}>
                          Buka Approval
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </ApproverLayout>
  );
}
