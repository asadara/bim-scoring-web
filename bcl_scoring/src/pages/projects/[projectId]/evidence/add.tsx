import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import BackendStatusBanner from "@/components/BackendStatusBanner";
import Role1Layout from "@/components/Role1Layout";
import {
  EvidenceType,
  LOCKED_READ_ONLY_ERROR,
  NA_TEXT,
  NO_BIM_USE_ID,
  fetchRole1Context,
  getLocalEvidenceById,
  isRealBackendWriteEnabled,
  saveEvidenceWithBackendWrite,
  submitEvidenceWithBackendWrite,
} from "@/lib/role1TaskLayer";

type WizardForm = {
  evidence_id: string | null;
  bim_use_id: string;
  indicator_ids: string[];
  type: EvidenceType | "";
  title: string;
  description: string;
  external_url: string;
  text_content: string;
  file_view_url: string;
  file_download_url: string;
  file_reference_url: string;
};

const STEP_LABELS = [
  "Step 1 - Select BIM Use",
  "Step 2 - Select indicator(s)",
  "Step 3 - Select evidence type",
  "Step 4 - Fill evidence form",
];

const INITIAL_FORM: WizardForm = {
  evidence_id: null,
  bim_use_id: "",
  indicator_ids: [],
  type: "",
  title: "",
  description: "",
  external_url: "",
  text_content: "",
  file_view_url: "",
  file_download_url: "",
  file_reference_url: "",
};

function renderTypeHint(type: WizardForm["type"]): string {
  if (type === "URL") return "Isi external_url (link eksternal).";
  if (type === "TEXT") return "Isi text content. Konten ditampilkan sebagai plain text.";
  if (type === "FILE") return "Isi view_url/download_url atau single reference URL (upload belum tersedia).";
  return "Pilih tipe evidence untuk melihat field input yang dibutuhkan.";
}

