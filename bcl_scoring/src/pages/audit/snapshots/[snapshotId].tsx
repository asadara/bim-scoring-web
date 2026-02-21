import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import AuditorLayout from "@/components/AuditorLayout";
import BackendStatusBanner from "@/components/BackendStatusBanner";
import {
  AuditSnapshotView,
  buildAuditExportPayload,
  buildPrintableAuditSnapshot,
  fetchAuditSnapshotsReadMode,
  getSnapshotLockStatus,
  getSubmittedCountFromSnapshot,
  listDecisionsForSnapshot,
} from "@/lib/auditTaskLayer";
import { generateSnapshotPdfBlob } from "@/lib/auditPdfExport";
import { SummaryConfidence, fetchReadOnlySummaryReadMode } from "@/lib/approverTaskLayer";
import {
  ISO19650_REFERENCE_ONLY_LABEL,
  ISO19650_REFERENCE_ROWS,
} from "@/lib/iso19650Reference";
import {
  DataMode,
  NA_TEXT,
  ProjectRecord,
  ScoringPeriod,
  fetchProjectPeriodsReadMode,
  fetchProjectReadMode,
  formatPeriodLabel,
  formatProjectLabel,
} from "@/lib/role1TaskLayer";
import { isTestWorkspaceProject } from "@/lib/testWorkspace";

const PERSPECTIVES = ["P1", "P2", "P3", "P4", "P5"];

function formatDateText(value: string | null | undefined): string {
  if (!value) return NA_TEXT;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return NA_TEXT;
  return parsed.toLocaleString();
}

function scoreInterpretation(totalScore: number | null): string {
  if (totalScore === null || !Number.isFinite(totalScore)) return NA_TEXT;
  if (totalScore < 40) return "Symbolic BIM";
  if (totalScore < 60) return "Partial BIM";
  if (totalScore < 75) return "Functional BIM";
  if (totalScore < 90) return "Integrated BIM";
  return "BIM-Driven Project";
}

