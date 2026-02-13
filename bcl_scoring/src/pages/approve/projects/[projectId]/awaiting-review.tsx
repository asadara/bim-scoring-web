import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import ApproverLayout from "@/components/ApproverLayout";
import BackendStatusBanner from "@/components/BackendStatusBanner";
import {
  DataMode,
  LocalEvidenceWithReview,
  NA_TEXT,
  fetchEvidenceListReadMode,
  formatBimUseDisplay,
  formatProjectLabel,
  mapEvidenceRowsWithReview,
} from "@/lib/role1TaskLayer";
import { ApproverProjectContext, fetchApproverProjectContext } from "@/lib/approverTaskLayer";

function formatTimestamp(input: string | null): string {
  if (!input) return NA_TEXT;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleString();
}

export default function AwaitingReviewQueuePage() {
  const router = useRouter();
  const { projectId } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<ApproverProjectContext | null>(null);
  const [rows, setRows] = useState<LocalEvidenceWithReview[]>([]);
  const [evidenceMode, setEvidenceMode] = useState<DataMode>("backend");
  const [evidenceMessage, setEvidenceMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady || typeof projectId !== "string") return;

    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const nextContext = await fetchApproverProjectContext(projectId);
        const evidenceResult = await fetchEvidenceListReadMode(projectId, nextContext.period_id);
        const awaitingRows = mapEvidenceRowsWithReview(evidenceResult.data)
          .filter((item) => item.effective_status === "SUBMITTED")
          .sort((a, b) => String(b.submitted_at || b.updated_at).localeCompare(String(a.submitted_at || a.updated_at)));

        if (!mounted) return;
        setContext(nextContext);
        setRows(awaitingRows);
        setEvidenceMode(evidenceResult.mode);
        setEvidenceMessage(evidenceResult.backend_message);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setContext(null);
        setRows([]);
        setEvidenceMode("prototype");
        setEvidenceMessage(e instanceof Error ? e.message : "Backend not available");
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    const refresh = () => {
      void load();
    };

    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      mounted = false;
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router.isReady, projectId]);

  const isQueueEmpty = rows.length === 0;
  const totalAwaiting = rows.length;
  const totalIndicators = useMemo(() => {
    let count = 0;
    for (const row of rows) count += row.indicator_ids.length;
    return count;
  }, [rows]);

  if (loading) {
    return (
      <main className="task-shell">
        <section className="task-panel">Loading...</section>
      </main>
    );
  }

  if (!context || typeof projectId !== "string") {
    return (
      <main className="task-shell">
        <section className="task-panel">
          <h1>Awaiting Review Queue</h1>
          <p className="error-box">{error || "Project context not found."}</p>
          <p>
            <Link href="/approve">Kembali ke Period Approval</Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <ApproverLayout
      title="Awaiting Review Queue"
      subtitle="Evidence yang masih menunggu review BIM Coordinator HO sebelum period bisa diputuskan."
      projectId={typeof projectId === "string" ? projectId : null}
      projectName={formatProjectLabel(context.project)}
      periodLabel={context.period_label}
      periodStatusLabel={context.period_status_label}
    >
      <BackendStatusBanner
        mode={context.data_mode === "prototype" || evidenceMode === "prototype" ? "prototype" : "backend"}
        message={context.backend_message || evidenceMessage}
      />

      <section className="task-panel">
        <div className="wizard-actions">
          <Link href={`/approve/projects/${projectId}`}>Kembali ke Period Approval Context</Link>
        </div>
        <p className="inline-note">
          Queue ini bersifat monitoring untuk BIM Manager. Proses review detail tetap dilakukan oleh BIM Coordinator HO.
        </p>
      </section>

      <section className="task-grid-3" aria-label="Awaiting review summary">
        <article className="summary-card">
          <span>Awaiting review items</span>
          <strong>{totalAwaiting}</strong>
        </article>
        <article className="summary-card">
          <span>Linked indicators</span>
          <strong>{totalIndicators}</strong>
        </article>
        <article className="summary-card">
          <span>Approval readiness</span>
          <strong>{isQueueEmpty ? "Ready" : "Pending review"}</strong>
        </article>
      </section>

      <section className="task-panel">
        <h2>Pending Evidence</h2>
        {isQueueEmpty ? <p className="empty-state">Tidak ada evidence berstatus Awaiting review untuk period aktif.</p> : null}

        {!isQueueEmpty ? (
          <div className="evidence-list">
            {rows.map((item) => (
              <article className="evidence-item" key={item.id}>
                <p>
                  <strong>{item.title || NA_TEXT}</strong>
                </p>
                <p>{item.description || NA_TEXT}</p>
                <p>
                  BIM Use: {formatBimUseDisplay(item.bim_use_id)} | Type: {item.type}
                </p>
                <p>Indicators linked: {item.indicator_ids.length}</p>
                <p>Submitted at: {formatTimestamp(item.submitted_at)}</p>
                <p>
                  Status: <span className="status-chip status-na">Awaiting review</span>
                </p>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </ApproverLayout>
  );
}
