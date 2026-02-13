import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import BackendStatusBanner from "@/components/BackendStatusBanner";
import {
  DataMode,
  NA_TEXT,
  ProjectRecord,
  ScoringPeriod,
  buildEvidenceCounts,
  fetchEvidenceListReadMode,
  fetchProjectPeriodsReadMode,
  fetchProjectsReadMode,
  formatPeriodLabel,
  resolvePeriodStatusLabelWithPrototype,
  selectActivePeriod,
} from "@/lib/role1TaskLayer";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ProjectQueueRow[]>([]);
  const [dataMode, setDataMode] = useState<DataMode>("backend");
  const [backendMessage, setBackendMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const projectsResult = await fetchProjectsReadMode();
        const projectRows = projectsResult.data;
        const queueRows = await Promise.all(
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
        queueRows.sort((a, b) => {
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
        setDataMode("prototype");
        setBackendMessage(e instanceof Error ? e.message : "Backend not available");
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

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

  return (
    <main className="task-shell">
      <header className="task-header role-hero role-hero-role1">
        <div className="role-hero-grid">
          <div className="role-hero-main">
            <p className="task-kicker">BIM Coordinator Project</p>
            <h1>Projects</h1>
            <p className="task-subtitle">Pilih project untuk membuka task layer BIM Coordinator Project.</p>
            <div className="landing-chip-row">
              <span className="status-chip status-na">Total projects: {totalProjects}</span>
              <span className="status-chip status-na">Need action: {projectsNeedAction}</span>
            </div>
            <p className="inline-note">
              Mulai dari proyek -&gt; pilih BIM Use -&gt; submit evidence untuk indikator terkait.
            </p>
            <div className="wizard-actions">
              <a href="#project-list" className="primary-cta">
                Pilih Proyek
              </a>
              <Link href="/projects">Refresh List</Link>
            </div>
          </div>

          <aside className="role-context-panel">
            <div className="role-context-grid">
              <div className="context-card role-context-card">
                <span>Submitted Evidence</span>
                <strong>{totalSubmitted}</strong>
              </div>
              <div className="context-card role-context-card">
                <span>Needs Revision</span>
                <strong>{totalNeedsRevision}</strong>
              </div>
              <div className="context-card role-context-card">
                <span>Data mode</span>
                <strong>{dataMode === "backend" ? "Backend" : "Prototype fallback"}</strong>
              </div>
            </div>
          </aside>
        </div>
      </header>

      <BackendStatusBanner mode={dataMode} message={backendMessage} />

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
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Active Period</th>
                  <th>Queue</th>
                  <th>Readiness</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.project.id}>
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
                    <td>
                      <div className="item-actions">
                        <Link href={`/projects/${row.project.id}`} className="revisi">
                          Open Evidence Tasks
                        </Link>
                        <Link href={`/projects/${row.project.id}/indicators`}>Indicators</Link>
                      </div>
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
