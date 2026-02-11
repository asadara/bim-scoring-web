import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import BackendStatusBanner from "@/components/BackendStatusBanner";
import Role2Layout from "@/components/Role2Layout";
import {
  LOCKED_READ_ONLY_ERROR,
  NA_TEXT,
  ReviewOutcome,
  getLocalEvidenceWithReviewById,
  isRealBackendWriteEnabled,
} from "@/lib/role1TaskLayer";
import { applyReviewWrite, fetchIndicatorsStrict, fetchRole2ProjectContext } from "@/lib/role2TaskLayer";

const OUTCOMES: ReviewOutcome[] = ["ACCEPTABLE", "NEEDS REVISION", "REJECTED"];

function renderEvidenceContent(item: NonNullable<ReturnType<typeof getLocalEvidenceWithReviewById>>) {
  if (item.type === "URL") {
    return (
      <p>
        external_url:{" "}
        {item.external_url ? (
          <a href={item.external_url} target="_blank" rel="noopener noreferrer">
            {item.external_url}
          </a>
        ) : (
          NA_TEXT
        )}
      </p>
    );
  }

  if (item.type === "TEXT") {
    return (
      <div>
        <p>text content:</p>
        <pre className="review-pre">{item.text_content || NA_TEXT}</pre>
      </div>
    );
  }

  return (
    <>
      <p>
        view_url:{" "}
        {item.file_view_url ? (
          <a href={item.file_view_url} target="_blank" rel="noopener noreferrer">
            {item.file_view_url}
          </a>
        ) : (
          NA_TEXT
        )}
      </p>
      <p>
        download_url:{" "}
        {item.file_download_url ? (
          <a href={item.file_download_url} target="_blank" rel="noopener noreferrer">
            {item.file_download_url}
          </a>
        ) : (
          NA_TEXT
        )}
      </p>
      <p>
        reference URL:{" "}
        {item.file_reference_url ? (
          <a href={item.file_reference_url} target="_blank" rel="noopener noreferrer">
            {item.file_reference_url}
          </a>
        ) : (
          NA_TEXT
        )}
      </p>
    </>
  );
}

