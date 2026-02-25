import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useState } from "react";

import Role1Layout from "@/components/Role1Layout";
import { canWriteRole1Evidence } from "@/lib/accessControl";
import {
  canRole1WriteProject,
  EvidenceType,
  fetchEvidenceListReadMode,
  fetchProjectPeriodsReadMode,
  LOCKED_READ_ONLY_ERROR,
  NA_TEXT,
  NO_BIM_USE_ID,
  fetchRole1Context,
  getLocalEvidenceById,
  isRealBackendWriteEnabled,
  saveEvidenceWithBackendWrite,
  submitEvidenceWithBackendWrite,
} from "@/lib/role1TaskLayer";
import { submitRole2BimUseProposal } from "@/lib/role2ProposalClient";
import { useCredential } from "@/lib/useCredential";
import { getRoleLabel, setStoredCredential } from "@/lib/userCredential";

type WizardForm = {
  evidence_id: string | null;
  bim_use_id: string;
  indicator_ids: string[];
  type: EvidenceType | "";
  file_type: "PDF" | "IMAGE" | "DOC" | "SPREADSHEET" | "MODEL" | "OTHER" | "";
  title: string;
  description: string;
  external_url: string;
  text_content: string;
  file_view_url: string;
  file_download_url: string;
  file_reference_url: string;
};

const LOCAL_FILE_SIZE_LIMIT_BYTES = 2 * 1024 * 1024; // 2 MB (localStorage-safe for prototype)

const STEP_LABELS = [
  "Step 1 - Select indicator",
  "Step 2 - Select evidence type",
  "Step 3 - Fill evidence form",
];

const INITIAL_FORM: WizardForm = {
  evidence_id: null,
  bim_use_id: "",
  indicator_ids: [],
  type: "",
  file_type: "",
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
  if (type === "FILE") {
    return "Pilih jenis file, lalu upload biner lokal (prototype) atau isi URL referensi.";
  }
  return "Pilih tipe evidence untuk melihat field input yang dibutuhkan.";
}

function inferFileType(value: string): WizardForm["file_type"] {
  const lower = value.toLowerCase();
  if (!lower) return "";
  if (lower.startsWith("data:application/pdf;")) return "PDF";
  if (lower.startsWith("data:image/")) return "IMAGE";
  if (
    lower.startsWith("data:text/plain;") ||
    lower.startsWith("data:application/msword;") ||
    lower.startsWith("data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;")
  ) {
    return "DOC";
  }
  if (
    lower.startsWith("data:text/csv;") ||
    lower.startsWith("data:application/vnd.ms-excel;") ||
    lower.startsWith("data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;")
  ) {
    return "SPREADSHEET";
  }
  if (lower.endsWith(".pdf")) return "PDF";
  if (/\.(png|jpg|jpeg|gif|bmp|webp|svg)$/.test(lower)) return "IMAGE";
  if (/\.(doc|docx|txt|rtf)$/.test(lower)) return "DOC";
  if (/\.(xls|xlsx|csv)$/.test(lower)) return "SPREADSHEET";
  if (/\.(ifc|rvt|nwd|nwc|dwg)$/.test(lower)) return "MODEL";
  return "";
}

function inferFileTypeFromEvidence(hit: {
  file_reference_url: string | null;
  file_download_url: string | null;
  file_view_url: string | null;
}): WizardForm["file_type"] {
  const fromReference = inferFileType(hit.file_reference_url || "");
  if (fromReference) return fromReference;
  const fromDownload = inferFileType(hit.file_download_url || "");
  if (fromDownload) return fromDownload;
  const fromView = inferFileType(hit.file_view_url || "");
  if (fromView) return fromView;
  return "";
}

