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
} from "@/lib/role1TaskLayer";
import {
  fetchSubmittedEvidenceByProjectReadMode,
  listPrototypeProjectRecords,
} from "@/lib/role2TaskLayer";
import { getPrototypePeriodMetaFromStore, listPrototypePeriodIdsByProjectFromStore } from "@/lib/prototypeStore";

type ProjectReviewRow = {
  project: ProjectRecord;
  submitted_count: number;
  period_label: string;
  period_status: string;
  data_mode: DataMode;
  backend_message: string | null;
};

export default function HoReviewHomePage() {
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
        if (projects.length === 0) {
          projects = listPrototypeProjectRecords();
        }

        const periodResults = await Promise.all(
          projects.map(async (project) => {
            const periodsResult = await fetchProjectPeriodsReadMode(project.id);
            const active = periodsResult.data[0] ?? null;
            const fallbackPeriodId = listPrototypePeriodIdsByProjectFromStore(project.id)[0] || null;
            const periodId = active?.id ?? fallbackPeriodId;
            const periodMeta = getPrototypePeriodMetaFromStore(project.id, periodId);
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
              period_label: active ? formatPeriodLabel(active) : periodMeta?.period_label || NA_TEXT,
              period_status: resolvePeriodStatusLabelWithPrototype(
                project.id,
                periodId,
                active?.status ?? null
              ),
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
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const totalSubmitted = useMemo(
    () => rows.reduce((sum, row) => sum + row.submitted_count, 0),
    [rows]
  );
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
        <article className="summary-card">
          <span>Projects needing review</span>
          <strong>{rows.length}</strong>
        </article>
        <article className="summary-card">
          <span>Submitted evidence</span>
          <strong>{totalSubmitted}</strong>
        </article>
      </section>

      <section className="task-panel">
        <p className="inline-note">
          BIM Coordinator HO memproses evidence SUBMITTED -&gt; tetapkan ACCEPTABLE/NEEDS REVISION/REJECTED dengan reason.
        </p>
        <p className="inline-note">Review tidak mengubah skor dan bukan approval period.</p>
        <p className="prototype-badge">Prototype review (not final, not used in scoring)</p>

        {loading ? <p>Loading...</p> : null}
        {error ? <p className="error-box">{error}</p> : null}

        {!loading && !error && rows.length === 0 ? (
          <p className="empty-state">No submitted evidence in prototype store.</p>
        ) : null}

        {!loading && !error && rows.length > 0 ? (
          <div className="evidence-list">
            {rows.map((row) => (
              <article className="evidence-item" key={row.project.id}>
                <p>
                  <strong>{row.project.name || row.project.code || NA_TEXT}</strong>
                </p>
                <p>Submitted evidence: {row.submitted_count}</p>
                <p>
                  Active period: {row.period_label} | Period status: {row.period_status}
                </p>
                <div className="item-actions">
                  <Link className="revisi" href={`/ho/review/projects/${row.project.id}`}>
                    Review Evidence
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </Role2Layout>
  );
}

