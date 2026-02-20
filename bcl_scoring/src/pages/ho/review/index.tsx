import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import BackendStatusBanner from "@/components/BackendStatusBanner";
import Role2Layout from "@/components/Role2Layout";
import {
  DataMode,
  NA_TEXT,
  ProjectRecord,
  formatPeriodLabel,
  fetchProjectPeriodsReadMode,
  fetchProjectsReadMode,
  resolvePeriodStatusLabelWithPrototype,
  selectActivePeriod,
  selectPeriodByJakartaDate,
} from "@/lib/role1TaskLayer";
import { fetchSubmittedEvidenceByProjectReadMode } from "@/lib/role2TaskLayer";
import { useCredential } from "@/lib/useCredential";

type ProjectReviewRow = {
  project: ProjectRecord;
  submitted_count: number;
  period_label: string;
  period_status: string;
  queue_level: "High" | "Medium" | "Low";
  recommended_action: string;
  data_mode: DataMode;
  backend_message: string | null;
};

function resolveQueueLevel(submittedCount: number): "High" | "Medium" | "Low" {
  if (submittedCount >= 12) return "High";
  if (submittedCount >= 5) return "Medium";
  return "Low";
}

function resolveRecommendedAction(params: {
  submittedCount: number;
  periodStatus: string;
  queueLevel: "High" | "Medium" | "Low";
}): string {
  if (params.periodStatus === "LOCKED") return "Read-only (period locked)";
  if (params.submittedCount === 0) return "Tidak ada evidence submitted";
  if (params.queueLevel === "High") return "Prioritaskan review batch terbesar";
  if (params.queueLevel === "Medium") return "Review rutin dan jaga SLA";
  return "Quick review, close queue cepat";
}