export default function HoEvidenceReviewPage() {
  const router = useRouter();
  const { projectId, evidenceId } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<Awaited<ReturnType<typeof fetchRole2ProjectContext>> | null>(null);
  const [evidence, setEvidence] = useState<ReturnType<typeof getLocalEvidenceWithReviewById>>(null);
  const [indicatorMap, setIndicatorMap] = useState<Map<string, { code: string; title: string }>>(new Map());
  const [indicatorError, setIndicatorError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ReviewOutcome | "">("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formInfo, setFormInfo] = useState<string | null>(null);
  const [bannerHint, setBannerHint] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!router.isReady || typeof projectId !== "string" || typeof evidenceId !== "string") return;

    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const nextContext = await fetchRole2ProjectContext(projectId);
        const nextEvidence = getLocalEvidenceWithReviewById(evidenceId);

        if (!mounted) return;

        setContext(nextContext);
        setEvidence(nextEvidence);
        setError(null);

        try {
          const indicators = await fetchIndicatorsStrict(projectId);
          if (!mounted) return;
          const simplified = new Map<string, { code: string; title: string }>();
          for (const item of indicators) {
            simplified.set(item.id, { code: item.code, title: item.title });
          }
          setIndicatorMap(simplified);
          setIndicatorError(null);
        } catch (e) {
          if (!mounted) return;
          setIndicatorMap(new Map());
          setIndicatorError(e instanceof Error ? e.message : "Not available");
        }
      } catch (e) {
        if (!mounted) return;
        setContext(null);
        setEvidence(null);
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router.isReady, projectId, evidenceId]);

  useEffect(() => {
    if (!router.isReady || typeof evidenceId !== "string") return;

    const refresh = () => {
      const next = getLocalEvidenceWithReviewById(evidenceId);
      setEvidence(next);
    };

    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router.isReady, evidenceId]);

  const indicatorDisplay = useMemo(() => {
    if (!evidence) return [NA_TEXT];
    if (!evidence.indicator_ids || evidence.indicator_ids.length === 0) return [NA_TEXT];

    return evidence.indicator_ids.map((id) => {
      const info = indicatorMap.get(id);
      if (!info) return id || NA_TEXT;
      return `${info.code} - ${info.title}`;
    });
  }, [evidence, indicatorMap]);

  if (loading) {
    return (
      <main className="task-shell">
        <section className="task-panel">Loading...</section>
      </main>
    );
  }

  if (!context || !evidence || typeof projectId !== "string") {
    return (
      <main className="task-shell">
        <section className="task-panel">
          <h1>Apply Review</h1>
          <p className="error-box">{error || "Evidence context not found."}</p>
          <p>
            <Link href={typeof projectId === "string" ? `/ho/review/projects/${projectId}` : "/ho/review"}>
              Kembali
            </Link>
          </p>
        </section>
      </main>
    );
  }

  const isLocked = context.period_locked;
  const isSubmitted = evidence.effective_status === "SUBMITTED";
  const blockedByBackend = isRealBackendWriteEnabled() && context.data_mode === "prototype";
  const canApply = !isLocked && !blockedByBackend && isSubmitted && !isSubmitting;

  async function onApplyReview() {
    if (!canApply) {
      setFormError(isLocked ? LOCKED_READ_ONLY_ERROR : blockedByBackend ? "Backend unavailable" : null);
      return;
    }
    if (!evidence) return;
    if (!outcome) {
      setFormError("Outcome wajib dipilih.");
      return;
    }
    if (!reason.trim()) {
      setFormError("Reason wajib diisi.");
      return;
    }

    try {
      setIsSubmitting(true);
      await applyReviewWrite({
        evidence_id: evidence.id,
        review_outcome: outcome,
        review_reason: reason,
        reviewed_by: "HO Reviewer (Prototype)",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to apply review.";
      setFormError(message);
      if (message.startsWith("HTTP ") || message === "Backend unavailable") {
        setBannerHint(message);
      }
      return;
    } finally {
      setIsSubmitting(false);
    }

    const refreshed = getLocalEvidenceWithReviewById(evidence.id);
    setEvidence(refreshed);
    setFormError(null);
    setBannerHint(null);
    setFormInfo("Review berhasil disimpan.");
    setReason("");
  }

  return (
    <Role2Layout
      title="Apply Review"
      subtitle="Review evidence secara read-only dan tetapkan outcome + alasan."
      project={context.project}
      activePeriod={context.active_period}
      periodStatusLabel={context.period_status_label}
    >
      <BackendStatusBanner mode={context.data_mode} message={bannerHint || context.backend_message} />

      <section className="task-panel">
        <p className="inline-note">Review tidak mengubah skor dan bukan approval period.</p>
        <p className="prototype-badge">Prototype review (not final, not used in scoring)</p>
        {isLocked ? <p className="warning-box">LOCKED (read-only)</p> : null}
        {!isSubmitted ? (
          <p className="warning-box">Evidence ini bukan status SUBMITTED sehingga Apply Review dinonaktifkan.</p>
        ) : null}
      </section>

      <section className="task-panel">
        <h2>Evidence Context (Read-only)</h2>
        <p>
          BIM Use: <strong>{evidence.bim_use_id || NA_TEXT}</strong>
        </p>
        <p>
          Indicator(s): <strong>{indicatorDisplay.join("; ") || NA_TEXT}</strong>
        </p>
        {indicatorError ? <p className="warning-box">Indicator definition: {NA_TEXT}</p> : null}
        <p>
          Title: <strong>{evidence.title || NA_TEXT}</strong>
        </p>
        <p>Description: {evidence.description || NA_TEXT}</p>
        <p>
          Type: <strong>{evidence.type || NA_TEXT}</strong>
        </p>

        {renderEvidenceContent(evidence)}
      </section>

      <section className="task-panel">
        <h2>Apply Review</h2>
        <div className="option-grid">
          {OUTCOMES.map((item) => (
            <label className="option-card" key={item}>
              <span>
                <input
                  type="radio"
                  name="review-outcome"
                  checked={outcome === item}
                  onChange={() => setOutcome(item)}
                  disabled={!canApply}
                />
                <strong>{item}</strong>
              </span>
            </label>
          ))}
        </div>

        <div className="field-grid">
          <label htmlFor="review-reason">
            Reason (required)
            <textarea
              id="review-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={!canApply}
              placeholder="Tuliskan alasan review"
            />
          </label>
        </div>

        <div className="wizard-actions">
          <button type="button" className="action-primary" disabled={!canApply} onClick={() => void onApplyReview()}>
            Apply Review
          </button>
          <Link href={`/ho/review/projects/${projectId}`}>Back to Review Evidence</Link>
        </div>

        {formError ? <p className="error-box">{formError}</p> : null}
        {formInfo ? <p className="task-note">{formInfo}</p> : null}

        {evidence.latest_review_outcome ? (
          <div className="review-result">
            <p>
              <span className="status-chip status-open">Reviewed — {evidence.latest_review_outcome}</span>
            </p>
            <p>
              Reviewer: {evidence.reviewed_by || NA_TEXT} | Time: {evidence.reviewed_at || NA_TEXT}
            </p>
            <p>Reason: {evidence.latest_review_reason || NA_TEXT}</p>
          </div>
        ) : null}

        <h3>Review History</h3>
        {evidence.review_history.length === 0 ? <p className="empty-state">No review history.</p> : null}
        {evidence.review_history.length > 0 ? (
          <ol className="review-history">
            {evidence.review_history
              .slice()
              .reverse()
              .map((entry, index) => (
                <li key={`${entry.reviewed_at}-${index}`}>
                  <p>
                    <strong>{entry.review_outcome}</strong>
                  </p>
                  <p>Reason: {entry.review_reason || NA_TEXT}</p>
                  <p>
                    Reviewer: {entry.reviewed_by || NA_TEXT} | Time: {entry.reviewed_at || NA_TEXT}
                  </p>
                </li>
              ))}
          </ol>
        ) : null}
      </section>
    </Role2Layout>
  );
}
