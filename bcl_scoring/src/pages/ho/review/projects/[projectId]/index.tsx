import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import BackendStatusBanner from "@/components/BackendStatusBanner";
import Role2Layout from "@/components/Role2Layout";
import { DataMode, NA_TEXT } from "@/lib/role1TaskLayer";
import {
  fetchRole2ProjectContext,
  fetchSubmittedEvidenceByProjectReadMode,
  listSubmittedEvidenceByProject,
} from "@/lib/role2TaskLayer";

export default function HoProjectReviewPage() {
  const router = useRouter();
  const { projectId } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<Awaited<ReturnType<typeof fetchRole2ProjectContext>> | null>(null);
  const [submitted, setSubmitted] = useState<ReturnType<typeof listSubmittedEvidenceByProject>>([]);
  const [evidenceMode, setEvidenceMode] = useState<DataMode>("backend");
  const [evidenceMessage, setEvidenceMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady || typeof projectId !== "string") return;

    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        const nextContext = await fetchRole2ProjectContext(projectId);
        const evidenceResult = await fetchSubmittedEvidenceByProjectReadMode(
          projectId,
          nextContext.active_period?.id ?? null
        );
        if (!mounted) return;

        setContext(nextContext);
        setSubmitted(evidenceResult.data);
        setEvidenceMode(evidenceResult.mode);
        setEvidenceMessage(evidenceResult.backend_message);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setContext(null);
        setSubmitted([]);
        setEvidenceMode("prototype");
        setEvidenceMessage(e instanceof Error ? e.message : "Backend not available");
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router.isReady, projectId]);

  useEffect(() => {
    if (!context || typeof projectId !== "string") return;

    const refresh = () => {
      fetchSubmittedEvidenceByProjectReadMode(projectId, context.active_period?.id ?? null)
        .then((result) => {
          setSubmitted(result.data);
          setEvidenceMode(result.mode);
          setEvidenceMessage(result.backend_message);
        })
        .catch((e) => {
          setSubmitted([]);
          setEvidenceMode("prototype");
          setEvidenceMessage(e instanceof Error ? e.message : "Backend not available");
        });
    };

    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [context, projectId]);

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
          <h1>Review Evidence</h1>
          <p className="error-box">{error || "Project context not found."}</p>
          <p>
            <Link href="/ho/review">Kembali ke HO Review</Link>
          </p>
        </section>
      </main>
    );
  }

  const statusClass =
    context.period_status_label === "LOCKED"
      ? "status-chip status-lock"
      : context.period_status_label === "OPEN"
        ? "status-chip status-open"
        : "status-chip status-na";

  return (
    <Role2Layout
      title="Review Evidence"
      subtitle="Project review context untuk evidence berstatus SUBMITTED."
      project={context.project}
      activePeriod={context.active_period}
      periodStatusLabel={context.period_status_label}
    >
      <BackendStatusBanner
        mode={context.data_mode === "prototype" || evidenceMode === "prototype" ? "prototype" : "backend"}
        message={context.backend_message || evidenceMessage}
      />

      <section className="task-panel">
        <p>
          Period status: <span className={statusClass}>{context.period_status_label || NA_TEXT}</span>
        </p>
        {context.period_locked ? <p className="warning-box">LOCKED (read-only)</p> : null}
        <p className="inline-note">Review tidak mengubah skor dan bukan approval period.</p>
        <p className="prototype-badge">Prototype review (not final, not used in scoring)</p>
      </section>

      <section className="task-panel">
        <h2>Submitted Evidence</h2>
        <p>
          Prototype submitted evidence: <strong>{submitted.length}</strong>
        </p>

        {submitted.length === 0 ? <p className="empty-state">No submitted evidence for this project.</p> : null}

        {submitted.length > 0 ? (
          <div className="evidence-list">
            {submitted.map((item) => (
              <article className="evidence-item" key={item.id}>
                <p>
                  <strong>{item.title || NA_TEXT}</strong>
                </p>
                <p>{item.description || NA_TEXT}</p>
                <p>Type: {item.type}</p>
                <p>
                  Last review: {item.latest_review_outcome || NA_TEXT} | {item.reviewed_at || NA_TEXT}
                </p>
                <div className="item-actions">
                  <Link
                    className="revisi"
                    href={`/ho/review/projects/${projectId}/evidence/${encodeURIComponent(item.id)}`}
                  >
                    Buka Evidence
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