export default function HoReviewHomePage() {
  const credential = useCredential();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ProjectReviewRow[]>([]);
  const [dataMode, setDataMode] = useState<DataMode>("backend");
  const [backendMessage, setBackendMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        const projectsResult = await fetchProjectsReadMode();
        let projects = projectsResult.data;
        if (credential.role === "role2" && Array.isArray(credential.scoped_project_ids) && credential.scoped_project_ids.length > 0) {
          const allowed = new Set(credential.scoped_project_ids);
          projects = projects.filter((project) => allowed.has(project.id));
        }

        const periodResults = await Promise.all(
          projects.map(async (project) => {
            const periodsResult = await fetchProjectPeriodsReadMode(project.id);
            const active = selectPeriodByJakartaDate(periodsResult.data) ?? selectActivePeriod(periodsResult.data);
            const periodId = active?.id ?? null;
            const evidenceResult = await fetchSubmittedEvidenceByProjectReadMode(project.id, periodId);
            const rowMode: DataMode =
              projectsResult.mode === "prototype" ||
              periodsResult.mode === "prototype" ||
              evidenceResult.mode === "prototype"
                ? "prototype"
                : "backend";

            return {
              project,
              submitted_count: evidenceResult.data.length,
              period_label: active ? formatPeriodLabel(active) : NA_TEXT,
              period_status: resolvePeriodStatusLabelWithPrototype(
                project.id,
                periodId,
                active?.status ?? null
              ),
              queue_level: resolveQueueLevel(evidenceResult.data.length),
              recommended_action: resolveRecommendedAction({
                submittedCount: evidenceResult.data.length,
                periodStatus: resolvePeriodStatusLabelWithPrototype(
                  project.id,
                  periodId,
                  active?.status ?? null
                ),
                queueLevel: resolveQueueLevel(evidenceResult.data.length),
              }),
              data_mode: rowMode,
              backend_message:
                periodsResult.backend_message ||
                evidenceResult.backend_message ||
                projectsResult.backend_message ||
                null,
            } satisfies ProjectReviewRow;
          })
        );

        if (!mounted) return;

        const filteredRows = periodResults
          .filter((row) => row.submitted_count > 0)
          .sort((a, b) => b.submitted_count - a.submitted_count);
        setRows(filteredRows);

        const hasPrototype =
          projectsResult.mode === "prototype" || filteredRows.some((row) => row.data_mode === "prototype");
        setDataMode(hasPrototype ? "prototype" : "backend");
        setBackendMessage(
          projectsResult.backend_message ||
            filteredRows.map((row) => row.backend_message).find((msg) => Boolean(msg)) ||
            null
        );
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setRows([]);
        setDataMode("backend");
        setBackendMessage(e instanceof Error ? e.message : "Backend not available");
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [credential.role, credential.scoped_project_ids]);

  const totalSubmitted = useMemo(
    () => rows.reduce((sum, row) => sum + row.submitted_count, 0),
    [rows]
  );
  const highQueueProjects = useMemo(
    () => rows.filter((row) => row.queue_level === "High").length,
    [rows]
  );
  const averageSubmittedPerProject = useMemo(() => {
    if (rows.length === 0) return 0;
    return totalSubmitted / rows.length;
  }, [rows, totalSubmitted]);
  const lockedProjects = useMemo(
    () => rows.filter((row) => row.period_status === "LOCKED").length,
    [rows]
  );
  const firstProjectId = useMemo(() => rows[0]?.project.id || null, [rows]);
  const firstHighQueueId = useMemo(
    () => rows.find((row) => row.queue_level === "High")?.project.id || null,
    [rows]
  );
  const scopedProjectSummary = useMemo(() => {
    if (!Array.isArray(credential.scoped_project_ids) || credential.scoped_project_ids.length === 0) {
      return "Semua workspace";
    }
    return credential.scoped_project_ids.join(", ");
  }, [credential.scoped_project_ids]);
  const headerProjectLabel = useMemo(() => {
    if (loading) return "Loading review queue...";
    if (rows.length === 0) return "No project pending review";
    if (rows.length === 1) return rows[0].project.name || rows[0].project.code || "1 project pending review";
    return `${rows.length} projects pending review`;
  }, [loading, rows]);
  const headerActivePeriodLabel = useMemo(() => {
    if (loading) return "Checking active period...";
    if (rows.length === 0) return "No active period with submitted evidence";
    const labels = [...new Set(rows.map((row) => row.period_label).filter((label) => label && label !== NA_TEXT))];
    if (labels.length === 1) return labels[0];
    return `${labels.length} active periods (multi-project)`;
  }, [loading, rows]);
  const headerPeriodStatusLabel = useMemo(() => {
    if (loading) return "Syncing...";
    if (rows.length === 0) return "No submitted evidence";
    const statuses = [...new Set(rows.map((row) => row.period_status).filter((status) => status && status !== NA_TEXT))];
    if (statuses.length === 1) return statuses[0];
    if (statuses.length > 1) return "Mixed";
    return "Not synced";
  }, [loading, rows]);

  return (
    <Role2Layout
      title="Evidence Review - HO"
      subtitle="Review eligibility untuk evidence yang disubmit proyek."
      periodStatusLabel={headerPeriodStatusLabel}
      projectLabel={headerProjectLabel}
      activePeriodLabel={headerActivePeriodLabel}
      activePeriod={null}
      project={null}
    >
      <BackendStatusBanner mode={dataMode} message={backendMessage} />

      <section className="task-grid-3" aria-label="HO review summary">
        {firstProjectId ? (
          <Link className="summary-card summary-card-action" href={`/ho/review/projects/${firstProjectId}`}>
            <span>Projects needing review</span>
            <strong>{rows.length}</strong>
            <small>Open top queue project</small>
          </Link>
        ) : (
          <article className="summary-card">
            <span>Projects needing review</span>
            <strong>{rows.length}</strong>
          </article>
        )}
        {firstProjectId ? (
          <Link className="summary-card summary-card-action" href={`/ho/review/projects/${firstProjectId}`}>
            <span>Submitted evidence</span>
            <strong>{totalSubmitted}</strong>
            <small>Start review from top queue</small>
          </Link>
        ) : (
          <article className="summary-card">
            <span>Submitted evidence</span>
            <strong>{totalSubmitted}</strong>
          </article>
        )}
        {firstHighQueueId ? (
          <Link className="summary-card summary-card-action" href={`/ho/review/projects/${firstHighQueueId}`}>
            <span>High queue projects</span>
            <strong>{highQueueProjects}</strong>
            <small>Jump to High priority</small>
          </Link>
        ) : (
          <article className="summary-card">
            <span>High queue projects</span>
            <strong>{highQueueProjects}</strong>
          </article>
        )}
        <article className="summary-card">
          <span>Avg submitted / project</span>
          <strong>{averageSubmittedPerProject.toFixed(1)}</strong>
          <small>Queue load benchmark</small>
        </article>
        {firstProjectId ? (
          <Link className="summary-card summary-card-action" href={`/ho/review/projects/${firstProjectId}`}>
            <span>Locked periods</span>
            <strong>{lockedProjects}</strong>
            <small>See lock status per project</small>
          </Link>
        ) : (
          <article className="summary-card">
            <span>Locked periods</span>
            <strong>{lockedProjects}</strong>
          </article>
        )}
        <Link className="summary-card summary-card-action" href="/ho/review/proposals">
          <span>BIM Use & Indicator</span>
          <strong>Proposal Queue</strong>
          <small>Ajukan perubahan ke Admin (proposal-only)</small>
        </Link>
      </section>

      <section className="task-panel">
        <p className="inline-note">
          BIM Coordinator HO memproses evidence SUBMITTED -&gt; tetapkan ACCEPTABLE/NEEDS REVISION/REJECTED dengan reason.
        </p>
        <p className="inline-note">Review tidak mengubah skor dan bukan approval period.</p>
        <p className="inline-note">Sumber data review: database backend.</p>

        {loading ? <p>Loading...</p> : null}
        {error ? <p className="error-box">{error}</p> : null}

        {!loading && !error && rows.length === 0 ? (
          <>
            <p className="empty-state">No submitted evidence available.</p>
            <p className="inline-note">
              Scope Role 2 saat ini: <strong>{scopedProjectSummary}</strong>.
              Pastikan evidence sudah <strong>SUBMITTED</strong> oleh Role 1 pada period aktif workspace.
            </p>
          </>
        ) : null}

        {!loading && !error && rows.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Active Period</th>
                  <th>Submitted Queue</th>
                  <th>Priority</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.project.id}>
                    <td>
                      <strong>{row.project.name || row.project.code || NA_TEXT}</strong>
                      <br />
                      <small>Code: {row.project.code || NA_TEXT}</small>
                    </td>
                    <td>
                      {row.period_label}
                      <br />
                      <small>Status: {row.period_status}</small>
                    </td>
                    <td>
                      <strong>{row.submitted_count}</strong>
                      <br />
                      <small>Evidence menunggu review</small>
                    </td>
                    <td>
                      <strong>{row.queue_level}</strong>
                      <br />
                      <small>{row.recommended_action}</small>
                    </td>
                    <td>
                      <div className="item-actions">
                        <Link className="revisi" href={`/ho/review/projects/${row.project.id}`}>
                          Review Evidence
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
    </Role2Layout>
  );
}