export default function AddEvidencePage() {
  const router = useRouter();
  const { projectId, evidenceId, mode } = router.query;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitInfo, setSubmitInfo] = useState<string | null>(null);
  const [bannerHint, setBannerHint] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [context, setContext] = useState<Awaited<ReturnType<typeof fetchRole1Context>> | null>(null);

  useEffect(() => {
    if (!router.isReady || typeof projectId !== "string") return;

    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const nextContext = await fetchRole1Context(projectId);
        if (!mounted) return;
        setContext(nextContext);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setContext(null);
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

    if (typeof evidenceId !== "string") {
      setForm((prev) => {
        if (prev.bim_use_id) return prev;
        return {
          ...prev,
          bim_use_id: "",
        };
      });
      return;
    }

    const hit = getLocalEvidenceById(evidenceId);
    if (!hit || hit.project_id !== projectId) {
      setSubmitError("Evidence yang akan direvisi tidak ditemukan di local prototype storage.");
      return;
    }

    setForm({
      evidence_id: hit.id,
      bim_use_id: hit.bim_use_id || NO_BIM_USE_ID,
      indicator_ids: hit.indicator_ids,
      type: hit.type,
      title: hit.title,
      description: hit.description,
      external_url: hit.external_url || "",
      text_content: hit.text_content || "",
      file_view_url: hit.file_view_url || "",
      file_download_url: hit.file_download_url || "",
      file_reference_url: hit.file_reference_url || "",
    });
  }, [context, evidenceId, projectId]);

  const selectedBimUse = useMemo(() => {
    if (!context) return null;
    return context.bim_uses.find((item) => item.bim_use_id === form.bim_use_id) || null;
  }, [context, form.bim_use_id]);

  const indicators = selectedBimUse?.indicators || [];

  function setField<K extends keyof WizardForm>(key: K, value: WizardForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSubmitError(null);
    setSubmitInfo(null);
  }

  function validateStep(targetStep: number): string | null {
    if (targetStep >= 1 && !form.bim_use_id) {
      return "Step 1 wajib: pilih BIM Use terlebih dahulu.";
    }
    if (targetStep >= 2 && form.indicator_ids.length === 0) {
      return "Step 2 wajib: evidence harus terikat minimal 1 indikator.";
    }
    if (targetStep >= 3 && !form.type) {
      return "Step 3 wajib: pilih tipe evidence (FILE/URL/TEXT).";
    }
    if (targetStep >= 4) {
      if (!form.title.trim()) return "Title wajib diisi.";
      if (!form.description.trim()) return "Description wajib diisi.";
      if (form.type === "URL" && !form.external_url.trim()) {
        return "Tipe URL wajib mengisi external_url.";
      }
      if (form.type === "TEXT" && !form.text_content.trim()) {
        return "Tipe TEXT wajib mengisi text content.";
      }
      if (
        form.type === "FILE" &&
        !form.file_view_url.trim() &&
        !form.file_download_url.trim() &&
        !form.file_reference_url.trim()
      ) {
        return "Tipe FILE wajib mengisi view_url/download_url atau single reference URL.";
      }
    }
    return null;
  }

  function onNextStep() {
    const err = validateStep(step);
    if (err) {
      setSubmitError(err);
      return;
    }
    setStep((prev) => Math.min(4, prev + 1));
    setSubmitError(null);
  }

  function onBackStep() {
    setStep((prev) => Math.max(1, prev - 1));
    setSubmitError(null);
  }

  function onToggleIndicator(indicatorId: string, checked: boolean) {
    const set = new Set(form.indicator_ids);
    if (checked) set.add(indicatorId);
    else set.delete(indicatorId);
    setField("indicator_ids", [...set]);
  }

  function onSelectBimUse(value: string) {
    const group = context?.bim_uses.find((item) => item.bim_use_id === value) || null;
    const validIndicatorIds = new Set((group?.indicators || []).map((item) => item.id));
    const filteredIndicators = form.indicator_ids.filter((id) => validIndicatorIds.has(id));

    setForm((prev) => ({
      ...prev,
      bim_use_id: value,
      indicator_ids: filteredIndicators,
    }));
    setSubmitError(null);
    setSubmitInfo(null);
  }

  async function saveByStatus(status: "DRAFT" | "SUBMITTED") {
    if (!context || typeof projectId !== "string") return;
    const writeBlockedByMode = isRealBackendWriteEnabled() && context.data_mode === "prototype";
    if (context.period_locked || writeBlockedByMode) {
      setSubmitError(context.period_locked ? LOCKED_READ_ONLY_ERROR : "Backend unavailable");
      return;
    }

    const validationError = validateStep(4);
    if (validationError) {
      setSubmitError(validationError);
      const failingStep =
        !form.bim_use_id
          ? 1
          : form.indicator_ids.length === 0
            ? 2
            : !form.type
              ? 3
              : 4;
      setStep(failingStep);
      return;
    }

    let saved;
    try {
      setIsSubmitting(true);
      const payload = {
        id: form.evidence_id || undefined,
        project_id: projectId,
        period_id: context.active_period?.id ?? null,
        bim_use_id: form.bim_use_id === NO_BIM_USE_ID ? "" : form.bim_use_id,
        indicator_ids: form.indicator_ids,
        type: form.type as EvidenceType,
        title: form.title,
        description: form.description,
        external_url: form.external_url || null,
        text_content: form.text_content || null,
        file_view_url: form.file_view_url || null,
        file_download_url: form.file_download_url || null,
        file_reference_url: form.file_reference_url || null,
        status: "DRAFT" as const,
        review_reason: null,
      };
      saved =
        status === "DRAFT"
          ? await saveEvidenceWithBackendWrite(payload)
          : await submitEvidenceWithBackendWrite(payload);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save evidence.";
      setSubmitError(message);
      if (message.startsWith("HTTP ") || message === "Backend unavailable") {
        setBannerHint(message);
      }
      return;
    } finally {
      setIsSubmitting(false);
    }

    setForm((prev) => ({ ...prev, evidence_id: saved.id }));
    setSubmitError(null);
    setBannerHint(null);
    setSubmitInfo(
      status === "DRAFT" ? "Draft evidence tersimpan." : "Evidence berhasil submit untuk review."
    );
  }

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
          <h1>Tambahkan Evidence untuk BIM Use</h1>
          <p className="error-box">{error || "Project context not found."}</p>
          <p>
            <Link href="/projects">Kembali ke Projects</Link>
          </p>
        </section>
      </main>
    );
  }

  const isLocked = context.period_locked;
  const writeDisabled = isLocked || isSubmitting || (isRealBackendWriteEnabled() && context.data_mode === "prototype");
  const isRevisionMode = mode === "revisi";

  return (
    <Role1Layout
      projectId={projectId}
      title="Tambahkan Evidence untuk BIM Use"
      subtitle="Light wizard Role 1: pilih BIM Use, pilih indikator, pilih tipe, lalu isi evidence."
      project={context.project}
      activePeriod={context.active_period}
      periodStatusLabel={context.period_status_label}
    >
      <BackendStatusBanner mode={context.data_mode} message={bannerHint || context.backend_message} />
      <section className="task-panel">
        <div className="stepper" role="list" aria-label="Add evidence steps">
          {STEP_LABELS.map((label, index) => (
            <span
              key={label}
              role="listitem"
              className={`step-pill ${step === index + 1 ? "active" : ""}`}
            >
              {label}
            </span>
          ))}
        </div>

        {isLocked ? (
          <p className="warning-box">
            Period saat ini LOCKED. Semua input read-only dan aksi Save/Submit dinonaktifkan.
          </p>
        ) : null}

        {isRevisionMode ? (
          <p className="inline-note">
            Mode Revisi aktif. Anda dapat mengubah evidence lalu simpan sebagai Draft atau Submit for Review.
          </p>
        ) : null}

        {step === 1 ? (
          <div className="field-grid">
            <label htmlFor="bim-use-select">
              Select BIM Use
              <select
                id="bim-use-select"
                value={form.bim_use_id}
                onChange={(event) => onSelectBimUse(event.target.value)}
                disabled={isLocked}
              >
                <option value="">Pilih BIM Use</option>
                {context.bim_uses.map((group) => (
                  <option key={group.bim_use_id} value={group.bim_use_id}>
                    {group.label} ({group.indicators.length} indikator)
                  </option>
                ))}
              </select>
            </label>
            {context.bim_uses.length === 0 ? (
              <p className="warning-box">BIM Use belum tersedia dari endpoint. Not available.</p>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="field-grid">
            <p>Pilih indicator(s) yang relevan. Evidence tanpa indikator tidak bisa disimpan.</p>
            {form.bim_use_id ? (
              <div className="option-grid">
                {indicators.map((indicator) => (
                  <label key={indicator.id} className="option-card">
                    <span>
                      <input
                        type="checkbox"
                        checked={form.indicator_ids.includes(indicator.id)}
                        onChange={(event) => onToggleIndicator(indicator.id, event.target.checked)}
                        disabled={isLocked}
                      />
                      <strong>{indicator.code}</strong>
                    </span>
                    <small>
                      {indicator.title} | Perspective: {indicator.perspective_id || NA_TEXT}
                    </small>
                  </label>
                ))}
              </div>
            ) : (
              <p className="warning-box">Pilih BIM Use pada Step 1 terlebih dahulu.</p>
            )}

            {form.bim_use_id && indicators.length === 0 ? (
              <p className="warning-box">Indicator untuk BIM Use ini Not available.</p>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="field-grid">
            <p>Select evidence type:</p>
            <div className="option-grid">
              {(["FILE", "URL", "TEXT"] as EvidenceType[]).map((type) => (
                <label className="option-card" key={type}>
                  <span>
                    <input
                      type="radio"
                      name="evidence-type"
                      checked={form.type === type}
                      onChange={() => setField("type", type)}
                      disabled={isLocked}
                    />
                    <strong>{type}</strong>
                  </span>
                </label>
              ))}
            </div>
            <p className="inline-note">{renderTypeHint(form.type)}</p>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="field-grid">
            <label htmlFor="title-input">
              Title
              <input
                id="title-input"
                value={form.title}
                onChange={(event) => setField("title", event.target.value)}
                disabled={isLocked}
                maxLength={160}
              />
            </label>

            <label htmlFor="description-input">
              Description
              <textarea
                id="description-input"
                value={form.description}
                onChange={(event) => setField("description", event.target.value)}
                disabled={isLocked}
                maxLength={2000}
              />
            </label>

            {form.type === "URL" ? (
              <label htmlFor="external-url-input">
                external_url
                <input
                  id="external-url-input"
                  value={form.external_url}
                  onChange={(event) => setField("external_url", event.target.value)}
                  disabled={isLocked}
                  placeholder="https://..."
                />
              </label>
            ) : null}

            {form.type === "TEXT" ? (
              <label htmlFor="text-content-input">
                text content (plain text)
                <textarea
                  id="text-content-input"
                  value={form.text_content}
                  onChange={(event) => setField("text_content", event.target.value)}
                  disabled={isLocked}
                  placeholder="Tuliskan konteks evidence sebagai plain text"
                />
              </label>
            ) : null}

            {form.type === "FILE" ? (
              <>
                <label htmlFor="file-view-url-input">
                  view_url (optional)
                  <input
                    id="file-view-url-input"
                    value={form.file_view_url}
                    onChange={(event) => setField("file_view_url", event.target.value)}
                    disabled={isLocked}
                    placeholder="https://..."
                  />
                </label>

                <label htmlFor="file-download-url-input">
                  download_url (optional)
                  <input
                    id="file-download-url-input"
                    value={form.file_download_url}
                    onChange={(event) => setField("file_download_url", event.target.value)}
                    disabled={isLocked}
                    placeholder="https://..."
                  />
                </label>

                <label htmlFor="file-reference-url-input">
                  single reference URL (optional)
                  <input
                    id="file-reference-url-input"
                    value={form.file_reference_url}
                    onChange={(event) => setField("file_reference_url", event.target.value)}
                    disabled={isLocked}
                    placeholder="https://..."
                  />
                </label>
              </>
            ) : null}

            {!form.type ? (
              <p className="warning-box">Tipe evidence pada Step 3 belum dipilih.</p>
            ) : null}
          </div>
        ) : null}

        <div className="wizard-actions">
          <button type="button" onClick={onBackStep} disabled={step === 1}>
            Back
          </button>
          <button type="button" onClick={onNextStep} disabled={step === 4}>
            Next
          </button>
          <button
            type="button"
            onClick={() => void saveByStatus("DRAFT")}
            disabled={writeDisabled}
            title="Local draft (prototype, not used in scoring)"
          >
            Save Draft
          </button>
          <button
            type="button"
            className="action-primary"
            onClick={() => void saveByStatus("SUBMITTED")}
            disabled={writeDisabled}
            title="Local draft (prototype, not used in scoring)"
          >
            Submit for Review
          </button>
          <Link href={`/projects/${projectId}/evidence`}>Go to My Evidence List</Link>
        </div>

        <p className="inline-note">Evidence akan direview dan tidak langsung memengaruhi skor.</p>
        <p className="prototype-badge">Local draft (prototype, not used in scoring)</p>

        {submitError ? <p className="error-box">{submitError}</p> : null}
        {submitInfo ? <p className="task-note">{submitInfo}</p> : null}
      </section>
    </Role1Layout>
  );
}