export default function AuditSnapshotDetailPage() {
  const router = useRouter();
  const { snapshotId } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshotView, setSnapshotView] = useState<AuditSnapshotView | null>(null);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [period, setPeriod] = useState<ScoringPeriod | null>(null);
  const [dataMode, setDataMode] = useState<DataMode>("backend");
  const [backendMessage, setBackendMessage] = useState<string | null>(null);
  const [exportInfo, setExportInfo] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [backendSummary, setBackendSummary] = useState<{
    total_score: number | null;
    confidence: SummaryConfidence | null;
    breakdown: Array<{ perspective_id: string; score: number | null }>;
  } | null>(null);

  useEffect(() => {
    if (!router.isReady || typeof snapshotId !== "string") return;

    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const decodedId = decodeURIComponent(snapshotId);
        const snapshotResult = await fetchAuditSnapshotsReadMode();
        const hit = snapshotResult.data.find((row) => row.snapshot_id === decodedId) || null;
        if (!hit) {
          throw new Error("Snapshot not found.");
        }

        const [projectResult, periodResult] = await Promise.all([
          fetchProjectReadMode(hit.snapshot.project_id),
          fetchProjectPeriodsReadMode(hit.snapshot.project_id),
        ]);
        let projectInfo: ProjectRecord | null = projectResult.data;
        const pageDataMode: DataMode =
          snapshotResult.mode === "prototype" ||
          projectResult.mode === "prototype" ||
          periodResult.mode === "prototype"
            ? "prototype"
            : "backend";
        let pageBackendMessage =
          snapshotResult.backend_message || projectResult.backend_message || periodResult.backend_message;

        if (!projectInfo) {
          projectInfo = {
            id: hit.snapshot.project_id,
            name: null,
            code: null,
            config_key: null,
            phase: null,
            is_active: null,
          };
          pageBackendMessage = pageBackendMessage || "Backend not available";
        }
        if (isTestWorkspaceProject(projectInfo)) {
          throw new Error("Snapshot workspace ujicoba tidak ditampilkan pada halaman Audit.");
        }

        const periodId = hit.snapshot.period_id;
        const periodInfo =
          typeof periodId === "string" && periodId.trim()
            ? periodResult.data.find((row) => row.id === periodId) || null
            : null;

        let summary: typeof backendSummary = null;
        const summaryResult = await fetchReadOnlySummaryReadMode(hit.snapshot.project_id, hit.snapshot.period_id);
        pageBackendMessage = pageBackendMessage || summaryResult.backend_message;
        if (summaryResult.available) {
          summary = {
            total_score: summaryResult.data.total_score,
            confidence: summaryResult.data.confidence,
            breakdown: summaryResult.data.breakdown,
          };
        } else {
          summary = null;
        }

        if (!mounted) return;
        setSnapshotView(hit);
        setProject(projectInfo);
        setPeriod(periodInfo);
        setDataMode(pageDataMode);
        setBackendMessage(pageBackendMessage);
        setBackendSummary(summary);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setSnapshotView(null);
        setProject(null);
        setPeriod(null);
        setDataMode("backend");
        setBackendMessage(e instanceof Error ? e.message : "Backend not available");
        setBackendSummary(null);
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router.isReady, snapshotId]);

  const decisions = useMemo(() => {
    if (!snapshotView) return [];
    return listDecisionsForSnapshot(snapshotView.snapshot);
  }, [snapshotView]);

  const scoreBreakdownMap = useMemo(() => {
    const map = new Map<string, number | null>();
    const primary = snapshotView?.snapshot.breakdown || [];
    for (const row of primary) {
      map.set(row.perspective_id, row.score);
    }
    const fallback = backendSummary?.breakdown || [];
    for (const row of fallback) {
      const current = map.get(row.perspective_id);
      if (current === null || typeof current === "undefined") {
        map.set(row.perspective_id, row.score);
      }
    }
    return map;
  }, [snapshotView, backendSummary]);

  function onExportJson() {
    if (!snapshotView) return;

    const payload = buildAuditExportPayload({
      snapshot_id: snapshotView.snapshot_id,
      snapshot: snapshotView.snapshot,
      decisions,
      lock_status: getSnapshotLockStatus(snapshotView.snapshot),
    });

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `snapshot-${snapshotView.snapshot_id}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setExportInfo("Export JSON selesai (download started).");
  }

  async function onExportPdf() {
    if (!snapshotView) return;
    try {
      setPdfGenerating(true);
      setExportInfo("Generating PDF...");

      const printable = buildPrintableAuditSnapshot({
        snapshot_id: snapshotView.snapshot_id,
        snapshot: snapshotView.snapshot,
        lock_status: getSnapshotLockStatus(snapshotView.snapshot),
        project_name: project?.name || project?.code || null,
        latest_decision: decisions[0] || null,
        submitted_count: getSubmittedCountFromSnapshot(snapshotView.snapshot.evidence_counts),
        iso_reference_label: ISO19650_REFERENCE_ONLY_LABEL,
        iso_reference_rows: ISO19650_REFERENCE_ROWS,
      });

      const blob = await generateSnapshotPdfBlob(printable);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = printable.file_name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setExportInfo("PDF generated (download started).");
    } catch (e) {
      setExportInfo(e instanceof Error ? e.message : "Failed to generate PDF.");
    } finally {
      setPdfGenerating(false);
    }
  }

  if (loading) {
    return (
      <main className="task-shell">
        <section className="task-panel">Loading...</section>
      </main>
    );
  }

  if (!snapshotView) {
    return (
      <main className="task-shell">
        <section className="task-panel">
          <h1>Read-only Auditor View</h1>
          <p className="error-box">{error || "Not available"}</p>
          <p>
            <Link href="/audit">Back to Audit Home</Link>
          </p>
        </section>
      </main>
    );
  }

  const { snapshot } = snapshotView;
  const submittedCount = getSubmittedCountFromSnapshot(snapshot.evidence_counts);
  const latestDecision = decisions[0] || null;
  const effectiveTotalScore = snapshot.final_bim_score ?? backendSummary?.total_score ?? null;
  const interpretation = scoreInterpretation(effectiveTotalScore);
  const periodLabel = period ? formatPeriodLabel(period) : snapshot.period_id || NA_TEXT;

  return (
    <AuditorLayout
      title="Read-only Auditor View"
      subtitle="Snapshot detail sebagai catatan immutable dari backend."
      projectLabel={formatProjectLabel(project || { id: snapshot.project_id, name: null, code: null, phase: null, is_active: null })}
      periodLabel={periodLabel}
      snapshotId={typeof snapshotId === "string" ? decodeURIComponent(snapshotId) : null}
    >
      <BackendStatusBanner mode={dataMode} message={backendMessage} />

      <section className="task-panel">
        <h2>Snapshot Header</h2>
        <p>Project: {project?.name || project?.code || snapshot.project_id || NA_TEXT}</p>
        <p>Project ID: {snapshot.project_id || NA_TEXT}</p>
        <p>Period: {periodLabel}</p>
        <p>Period ID: {snapshot.period_id || NA_TEXT}</p>
        <p>Approved by: {snapshot.approved_by || NA_TEXT}</p>
        <p>Approved at: {formatDateText(snapshot.approved_at)}</p>
        <p>Lock status: {getSnapshotLockStatus(snapshot)}</p>
        <p>Snapshot ID: {snapshotView.snapshot_id || NA_TEXT}</p>
        <p className="inline-note">Snapshot source: backend database.</p>
      </section>

      <section className="task-panel">
        <h2>Final Score (Read-only)</h2>
        <p>
          Total: <strong>{effectiveTotalScore ?? NA_TEXT}</strong>
        </p>
        <p>
          Score level: <strong>{interpretation}</strong>
        </p>
        <div className="task-grid-3">
          {PERSPECTIVES.map((pid) => (
            <article key={pid} className="summary-card">
              <span>{pid}</span>
              <strong>{scoreBreakdownMap.get(pid) ?? NA_TEXT}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="task-panel">
        <h2>Evidence Review Counts</h2>
        <div className="task-grid-3">
          <article className="summary-card">
            <span>ACCEPTABLE</span>
            <strong>{snapshot.evidence_counts.ACCEPTABLE}</strong>
          </article>
          <article className="summary-card">
            <span>NEEDS REVISION</span>
            <strong>{snapshot.evidence_counts.NEEDS_REVISION}</strong>
          </article>
          <article className="summary-card">
            <span>REJECTED</span>
            <strong>{snapshot.evidence_counts.REJECTED}</strong>
          </article>
          <article className="summary-card">
            <span>Awaiting review</span>
            <strong>{snapshot.evidence_counts.AWAITING_REVIEW}</strong>
          </article>
        </div>
      </section>

      <section className="task-panel">
        <h2>Narrative Audit Trail</h2>
        <ol className="audit-trail">
          <li>
            <p>
              <strong>Evidence Submission (BIM Coordinator Project)</strong>
            </p>
            <p>Role: BIM Coordinator Project.</p>
            <p>Meaning: Proyek submit evidence untuk indikator terkait (submitted count: {submittedCount}).</p>
            <p>NOT done: Tidak melakukan review, approval, atau locking period.</p>
          </li>
          <li>
            <p>
              <strong>Review Eligibility (BIM Coordinator HO)</strong>
            </p>
            <p>Role: BIM Coordinator HO.</p>
            <p>
              Meaning: Menilai kelayakan evidence (Acceptable/Needs Revision/Rejected) berdasarkan konteks review.
            </p>
            <p>NOT done: Tidak melakukan approval period dan tidak mengubah skor.</p>
          </li>
          <li>
            <p>
              <strong>Approval Decision (BIM Manager)</strong>
            </p>
            <p>Role: BIM Manager/KaDiv BIM.</p>
            <p>Meaning: Keputusan level period: {latestDecision?.decision || NA_TEXT}.</p>
            <p>Reason: {latestDecision?.reason || NA_TEXT}</p>
            <p>NOT done: Tidak melakukan edit evidence, indikator, atau score entry.</p>
          </li>
          <li>
            <p>
              <strong>Snapshot Created (System)</strong>
            </p>
            <p>Role: System record layer (backend).</p>
            <p>Meaning: Snapshot immutable dibuat saat approval dan disimpan append-only.</p>
            <p>NOT done: Tidak mengklaim compliance final; hanya rekam jejak referensi internal.</p>
          </li>
        </ol>
      </section>

      <section className="task-panel">
        <h2>ISO 19650 Reference Mapping</h2>
        <p className="inline-note">{ISO19650_REFERENCE_ONLY_LABEL}</p>
        <table className="audit-table">
          <thead>
            <tr>
              <th align="left">Control Area</th>
              <th align="left">ISO Reference</th>
              <th align="left">Indicative Mapping</th>
            </tr>
          </thead>
          <tbody>
            {ISO19650_REFERENCE_ROWS.map((row) => (
              <tr key={row.control_area}>
                <td>{row.control_area}</td>
                <td>{row.iso_reference}</td>
                <td>{row.indicative_mapping}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="task-panel">
        <h2>Audit Export</h2>
        <div className="wizard-actions">
          <button type="button" onClick={onExportJson}>
            Export JSON
          </button>
          <button type="button" onClick={onExportPdf} disabled={pdfGenerating}>
            Export PDF
          </button>
        </div>
        {exportInfo ? <p className="task-note action-feedback">{exportInfo}</p> : null}
      </section>

      <section className="task-panel">
        <h3>Backend Read-only Summary</h3>
        <p>
          Total: <strong>{backendSummary?.total_score ?? NA_TEXT}</strong>
        </p>
        <p>
          Confidence: <strong>{backendSummary?.confidence?.confidence ?? NA_TEXT}</strong>
        </p>
        <p>Breakdown source: {backendSummary ? "Available" : NA_TEXT}</p>
      </section>
    </AuditorLayout>
  );
}
