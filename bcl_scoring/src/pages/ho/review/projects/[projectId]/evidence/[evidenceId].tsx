import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import BackendStatusBanner from "@/components/BackendStatusBanner";
import Role2Layout from "@/components/Role2Layout";
import { canWriteRole2Review } from "@/lib/accessControl";
import {
  LOCKED_READ_ONLY_ERROR,
  NA_TEXT,
  ReviewOutcome,
  formatBimUseDisplay,
  getLocalEvidenceWithReviewById,
  isRealBackendWriteEnabled,
} from "@/lib/role1TaskLayer";
import { applyReviewWrite, fetchIndicatorsStrict, fetchRole2ProjectContext } from "@/lib/role2TaskLayer";
import { useCredential } from "@/lib/useCredential";
import { getRoleLabel } from "@/lib/userCredential";

const OUTCOMES: ReviewOutcome[] = ["ACCEPTABLE", "NEEDS REVISION", "REJECTED"];

const SAFE_DATA_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);

function normalizeMime(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  return value || null;
}

function detectDataUrlMime(input: string): string | null {
  const match = input.match(/^data:([^;,]+)?(?:;[^,]*)?,/i);
  if (!match) return null;
  return normalizeMime(match[1] || null);
}

function getFileExtensionFromMime(mime: string | null): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  return "bin";
}

function isSafeAttachmentHref(href: string): { ok: boolean; reason: string | null; dataMime: string | null } {
  const trimmed = href.trim();
  if (!trimmed) return { ok: false, reason: "Empty URL", dataMime: null };

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("data:")) {
    const dataMime = detectDataUrlMime(trimmed);
    if (!dataMime || !SAFE_DATA_MIME_TYPES.has(dataMime)) {
      return {
        ok: false,
        reason: "Blocked MIME for local data URL (allowed: PDF/PNG/JPG).",
        dataMime: dataMime || null,
      };
    }
    return { ok: true, reason: null, dataMime };
  }

  if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("blob:")) {
    return { ok: true, reason: null, dataMime: null };
  }

  return { ok: false, reason: "Blocked protocol (allowed: https/http/blob/data).", dataMime: null };
}

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

  const candidates = [
    { label: "Open file", href: item.file_view_url },
    { label: "Download file", href: item.file_download_url },
    { label: "Reference file", href: item.file_reference_url },
  ].filter((entry): entry is { label: string; href: string } => Boolean(entry.href && entry.href.trim()));

  const deduped = candidates.filter(
    (entry, index) => candidates.findIndex((other) => other.href === entry.href) === index
  );

  const checked = deduped.map((entry) => {
    const safety = isSafeAttachmentHref(entry.href);
    return {
      ...entry,
      ...safety,
    };
  });

  const allowed = checked.filter((entry) => entry.ok);
  const blocked = checked.filter((entry) => !entry.ok);

  return (
    <>
      <p>Attachment:</p>
      {allowed.length === 0 ? <p className="warning-box">No safe attachment URL is available.</p> : null}
      {allowed.length > 0 ? (
        <div className="item-actions">
          {allowed.map((entry, index) => {
            const isDataUrl = entry.href.toLowerCase().startsWith("data:");
            const extension = getFileExtensionFromMime(entry.dataMime);
            const downloadName = `evidence-attachment-${index + 1}.${extension}`;
            return (
              <a
                key={`${entry.label}-${index}`}
                href={entry.href}
                target="_blank"
                rel="noopener noreferrer"
                download={isDataUrl ? downloadName : undefined}
              >
                {entry.label}
              </a>
            );
          })}
        </div>
      ) : null}
      {blocked.length > 0 ? (
        <div className="warning-box">
          <strong>Blocked attachment link:</strong>
          <div>{blocked[0].reason || "Unsupported attachment format."}</div>
        </div>
      ) : null}
    </>
  );
}

export default function HoEvidenceReviewPage() {
  const router = useRouter();
  const { projectId, evidenceId } = router.query;
  const credential = useCredential();

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
  const currentLifecycleLabel =
    evidence.effective_status === "ACCEPTABLE"
      ? "Reviewed - ACCEPTABLE"
      : evidence.effective_status === "REJECTED"
        ? "Reviewed - REJECTED"
        : evidence.effective_status === "NEEDS_REVISION"
          ? "Needs Revision"
          : evidence.effective_status === "SUBMITTED"
            ? "Submitted (Awaiting Review)"
            : "Draft";
  const blockedByBackend = isRealBackendWriteEnabled() && context.data_mode === "prototype";
  const canWrite = canWriteRole2Review(credential.role);
  const canApply = canWrite && !isLocked && !blockedByBackend && isSubmitted && !isSubmitting;

  async function onApplyReview() {
    if (!canApply) {
      setFormError(
        !canWrite
          ? "Role aktif hanya memiliki read-only access. Apply Review dinonaktifkan."
          : isLocked
            ? LOCKED_READ_ONLY_ERROR
            : blockedByBackend
              ? "Backend unavailable"
              : null
      );
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
        reviewed_by: "BIM Coordinator HO (Prototype)",
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
      projectId={typeof projectId === "string" ? projectId : null}
      project={context.project}
      activePeriod={context.active_period}
      periodStatusLabel={context.period_status_label}
    >
      <BackendStatusBanner mode={context.data_mode} message={bannerHint || context.backend_message} />

      <section className="task-panel">
        <p className="inline-note">Review tidak mengubah skor dan bukan approval period.</p>
        <p className="prototype-badge">Prototype review (not final, not used in scoring)</p>
        {isLocked ? <p className="warning-box">LOCKED (read-only)</p> : null}
        {!canWrite ? (
          <p className="read-only-banner">
            Mode read-only aktif untuk role <strong>{getRoleLabel(credential.role)}</strong>. Apply Review dinonaktifkan.
          </p>
        ) : null}
        {!isSubmitted ? (
          <p className="warning-box">
            Apply Review hanya untuk status SUBMITTED. Status saat ini: <strong>{currentLifecycleLabel}</strong>.
            {evidence.latest_review_outcome
              ? " Evidence ini sudah direview; minta Role 1 update/resubmit jika perlu review ulang."
              : " Minta Role 1 submit evidence terlebih dahulu."}
          </p>
        ) : null}
      </section>

      <section className="task-panel">
        <h2>Evidence Context (Read-only)</h2>
        <p>
          BIM Use: <strong>{formatBimUseDisplay(evidence.bim_use_id)}</strong>
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
        <p>
          Current lifecycle: <strong>{currentLifecycleLabel}</strong>
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
