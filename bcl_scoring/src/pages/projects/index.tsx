import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

import CorporateTopbar from "@/components/CorporateTopbar";
import HeaderContextCard from "@/components/HeaderContextCard";
import { getPrimaryActionText, useAppLanguage } from "@/lib/language";
import {
  DataMode,
  NA_TEXT,
  ProjectRecord,
  ProjectQueueSummaryRecord,
  ScoringPeriod,
  buildEvidenceCounts,
  fetchEvidenceListReadMode,
  fetchProjectQueueSummaryReadMode,
  fetchProjectPeriodsReadMode,
  fetchProjectsReadMode,
  formatPeriodLabel,
  resolvePeriodStatusLabelWithPrototype,
  selectActivePeriod,
} from "@/lib/role1TaskLayer";
import { useCredential } from "@/lib/useCredential";

type ProjectQueueRow = {
  project: ProjectRecord;
  activePeriod: ScoringPeriod | null;
  periodStatus: string;
  evidenceCounts: ReturnType<typeof buildEvidenceCounts>;
  totalEvidence: number;
  nextAction: string;
  readinessLabel: string;
  dataMode: DataMode;
  backendMessage: string | null;
};

function toNextAction(row: {
  activePeriod: ScoringPeriod | null;
  periodStatus: string;
  evidenceCounts: ReturnType<typeof buildEvidenceCounts>;
}): string {
  if (!row.activePeriod?.id) return "Admin set active period";
  if (row.periodStatus === "LOCKED") return "Read-only (period locked)";
  if (row.evidenceCounts.NEEDS_REVISION > 0) return "Prioritaskan evidence NEEDS REVISION";
  if (row.evidenceCounts.DRAFT > 0) return "Lengkapi draft lalu submit";
  if (row.evidenceCounts.SUBMITTED > 0) return "Monitor hasil review HO";
  return "Mulai tambah evidence";
}

function toReadinessLabel(row: {
  activePeriod: ScoringPeriod | null;
  periodStatus: string;
  evidenceCounts: ReturnType<typeof buildEvidenceCounts>;
}): string {
  if (!row.activePeriod?.id) return "Period Not available";
  if (row.periodStatus === "LOCKED") return "Locked";
  if (row.evidenceCounts.NEEDS_REVISION > 0) return "Revisi required";
  if (row.evidenceCounts.DRAFT > 0) return "Draft in progress";
  if (row.evidenceCounts.SUBMITTED > 0) return "Ready for HO review";
  return "No evidence yet";
}