function inferFileTypeFromFileMeta(file: File): WizardForm["file_type"] {
  const byName = inferFileType(file.name || "");
  if (byName) return byName;
  return inferFileType(`data:${file.type || ""};`);
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function buildFileAccept(type: WizardForm["file_type"]): string | undefined {
  if (type === "PDF") return ".pdf,application/pdf";
  if (type === "IMAGE") return "image/*";
  if (type === "DOC") {
    return ".doc,.docx,.txt,.rtf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";
  }
  if (type === "SPREADSHEET") {
    return ".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";
  }
  if (type === "MODEL") return ".ifc,.rvt,.nwd,.nwc,.dwg";
  return undefined;
}

export default function AddEvidencePage() {
  const router = useRouter();
  const { projectId, evidenceId, mode, bimUseId } = router.query;
  const credential = useCredential();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitInfo, setSubmitInfo] = useState<string | null>(null);
  const [bannerHint, setBannerHint] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [context, setContext] = useState<Awaited<ReturnType<typeof fetchRole1Context>> | null>(null);
  const [localFileMeta, setLocalFileMeta] = useState<{ name: string; size: number } | null>(null);
  const [showGapProposalForm, setShowGapProposalForm] = useState(false);
  const [gapProposedBimUse, setGapProposedBimUse] = useState("");
  const [gapReason, setGapReason] = useState("");
  const [gapSubmitting, setGapSubmitting] = useState(false);
  const [gapError, setGapError] = useState<string | null>(null);
  const [gapInfo, setGapInfo] = useState<string | null>(null);
  const [bimUseEvidenceCountById, setBimUseEvidenceCountById] = useState<Record<string, number>>({});
  const scopedProjectId = useMemo(() => {
    if (credential.role !== "role1") return null;
    const scopedIds = Array.isArray(credential.scoped_project_ids)
      ? credential.scoped_project_ids.map((id) => String(id || "").trim()).filter(Boolean)
      : [];
    return scopedIds[0] || null;
  }, [credential.role, credential.scoped_project_ids]);
  const selectedBimUseIdFromQuery = useMemo(
    () => (typeof bimUseId === "string" ? bimUseId.trim() : ""),
    [bimUseId]
  );

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
    if (!router.isReady || typeof projectId !== "string") return;
    if (credential.role !== "role1" || !scopedProjectId || scopedProjectId === projectId) return;
    void router.replace(`/projects/${scopedProjectId}/evidence/add`);
  }, [credential.role, projectId, router, router.isReady, scopedProjectId]);

  useEffect(() => {
    if (!context || typeof projectId !== "string") return;
    if (typeof evidenceId !== "string") return;

    let cancelled = false;
    (async () => {
      try {
        let hit = getLocalEvidenceById(evidenceId);
        if (!hit || hit.project_id !== projectId) {
          const periodCandidates = new Set<string>();
          if (context.active_period?.id) periodCandidates.add(context.active_period.id);

          const periodsResult = await fetchProjectPeriodsReadMode(projectId);
          for (const period of periodsResult.data) {
            if (period?.id) periodCandidates.add(period.id);
          }

          for (const periodId of periodCandidates) {
            await fetchEvidenceListReadMode(projectId, periodId);
            hit = getLocalEvidenceById(evidenceId);
            if (hit && hit.project_id === projectId) break;
          }
        }

        if (cancelled) return;
        if (!hit || hit.project_id !== projectId) {
          setSubmitError("Evidence yang akan direvisi tidak ditemukan di backend/local storage.");
          return;
        }

        setSubmitError(null);
        setForm({
          evidence_id: hit.id,
          bim_use_id: hit.bim_use_id || NO_BIM_USE_ID,
          indicator_ids: hit.indicator_ids.slice(0, 1),
          type: hit.type,
          file_type: hit.type === "FILE" ? inferFileTypeFromEvidence(hit) : "",
          title: hit.title,
          description: hit.description,
          external_url: hit.external_url || "",
          text_content: hit.text_content || "",
          file_view_url: hit.file_view_url || "",
          file_download_url: hit.file_download_url || "",
          file_reference_url: hit.file_reference_url || "",
        });
        setLocalFileMeta(null);
      } catch (fetchErr) {
        if (cancelled) return;
        setSubmitError(fetchErr instanceof Error ? fetchErr.message : "Gagal memuat evidence dari backend.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [context, evidenceId, projectId]);

  useEffect(() => {
    if (!context || typeof projectId !== "string") return;
    if (typeof evidenceId === "string") return;

    if (!selectedBimUseIdFromQuery) {
      setForm((prev) => {
        if (
          !prev.bim_use_id &&
          prev.indicator_ids.length === 0 &&
          !prev.type &&
          !prev.title &&
          !prev.description
        ) {
          return prev;
        }
        return { ...INITIAL_FORM };
      });
      setStep(1);
      setLocalFileMeta(null);
      setShowGapProposalForm(false);
      setSubmitError(null);
      return;
    }

    const hasBimUse = context.bim_uses.some((item) => item.bim_use_id === selectedBimUseIdFromQuery);
    if (!hasBimUse) {
      setSubmitError("BIM Use yang dipilih tidak tersedia pada workspace ini.");
      return;
    }

    setSubmitError(null);
    setSubmitInfo(null);
    setStep(1);
    setLocalFileMeta(null);
    setShowGapProposalForm(false);
    setForm((prev) => {
      if (prev.bim_use_id === selectedBimUseIdFromQuery) return prev;
      return {
        ...INITIAL_FORM,
        bim_use_id: selectedBimUseIdFromQuery,
      };
    });
  }, [context, evidenceId, projectId, selectedBimUseIdFromQuery]);

  useEffect(() => {
    if (!context || typeof projectId !== "string") return;

    let mounted = true;
    fetchEvidenceListReadMode(projectId, context.active_period?.id ?? null)
      .then((result) => {
        if (!mounted) return;
        const nextCountByBimUse: Record<string, number> = {};
        for (const item of result.data) {
          const key = String(item.bim_use_id || "").trim() || NO_BIM_USE_ID;
          nextCountByBimUse[key] = (nextCountByBimUse[key] || 0) + 1;
        }
        setBimUseEvidenceCountById(nextCountByBimUse);
      })
      .catch(() => {
        if (!mounted) return;
        setBimUseEvidenceCountById({});
      });

    return () => {
      mounted = false;
    };
  }, [context, projectId]);

  const selectedBimUse = useMemo(() => {
    if (!context) return null;
    return context.bim_uses.find((item) => item.bim_use_id === form.bim_use_id) || null;
  }, [context, form.bim_use_id]);

  const indicators = useMemo(() => selectedBimUse?.indicators || [], [selectedBimUse]);
  const selectedIndicator = useMemo(() => {
    if (form.indicator_ids.length === 0) return null;
    return indicators.find((indicator) => indicator.id === form.indicator_ids[0]) || null;
  }, [form.indicator_ids, indicators]);
  const selectedBimUseLabel = selectedBimUse?.label || "Belum dipilih";
  const selectedIndicatorLabel = selectedIndicator
    ? `${selectedIndicator.code} - ${selectedIndicator.title}`
    : "Belum dipilih";
  const selectedEvidenceTypeLabel = form.type || "Belum dipilih";
  const selectedFileTypeLabel =
    form.type === "FILE" ? form.file_type || "Belum dipilih" : "N/A (bukan tipe FILE)";
  const proposalActor = useMemo(() => {
    if (!credential.user_id) return null;
    return { actorId: credential.user_id, actorRole: credential.role };
  }, [credential.user_id, credential.role]);

  useEffect(() => {
    if (!showGapProposalForm) return;
    if (gapProposedBimUse.trim()) return;
    if (!selectedBimUse?.label) return;
    setGapProposedBimUse(selectedBimUse.label);
  }, [showGapProposalForm, gapProposedBimUse, selectedBimUse?.label]);

  function setField<K extends keyof WizardForm>(key: K, value: WizardForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSubmitError(null);
    setSubmitInfo(null);
  }

  function validateStep(targetStep: number): string | null {
    if (targetStep >= 1 && !form.bim_use_id) {
      return "Step 1 wajib: pilih BIM Use terlebih dahulu.";
    }
    if (targetStep >= 1 && form.indicator_ids.length === 0) {
      return "Step 1 wajib: pilih 1 indikator.";
    }
    if (targetStep >= 2 && !form.type) {
      return "Step 2 wajib: pilih tipe evidence (FILE/URL/TEXT).";
    }
    if (targetStep >= 2 && form.type === "FILE" && !form.file_type) {
      return "Step 2 wajib: pilih jenis file untuk tipe FILE.";
    }
    if (targetStep >= 3) {
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
    setStep((prev) => Math.min(3, prev + 1));
    setSubmitError(null);
  }

  function onBackStep() {
    setStep((prev) => Math.max(1, prev - 1));
    setSubmitError(null);
  }

  function onSelectIndicator(indicatorId: string) {
    setField("indicator_ids", indicatorId ? [indicatorId] : []);
  }

  function onSelectEvidenceType(type: EvidenceType) {
    setForm((prev) => ({
      ...prev,
      type,
      file_type: type === "FILE" ? prev.file_type : "",
    }));
    setSubmitError(null);
    setSubmitInfo(null);
  }

  function onSelectLocalBinaryFile(file: File | null) {
    if (!file) {
      setLocalFileMeta(null);
      return;
    }
    if (file.size > LOCAL_FILE_SIZE_LIMIT_BYTES) {
      setSubmitError(
        `Ukuran file ${formatBytes(file.size)} melebihi batas prototype ${formatBytes(LOCAL_FILE_SIZE_LIMIT_BYTES)}.`
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl.startsWith("data:")) {
        setSubmitError("Gagal membaca file biner untuk mode prototype.");
        return;
      }
      setForm((prev) => ({
        ...prev,
        file_reference_url: dataUrl,
        file_view_url: "",
        file_download_url: "",
        file_type: prev.file_type || inferFileTypeFromFileMeta(file) || "OTHER",
        title: prev.title || file.name,
      }));
      setLocalFileMeta({ name: file.name, size: file.size });
      setSubmitError(null);
      setSubmitInfo(`File lokal "${file.name}" siap dipakai (prototype local storage).`);
    };
    reader.onerror = () => {
      setSubmitError("Gagal membaca file dari browser.");
    };
    reader.readAsDataURL(file);
  }

  async function onSubmitGapProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (typeof projectId !== "string" || !projectId.trim()) {
      setGapError("Project context tidak valid.");
      return;
    }
    if (credential.role !== "role1") {
      setGapError("Fitur ini khusus Role 1.");
      return;
    }
    if (!proposalActor) {
      setGapError("Sesi user tidak valid. Silakan sign in ulang.");
      return;
    }
    const proposedBimUse = gapProposedBimUse.trim();
    const reason = gapReason.trim();
    if (!proposedBimUse) {
      setGapError("Usulan BIM Use wajib diisi.");
      return;
    }
    if (!reason) {
      setGapError("Alasan pengajuan wajib diisi.");
      return;
    }

    const contextLines = [
      "[ROLE1_EVIDENCE_GAP]",
      `project_id=${projectId}`,
      `selected_bim_use=${selectedBimUseLabel}`,
      `selected_indicator=${selectedIndicatorLabel}`,
      `draft_type=${selectedEvidenceTypeLabel}`,
      `draft_title=${form.title.trim() || NA_TEXT}`,
    ];
    const mergedReason = `${reason}\n\nContext:\n${contextLines.join("\n")}`;

    setGapSubmitting(true);
    setGapError(null);
    setGapInfo(null);
    try {
      await submitRole2BimUseProposal(proposalActor, {
        project_id: projectId,
        proposal_type: "BIM_USE_CREATE",
        proposed_bim_use: proposedBimUse,
        reason: mergedReason,
      });
      setGapReason("");
      setShowGapProposalForm(false);
      setGapInfo("Pengajuan berhasil dikirim ke antrean Role 2. Lanjutkan input evidence setelah mapping tersedia.");
    } catch (err) {
      setGapError(err instanceof Error ? err.message : "Gagal mengirim pengajuan ke Role 2.");
    } finally {
      setGapSubmitting(false);
    }
  }

  async function saveByStatus(status: "DRAFT" | "SUBMITTED") {
    if (!context || typeof projectId !== "string") return;
    if (!canRole1WriteProject(projectId)) {
      setSubmitError("Workspace ini read-only untuk Role 1 Anda. Tambah evidence hanya bisa di workspace scope Anda.");
      return;
    }
    if (!canWriteRole1Evidence(credential.role)) {
      setSubmitError("Role aktif hanya memiliki read-only access. Simpan/Submit dinonaktifkan.");
      return;
    }
    const writeBlockedByMode = isRealBackendWriteEnabled() && context.data_mode === "prototype";
    if (context.period_locked || writeBlockedByMode) {
      setSubmitError(context.period_locked ? LOCKED_READ_ONLY_ERROR : "Backend unavailable");
      return;
    }

    const validationError = validateStep(3);
    if (validationError) {
      setSubmitError(validationError);
      const failingStep =
        !form.bim_use_id || form.indicator_ids.length === 0
          ? 1
          : !form.type || (form.type === "FILE" && !form.file_type)
            ? 2
            : 3;
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

  if (credential.role === "role1" && scopedProjectId && typeof projectId === "string" && scopedProjectId !== projectId) {
    return (
      <main className="task-shell">
        <section className="task-panel">Mengarahkan ke workspace project Anda...</section>
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
  const canWrite = canWriteRole1Evidence(credential.role) && canRole1WriteProject(projectId);
  const fieldDisabled = isLocked || !canWrite;
  const writeDisabled =
    fieldDisabled || isSubmitting || (isRealBackendWriteEnabled() && context.data_mode === "prototype");
  const isRevisionMode = mode === "revisi";
  const isEditingEvidence = typeof evidenceId === "string";
  const showBimUseSelectionCards = !isEditingEvidence && !form.bim_use_id;
  const isBimUseCardActionDisabled = fieldDisabled;

  return (
    <Role1Layout
      projectId={projectId}
      title="Tambahkan Evidence untuk BIM Use"
      subtitle="Pilih card BIM Use workspace, lalu lanjutkan wizard evidence yang sudah ada."
      project={context.project}
      activePeriod={context.active_period}
      periodStatusLabel={context.period_status_label}
      backendMode={context.data_mode}
      backendMessage={bannerHint || context.backend_message}
    >
      <section className="task-panel">
        {isLocked ? (
          <p className="warning-box">
            Period saat ini LOCKED. Semua input read-only dan aksi Save/Submit dinonaktifkan.
          </p>
        ) : null}
        {credential.role === "admin" ? (
          <p className="inline-note">
            Anda sedang menggunakan role <strong>Admin</strong> (read-only untuk input evidence).
            {" "}
            <button
              type="button"
              onClick={() => setStoredCredential({ role: "role1", user_id: credential.user_id })}
            >
              Switch ke BIM Coordinator Project
            </button>
          </p>
        ) : null}
        {!canWrite && credential.role !== "admin" ? (
          <p className="read-only-banner">
            Mode read-only aktif untuk role <strong>{getRoleLabel(credential.role)}</strong>. Aksi Save/Submit
            dinonaktifkan.
          </p>
        ) : null}
        {credential.role === "role1" && !scopedProjectId ? (
          <p className="warning-box">
            Workspace input Role 1 Anda belum ditetapkan admin. Halaman ini hanya read-only sampai scope ditetapkan.
          </p>
        ) : null}

        {isRevisionMode ? (
          <p className="inline-note">
            Mode Revisi aktif. Anda dapat mengubah evidence lalu simpan sebagai Draft atau Submit for Review.
          </p>
        ) : null}

        {showBimUseSelectionCards ? (
          <>
            <h2>Pilih BIM Use Workspace</h2>
            <p className="inline-note">
              Mulai dari card BIM Use. Setiap card menampilkan jumlah evidence yang sudah ditambahkan dan jumlah
              indicator yang tersedia.
            </p>
            {context.bim_uses.length === 0 ? (
              <p className="warning-box">BIM Use belum tersedia dari endpoint. Not available.</p>
            ) : (
              <div className="bim-use-card-grid">
                {context.bim_uses.map((group) => {
                  const evidenceCount = bimUseEvidenceCountById[group.bim_use_id] || 0;
                  return (
                    <article key={group.bim_use_id} className="bim-use-card">
                      <p className="task-kicker">BIM Use</p>
                      <h3>{group.label}</h3>
                      <div className="bim-use-card-metrics">
                        <p>
                          <strong>{evidenceCount}</strong>
                          <small>Evidence ditambahkan</small>
                        </p>
                        <p>
                          <strong>{group.indicators.length}</strong>
                          <small>Indicator tersedia</small>
                        </p>
                      </div>
                      <div className="wizard-actions">
                        <Link
                          href={`/projects/${projectId}/evidence/add?bimUseId=${encodeURIComponent(group.bim_use_id)}`}
                          className={`action-primary${isBimUseCardActionDisabled ? " disabled-link" : ""}`}
                          aria-disabled={isBimUseCardActionDisabled}
                          onClick={(event) => {
                            if (isBimUseCardActionDisabled) event.preventDefault();
                          }}
                        >
                          Lanjut Input Evidence
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
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
            <div className="task-note">
              <p>
                <strong>Ringkasan Pilihan Saat Ini</strong>
              </p>
              <p>Step 1 - BIM Use: {selectedBimUseLabel}</p>
              <p>Step 1 - Indicator: {selectedIndicatorLabel}</p>
              <p>Step 2 - Evidence Type: {selectedEvidenceTypeLabel}</p>
              <p>Step 2 - Jenis File: {selectedFileTypeLabel}</p>
            </div>

            {step === 1 ? (
              <div className="field-grid">
                <p>
                  BIM Use terpilih: <strong>{selectedBimUseLabel}</strong>
                </p>
                {!isEditingEvidence ? (
                  <div className="wizard-actions">
                    <Link href={`/projects/${projectId}/evidence/add`}>Ganti BIM Use</Link>
                  </div>
                ) : null}
                <p>Pilih satu indikator yang paling relevan untuk evidence ini.</p>
                {form.bim_use_id ? (
                  <>
                    <label htmlFor="indicator-select">
                      Indicator
                      <select
                        id="indicator-select"
                        value={form.indicator_ids[0] || ""}
                        onChange={(event) => onSelectIndicator(event.target.value)}
                        disabled={fieldDisabled}
                      >
                        <option value="">Pilih indikator</option>
                        {indicators.map((indicator) => (
                          <option key={indicator.id} value={indicator.id}>
                            {indicator.code} - {indicator.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedIndicator ? (
                      <p className="inline-note">
                        Indicator terpilih: <strong>{selectedIndicator.code}</strong> | Perspective:{" "}
                        {selectedIndicator.perspective_id || NA_TEXT} | BIM Use:{" "}
                        {selectedIndicator.bim_use_tags.length
                          ? selectedIndicator.bim_use_tags.join(", ")
                          : NA_TEXT}
                      </p>
                    ) : (
                      <p className="inline-note">Belum ada indikator terpilih.</p>
                    )}
                  </>
                ) : (
                  <p className="warning-box">Pilih BIM Use dari card workspace terlebih dahulu.</p>
                )}

                {form.bim_use_id && indicators.length === 0 ? (
                  <p className="warning-box">Indicator untuk BIM Use ini Not available.</p>
                ) : null}

                <div className="task-note">
                  <p>
                    <strong>Tidak menemukan BIM Use/Indicator yang cocok?</strong>
                  </p>
                  <p className="inline-note">
                    Ajukan kebutuhan mapping ke Role 2. Role 1 tidak dapat menambah indikator secara langsung.
                  </p>
                  <div className="wizard-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setShowGapProposalForm((prev) => !prev);
                        setGapError(null);
                        setGapInfo(null);
                      }}
                      disabled={credential.role !== "role1" || !proposalActor || gapSubmitting}
                    >
                      {showGapProposalForm ? "Tutup Form Pengajuan" : "Ajukan ke Role 2"}
                    </button>
                  </div>
                  {showGapProposalForm ? (
                    <form className="field-grid" onSubmit={(event) => void onSubmitGapProposal(event)}>
                      <label>
                        Usulan BIM Use
                        <input
                          value={gapProposedBimUse}
                          onChange={(event) => setGapProposedBimUse(event.target.value)}
                          placeholder="Contoh: Clash Coordination - Structural"
                          disabled={gapSubmitting}
                        />
                      </label>
                      <label>
                        Alasan Pengajuan
                        <textarea
                          value={gapReason}
                          onChange={(event) => setGapReason(event.target.value)}
                          placeholder="Jelaskan kenapa evidence tidak cocok dengan BIM Use/Indicator yang tersedia."
                          rows={4}
                          disabled={gapSubmitting}
                        />
                      </label>
                      <div className="wizard-actions">
                        <button type="submit" className="action-primary" disabled={gapSubmitting}>
                          {gapSubmitting ? "Mengirim..." : "Kirim Pengajuan"}
                        </button>
                      </div>
                    </form>
                  ) : null}
                  {gapError ? <p className="error-box">{gapError}</p> : null}
                  {gapInfo ? <p className="task-note action-feedback">{gapInfo}</p> : null}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="field-grid">
                <label htmlFor="evidence-type">
                  Evidence Type
                  <select
                    id="evidence-type"
                    value={form.type}
                    onChange={(event) => onSelectEvidenceType(event.target.value as EvidenceType)}
                    disabled={fieldDisabled}
                  >
                    <option value="">Pilih tipe evidence</option>
                    {(["FILE", "URL", "TEXT"] as EvidenceType[]).map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                {form.type === "FILE" ? (
                  <label htmlFor="file-type-select">
                    Jenis File
                    <select
                      id="file-type-select"
                      value={form.file_type}
                      onChange={(event) => setField("file_type", event.target.value as WizardForm["file_type"])}
                      disabled={fieldDisabled}
                    >
                      <option value="">Pilih jenis file</option>
                      <option value="PDF">PDF</option>
                      <option value="IMAGE">Image</option>
                      <option value="DOC">Document</option>
                      <option value="SPREADSHEET">Spreadsheet</option>
                      <option value="MODEL">BIM Model</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </label>
                ) : null}
                <p className="inline-note">{renderTypeHint(form.type)}</p>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="field-grid">
                <label htmlFor="title-input">
                  Title
                  <input
                    id="title-input"
                    value={form.title}
                    onChange={(event) => setField("title", event.target.value)}
                    disabled={fieldDisabled}
                    maxLength={160}
                  />
                </label>

                <label htmlFor="description-input">
                  Description
                  <textarea
                    id="description-input"
                    value={form.description}
                    onChange={(event) => setField("description", event.target.value)}
                    disabled={fieldDisabled}
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
                      disabled={fieldDisabled}
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
                      disabled={fieldDisabled}
                      placeholder="Tuliskan konteks evidence sebagai plain text"
                    />
                  </label>
                ) : null}

                {form.type === "FILE" ? (
                  <>
                    <p className="inline-note">
                      Jenis file: <strong>{form.file_type || "Belum dipilih"}</strong>
                    </p>
                    <label htmlFor="file-binary-upload">
                      Upload binary file (prototype local)
                      <input
                        id="file-binary-upload"
                        type="file"
                        accept={buildFileAccept(form.file_type)}
                        onChange={(event) => onSelectLocalBinaryFile(event.target.files?.[0] || null)}
                        disabled={fieldDisabled}
                      />
                    </label>
                    <details className="collapsible-section">
                      <summary className="collapsible-summary">
                        Field URL Optional (default tertutup)
                      </summary>
                      <div className="collapsible-content">
                        <label htmlFor="file-view-url-input">
                          view_url ({form.file_type || "FILE"} - optional)
                          <input
                            id="file-view-url-input"
                            value={form.file_view_url}
                            onChange={(event) => setField("file_view_url", event.target.value)}
                            disabled={fieldDisabled}
                            placeholder="https://..."
                          />
                        </label>

                        <label htmlFor="file-download-url-input">
                          download_url ({form.file_type || "FILE"} - optional)
                          <input
                            id="file-download-url-input"
                            value={form.file_download_url}
                            onChange={(event) => setField("file_download_url", event.target.value)}
                            disabled={fieldDisabled}
                            placeholder="https://..."
                          />
                        </label>

                        <label htmlFor="file-reference-url-input">
                          single reference URL ({form.file_type || "FILE"} - optional)
                          <input
                            id="file-reference-url-input"
                            value={form.file_reference_url}
                            onChange={(event) => setField("file_reference_url", event.target.value)}
                            disabled={fieldDisabled}
                            placeholder="https://..."
                          />
                        </label>
                      </div>
                    </details>
                  </>
                ) : null}

                {!form.type ? (
                  <p className="warning-box">Tipe evidence pada Step 2 belum dipilih.</p>
                ) : null}
              </div>
            ) : null}

            <div className="wizard-actions">
              <button type="button" onClick={onBackStep} disabled={step === 1}>
                Back
              </button>
              {step < 3 ? (
                <button type="button" onClick={onNextStep}>
                  Next
                </button>
              ) : null}
              {step === 3 ? (
                <>
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
                </>
              ) : null}
              {!isEditingEvidence ? <Link href={`/projects/${projectId}/evidence/add`}>Kembali ke Card BIM Use</Link> : null}
              <Link href={`/projects/${projectId}/evidence`}>Go to My Evidence List</Link>
            </div>

            <p className="inline-note">Evidence akan direview dan tidak langsung memengaruhi skor.</p>
            {form.type === "FILE" ? (
              <p className="inline-note">
                Upload file biner saat ini disimpan di browser local storage (batas {formatBytes(LOCAL_FILE_SIZE_LIMIT_BYTES)} per file).
              </p>
            ) : null}
            {form.type === "FILE" && localFileMeta ? (
              <p className="inline-note">
                File lokal aktif: <strong>{localFileMeta.name}</strong> ({formatBytes(localFileMeta.size)}).
              </p>
            ) : null}
            {form.type === "FILE" && form.file_reference_url.startsWith("data:") ? (
              <p className="inline-note">Reference URL saat ini menggunakan binary data URL (local prototype).</p>
            ) : null}
            <p className="prototype-badge">Local draft (prototype, not used in scoring)</p>
          </>
        )}

        {submitError ? <p className="error-box">{submitError}</p> : null}
        {submitInfo ? <p className="task-note action-feedback">{submitInfo}</p> : null}
      </section>
    </Role1Layout>
  );
}