export default function ProjectsIndexPage() {
  const router = useRouter();
  const credential = useCredential();
  const language = useAppLanguage();
  const actionText = useMemo(() => getPrimaryActionText(language), [language]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ProjectQueueRow[]>([]);
  const [dataMode, setDataMode] = useState<DataMode>("backend");
  const [backendMessage, setBackendMessage] = useState<string | null>(null);
  const role1ScopedProjectIds = useMemo(() => {
    if (credential.role !== "role1") return null;
    const scopedIds = Array.isArray(credential.scoped_project_ids)
      ? credential.scoped_project_ids.map((id) => String(id || "").trim()).filter(Boolean)
      : [];
    return scopedIds;
  }, [credential.role, credential.scoped_project_ids]);
  const scopedProjectSet = useMemo(
    () => new Set(role1ScopedProjectIds || []),
    [role1ScopedProjectIds]
  );
  const scopedProjectId = role1ScopedProjectIds?.[0] || null;

  const sortQueueRows = useCallback((items: ProjectQueueRow[]): ProjectQueueRow[] => {
    const out = [...items];
    out.sort((a, b) => {
      if (credential.role === "role1" && scopedProjectId) {
        const aOwned = a.project.id === scopedProjectId ? 0 : 1;
        const bOwned = b.project.id === scopedProjectId ? 0 : 1;
        if (aOwned !== bOwned) return aOwned - bOwned;
      }
      if (a.evidenceCounts.NEEDS_REVISION !== b.evidenceCounts.NEEDS_REVISION) {
        return b.evidenceCounts.NEEDS_REVISION - a.evidenceCounts.NEEDS_REVISION;
      }
      if (a.evidenceCounts.DRAFT !== b.evidenceCounts.DRAFT) {
        return b.evidenceCounts.DRAFT - a.evidenceCounts.DRAFT;
      }
      return String(a.project.name || a.project.code || a.project.id).localeCompare(
        String(b.project.name || b.project.code || b.project.id)
      );
    });
    return out;
  }, [credential.role, scopedProjectId]);

  const toQueueRowFromSummary = (
    item: ProjectQueueSummaryRecord,
    mode: DataMode,
    backendMessage: string | null
  ): ProjectQueueRow => {
    const periodStatus = resolvePeriodStatusLabelWithPrototype(
      item.project.id,
      item.active_period?.id ?? null,
      item.period_status ?? item.active_period?.status ?? null
    );
    const base = {
      activePeriod: item.active_period,
      periodStatus,
      evidenceCounts: item.evidence_counts,
    };
    return {
      project: item.project,
      activePeriod: item.active_period,
      periodStatus,
      evidenceCounts: item.evidence_counts,
      totalEvidence: Math.max(0, item.total_evidence || 0),
      nextAction: toNextAction(base),
      readinessLabel: toReadinessLabel(base),
      dataMode: mode,
      backendMessage,
    };
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const queueSummaryResult = await fetchProjectQueueSummaryReadMode();
        if (queueSummaryResult.backend_message === null) {
          const mappedRows = queueSummaryResult.data.map((item) =>
            toQueueRowFromSummary(item, queueSummaryResult.mode, queueSummaryResult.backend_message)
          );
          const scopedRows =
            credential.role === "role1"
              ? role1ScopedProjectIds && role1ScopedProjectIds.length > 0
                ? mappedRows.filter((row) => scopedProjectSet.has(row.project.id))
                : []
              : mappedRows;
          const queueRows = sortQueueRows(
            scopedRows
          );
          if (!mounted) return;
          setRows(queueRows);
          setDataMode(queueSummaryResult.mode);
          setBackendMessage(queueSummaryResult.backend_message);
          setError(null);
          return;
        }

        const projectsResult = await fetchProjectsReadMode();
        const projectRows =
          credential.role === "role1"
            ? role1ScopedProjectIds && role1ScopedProjectIds.length > 0
              ? projectsResult.data.filter((project) => scopedProjectSet.has(project.id))
              : []
            : projectsResult.data;

        const fallbackRows = await Promise.all(
          projectRows.map(async (project) => {
            const periodsResult = await fetchProjectPeriodsReadMode(project.id);
            const activePeriod = selectActivePeriod(periodsResult.data);
            const evidenceResult = await fetchEvidenceListReadMode(project.id, activePeriod?.id ?? null);
            const evidenceCounts = buildEvidenceCounts(evidenceResult.data);
            const periodStatus = resolvePeriodStatusLabelWithPrototype(
              project.id,
              activePeriod?.id ?? null,
              activePeriod?.status ?? null
            );
            const rowMode: DataMode =
              projectsResult.mode === "prototype" ||
              periodsResult.mode === "prototype" ||
              evidenceResult.mode === "prototype"
                ? "prototype"
                : "backend";

            const base = {
              activePeriod,
              periodStatus,
              evidenceCounts,
            };

            return {
              project,
              activePeriod,
              periodStatus,
              evidenceCounts,
              totalEvidence: evidenceResult.data.length,
              nextAction: toNextAction(base),
              readinessLabel: toReadinessLabel(base),
              dataMode: rowMode,
              backendMessage:
                projectsResult.backend_message ||
                periodsResult.backend_message ||
                evidenceResult.backend_message ||
                null,
            } satisfies ProjectQueueRow;
          })
        );

        if (!mounted) return;
        const queueRows = sortQueueRows(fallbackRows);

        setRows(queueRows);
        setDataMode(
          projectsResult.mode === "prototype" || queueRows.some((row) => row.dataMode === "prototype")
            ? "prototype"
            : "backend"
        );
        setBackendMessage(
          projectsResult.backend_message ||
            queueRows.map((row) => row.backendMessage).find((item) => Boolean(item)) ||
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
  }, [
    credential.role,
    credential.scoped_project_ids,
    role1ScopedProjectIds,
    scopedProjectId,
    scopedProjectSet,
    sortQueueRows,
  ]);

  const totalProjects = rows.length;
  const projectsNeedAction = useMemo(
    () => rows.filter((row) => row.evidenceCounts.NEEDS_REVISION > 0 || row.evidenceCounts.DRAFT > 0).length,
    [rows]
  );
  const totalSubmitted = useMemo(
    () => rows.reduce((sum, row) => sum + row.evidenceCounts.SUBMITTED, 0),
    [rows]
  );
  const totalNeedsRevision = useMemo(
    () => rows.reduce((sum, row) => sum + row.evidenceCounts.NEEDS_REVISION, 0),
    [rows]
  );
  const firstNeedsRevisionProjectId = useMemo(
    () => rows.find((row) => row.evidenceCounts.NEEDS_REVISION > 0)?.project.id || null,
    [rows]
  );
  const firstDraftProjectId = useMemo(
    () => rows.find((row) => row.evidenceCounts.DRAFT > 0)?.project.id || null,
    [rows]
  );
  const firstSubmittedProjectId = useMemo(
    () => rows.find((row) => row.evidenceCounts.SUBMITTED > 0)?.project.id || null,
    [rows]
  );
  const firstActionProjectId = useMemo(() => {
    return firstNeedsRevisionProjectId || firstDraftProjectId || null;
  }, [firstDraftProjectId, firstNeedsRevisionProjectId]);
  const primaryAddProjectId = useMemo(() => {
    if (credential.role === "role1") return scopedProjectId;
    return firstActionProjectId || rows[0]?.project.id || null;
  }, [credential.role, firstActionProjectId, rows, scopedProjectId]);
  const role1WorkspaceLabel = useMemo(() => {
    if (credential.role !== "role1") return null;

    if (scopedProjectId) {
      const scopedRow = rows.find((row) => row.project.id === scopedProjectId);
      return scopedRow?.project.name || scopedRow?.project.code || scopedProjectId;
    }

    const firstRow = rows[0];
    if (!firstRow) return null;
    return firstRow.project.name || firstRow.project.code || firstRow.project.id;
  }, [credential.role, rows, scopedProjectId]);
  const headerTitle = role1WorkspaceLabel ? `Projects - ${role1WorkspaceLabel}` : "Projects";
  const connectionLabel =
    dataMode === "backend"
      ? "Connected (live data)"
      : backendMessage
        ? "Read mode fallback"
        : "Read mode fallback";
  const contextItems = [
    { label: "Workspace scope", value: role1WorkspaceLabel || "All workspaces" },
    { label: "Need action", value: String(projectsNeedAction) },
    { label: "Submitted evidence", value: String(totalSubmitted) },
  ];
  const openProjectTask = (targetProjectId: string) => {
    void router.push(`/projects/${targetProjectId}`);
  };

  return (
    <main className="task-shell page-corporate-shell">
      <CorporateTopbar connectionLabel={connectionLabel} connectionTone={dataMode === "backend" ? "open" : "lock"} />

      <header className="task-header role-hero role-hero-role1 page-hero-card">
        <div className="role-hero-grid">
          <div className="role-hero-main">
            <p className="task-kicker">BIM Coordinator Project</p>
            <h1>{headerTitle}</h1>
            <p className="task-subtitle">Prioritas utama: tambah evidence pada workspace Anda, lalu monitor queue lintas project.</p>
            {credential.role === "role1" && !scopedProjectId ? (
              <p className="warning-box">Workspace input Role 1 Anda belum ditetapkan admin. Saat ini mode hanya read-only.</p>
            ) : null}
            <div className="landing-chip-row">
              <span className="status-chip status-na">Total projects: {totalProjects}</span>
              <span className="status-chip status-na">Need action: {projectsNeedAction}</span>
            </div>
            <div className="wizard-actions">
              {primaryAddProjectId ? (
                <Link href={`/projects/${primaryAddProjectId}/evidence/add`} className="primary-cta">
                  {actionText.addEvidenceNow}
                </Link>
              ) : (
                <a href="#project-list" className="primary-cta">
                  {actionText.viewWorkspace}
                </a>
              )}
              <a href="#project-list">{actionText.viewAllWorkspaces}</a>
              <Link href="/projects">{actionText.refreshList}</Link>
            </div>
          </div>

          <HeaderContextCard title="Reporting Context" items={contextItems} />
        </div>
      </header>

      <section className="task-grid-3" aria-label="Role 1 operational summary">
        <article className="summary-card">
          <span>Total Projects</span>
          <strong>{totalProjects}</strong>
          <small>All active projects in scope</small>
        </article>

        {firstActionProjectId ? (
          <Link className="summary-card summary-card-action" href={`/projects/${firstActionProjectId}`}>
            <span>Need Action (Draft/Revisi)</span>
            <strong>{projectsNeedAction}</strong>
            <small>Open top-priority project</small>
          </Link>
        ) : (
          <article className="summary-card">
            <span>Need Action (Draft/Revisi)</span>
            <strong>{projectsNeedAction}</strong>
            <small>No immediate action detected</small>
          </article>
        )}

        {firstSubmittedProjectId ? (
          <Link className="summary-card summary-card-action" href={`/projects/${firstSubmittedProjectId}/evidence#submitted`}>
            <span>Submitted Evidence</span>
            <strong>{totalSubmitted}</strong>
            <small>See submitted/reviewed bucket</small>
          </Link>
        ) : (
          <article className="summary-card">
            <span>Submitted Evidence</span>
            <strong>{totalSubmitted}</strong>
            <small>No submitted evidence yet</small>
          </article>
        )}

        {firstNeedsRevisionProjectId ? (
          <Link className="summary-card summary-card-action" href={`/projects/${firstNeedsRevisionProjectId}/evidence#needs-revision`}>
            <span>Needs Revision</span>
            <strong>{totalNeedsRevision}</strong>
            <small>Fix evidence requiring revision</small>
          </Link>
        ) : (
          <article className="summary-card">
            <span>Needs Revision</span>
            <strong>{totalNeedsRevision}</strong>
            <small>No revision pending</small>
          </article>
        )}
      </section>

      <section className="task-panel" id="project-list">
        {loading && <p>Loading...</p>}
        {error && <p className="error-box">{error}</p>}

        {!loading && !error && rows.length === 0 && (
          <div className="empty-state">
            <p>Not available</p>
            <p>Hubungi admin untuk menambahkan proyek.</p>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="admin-table-wrap">
            <p className="inline-note">Klik satu baris project/workspace untuk membuka halaman Evidence Tasks.</p>
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Active Period</th>
                  <th>Queue</th>
                  <th>Readiness</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.project.id}
                    className="table-row-clickable"
                    role="link"
                    tabIndex={0}
                    onClick={() => openProjectTask(row.project.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openProjectTask(row.project.id);
                      }
                    }}
                    aria-label={`Open Evidence Tasks for ${row.project.name || row.project.code || row.project.id}`}
                  >
                    <td>
                      <strong>{row.project.name || row.project.code || NA_TEXT}</strong>
                      <br />
                      <small>Code: {row.project.code || NA_TEXT} | Phase: {row.project.phase || NA_TEXT}</small>
                    </td>
                    <td>
                      {formatPeriodLabel(row.activePeriod)}
                      <br />
                      <small>Status: {row.periodStatus}</small>
                    </td>
                    <td>
                      Draft: {row.evidenceCounts.DRAFT} | Submitted: {row.evidenceCounts.SUBMITTED} | Revisi: {row.evidenceCounts.NEEDS_REVISION}
                      <br />
                      <small>Total evidence: {row.totalEvidence}</small>
                    </td>
                    <td>
                      <strong>{row.readinessLabel}</strong>
                      <br />
                      <small>{row.nextAction}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
