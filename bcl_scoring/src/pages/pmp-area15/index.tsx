import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import CorporateTopbar from "@/components/CorporateTopbar";
import HeaderContextCard from "@/components/HeaderContextCard";
import PmpArea15CompliancePanel from "@/components/PmpArea15CompliancePanel";
import QuickAccessNav from "@/components/QuickAccessNav";
import { fetchReadOnlySummaryReadMode, type PmpArea15ComplianceSummary } from "@/lib/approverTaskLayer";
import { canRoleAccessPath } from "@/lib/accessControl";
import {
  NA_TEXT,
  fetchProjectPeriodsReadMode,
  fetchProjectsReadMode,
  formatPeriodLabel,
  selectActivePeriod,
  type DataMode,
  type ProjectRecord,
  type ScoringPeriod,
} from "@/lib/role1TaskLayer";
import {
  listPmpArea15Inputs,
  submitPmpArea15Input,
  type PmpArea15InputRow,
} from "@/lib/pmpArea15InputClient";
import { useCredential } from "@/lib/useCredential";

function sortProjects(rows: ProjectRecord[]): ProjectRecord[] {
  return [...rows].sort((a, b) =>
    String(a.name || a.code || a.id).localeCompare(String(b.name || b.code || b.id))
  );
}

function pickInitialProject(rows: ProjectRecord[], scopedProjectIds: string[]): ProjectRecord | null {
  if (!rows.length) return null;
  const scoped = rows.find((item) => scopedProjectIds.includes(item.id));
  if (scoped) return scoped;
  const active = rows.find((item) => item.is_active !== false);
  return active || rows[0] || null;
}

function pickInitialPeriod(rows: ScoringPeriod[]): ScoringPeriod | null {
  return selectActivePeriod(rows) || rows[0] || null;
}

function formatDateText(value: string | null): string {
  if (!value) return NA_TEXT;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function canWritePmpArea15Input(role: string): boolean {
  return role === "admin" || role === "role2" || role === "role3";
}

export default function PmpArea15LandingPage() {
  const credential = useCredential();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [periods, setPeriods] = useState<ScoringPeriod[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [summary, setSummary] = useState<PmpArea15ComplianceSummary | null>(null);
  const [inputRows, setInputRows] = useState<PmpArea15InputRow[]>([]);
  const [inputTableReady, setInputTableReady] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingInputs, setLoadingInputs] = useState(false);
  const [dataMode, setDataMode] = useState<DataMode>("backend");
  const [backendMessage, setBackendMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [scoreDraft, setScoreDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("SUBMITTED");
  const [sourceDraft, setSourceDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [isSubmittingInput, setIsSubmittingInput] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const scopedProjectIds = useMemo(
    () =>
      Array.isArray(credential.scoped_project_ids)
        ? credential.scoped_project_ids.map((item) => String(item || "").trim()).filter(Boolean)
        : [],
    [credential.scoped_project_ids]
  );

  const selectedProject = useMemo(
    () => projects.find((item) => item.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );
  const selectedPeriod = useMemo(
    () => periods.find((item) => item.id === selectedPeriodId) || null,
    [periods, selectedPeriodId]
  );
  const latestInput = inputRows[0] || null;
  const canWriteInput = canWritePmpArea15Input(credential.role);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingProjects(true);
        setError(null);
        const result = await fetchProjectsReadMode();
        if (!mounted) return;
        const projectRows = sortProjects(result.data);
        const initialProject = pickInitialProject(projectRows, scopedProjectIds);
        setProjects(projectRows);
        setSelectedProjectId(initialProject?.id || "");
        setDataMode(result.mode);
        setBackendMessage(result.backend_message);
      } catch (e) {
        if (!mounted) return;
        setProjects([]);
        setSelectedProjectId("");
        setError(e instanceof Error ? e.message : "Gagal memuat workspace PMP Area 15.");
      } finally {
        if (mounted) setLoadingProjects(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [scopedProjectIds]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedProjectId) {
        setLoadingPeriods(false);
        setPeriods([]);
        setSelectedPeriodId("");
        return;
      }

      try {
        setLoadingPeriods(true);
        const result = await fetchProjectPeriodsReadMode(selectedProjectId);
        if (!mounted) return;
        const initialPeriod = pickInitialPeriod(result.data);
        setPeriods(result.data);
        setSelectedPeriodId(initialPeriod?.id || "");
        setDataMode(result.mode);
        setBackendMessage(result.backend_message);
      } catch (e) {
        if (!mounted) return;
        setPeriods([]);
        setSelectedPeriodId("");
        setError(e instanceof Error ? e.message : "Gagal memuat scoring period.");
      } finally {
        if (mounted) setLoadingPeriods(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedProjectId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedProjectId || !selectedPeriodId) {
        setLoadingSummary(false);
        setSummary(null);
        return;
      }

      try {
        setLoadingSummary(true);
        setError(null);
        const result = await fetchReadOnlySummaryReadMode(selectedProjectId, selectedPeriodId);
        if (!mounted) return;
        setSummary(result.data.compliance);
        setDataMode(result.mode);
        setBackendMessage(result.backend_message);
      } catch (e) {
        if (!mounted) return;
        setSummary(null);
        setError(e instanceof Error ? e.message : "Gagal memuat bridge PMP Area 15.");
      } finally {
        if (mounted) setLoadingSummary(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedProjectId, selectedPeriodId, refreshKey]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedProjectId || !selectedPeriodId) {
        setInputRows([]);
        setInputTableReady(true);
        setLoadingInputs(false);
        setScoreDraft("");
        setSourceDraft("");
        setNotesDraft("");
        return;
      }

      try {
        setLoadingInputs(true);
        setInputError(null);
        const result = await listPmpArea15Inputs(selectedProjectId, selectedPeriodId);
        if (!mounted) return;
        setInputRows(result.rows);
        setInputTableReady(result.table_ready);
        const latest = result.rows[0] || null;
        setScoreDraft(latest?.score_0_5 === null || typeof latest?.score_0_5 === "undefined" ? "" : String(latest.score_0_5));
        setStatusDraft(latest?.status || "SUBMITTED");
        setSourceDraft(latest?.source_reference || "");
        setNotesDraft(latest?.notes || "");
      } catch (e) {
        if (!mounted) return;
        setInputRows([]);
        setInputError(e instanceof Error ? e.message : "Gagal memuat input PMP Area 15.");
      } finally {
        if (mounted) setLoadingInputs(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedProjectId, selectedPeriodId, refreshKey]);

  async function onSubmitInput() {
    setInputError(null);
    setInputMessage(null);

    if (!selectedProjectId || !selectedPeriodId) {
      setInputError("Pilih workspace dan period lebih dulu.");
      return;
    }
    const score = Number(scoreDraft);
    if (!Number.isFinite(score) || score < 0 || score > 5) {
      setInputError("Score PMP15 wajib angka 0 sampai 5.");
      return;
    }

    try {
      setIsSubmittingInput(true);
      await submitPmpArea15Input(selectedProjectId, selectedPeriodId, {
        score_0_5: score,
        status: statusDraft,
        source_reference: sourceDraft,
        notes: notesDraft,
      });
      setInputMessage("Input PMP Area 15 tersimpan. Summary dikalibrasi ulang.");
      setRefreshKey((value) => value + 1);
    } catch (e) {
      setInputError(e instanceof Error ? e.message : "Gagal menyimpan input PMP Area 15.");
    } finally {
      setIsSubmittingInput(false);
    }
  }

  const connectionLabel =
    dataMode === "backend" ? "Connected (live data)" : dataMode === "prototype" ? "Read mode fallback" : null;
  const connectionTone = dataMode === "backend" ? "open" : "lock";
  const contextItems = [
    { label: "Workspace", value: selectedProject?.name || selectedProject?.code || NA_TEXT },
    { label: "Period", value: selectedPeriod ? formatPeriodLabel(selectedPeriod) : NA_TEXT },
    { label: "Mode", value: dataMode === "backend" ? "Backend summary" : "Prototype fallback" },
  ];
  const canAccessAdmin = canRoleAccessPath(credential.role, "/admin");
  const canAccessAudit = canRoleAccessPath(credential.role, "/audit");
  const canAccessProjects = canRoleAccessPath(credential.role, "/projects");

  return (
    <main className="task-shell page-corporate-shell">
      <CorporateTopbar connectionLabel={connectionLabel} connectionTone={connectionTone} />

      <header className="task-header role-hero page-hero-card">
        <div className="role-hero-grid">
          <div className="role-hero-main">
            <p className="task-kicker">Governance Bridge</p>
            <h1>PMP Area 15</h1>
            <p className="task-subtitle">
              Input eksternal PMP Area 15 sebagai kalibrasi optional untuk BIM Scoring tanpa mengunci keputusan Role 3.
            </p>
            <div className="landing-chip-row">
              <span className="status-chip status-na">Single access point</span>
              <span className="status-chip status-na">Optional score calibration</span>
            </div>
          </div>

          <HeaderContextCard title="Reporting Context" items={contextItems} />
        </div>
      </header>

      <QuickAccessNav
        title="PMP Navigation"
        ariaLabel="PMP Area 15 shortcuts"
        items={[
          { label: "PMP Area 15", href: "/pmp-area15" },
          { label: "Dashboard", href: "/" },
          { label: "Audit", href: canAccessAudit ? "/audit" : null },
          { label: "Admin", href: canAccessAdmin ? "/admin" : null },
          { label: "Projects", href: canAccessProjects ? "/projects" : null },
        ]}
      />

      <section className="task-panel">
        <h2>PMP Area 15 Selector</h2>
        <div className="field-grid">
          <label>
            Workspace Project
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              disabled={loadingProjects || projects.length === 0}
            >
              <option value="">{loadingProjects ? "Memuat workspace..." : "Pilih workspace"}</option>
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name || item.code || item.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scoring Period
            <select
              value={selectedPeriodId}
              onChange={(event) => setSelectedPeriodId(event.target.value)}
              disabled={!selectedProjectId || loadingPeriods || periods.length === 0}
            >
              <option value="">{loadingPeriods ? "Memuat period..." : "Pilih period"}</option>
              {periods.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatPeriodLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="inline-note">
          Gunakan halaman ini sebagai pintu masuk tetap untuk PMP Area 15. Detail operasional tetap bisa dilanjutkan ke{" "}
          <Link href="/">Dashboard</Link>, <Link href="/audit">Audit</Link>, dan{" "}
          {canAccessAdmin ? <Link href="/admin">Admin</Link> : <span>Admin</span>}.
        </p>
        {backendMessage ? <p className="task-note">{backendMessage}</p> : null}
        {error ? <p className="error-box">{error}</p> : null}
      </section>

      <section className="task-panel">
        <h2>Input Score PMP Area 15</h2>
        {!canWriteInput ? (
          <p className="read-only-banner">
            Role <strong>{credential.role}</strong> hanya dapat membaca input PMP Area 15.
          </p>
        ) : null}
        {!inputTableReady ? (
          <p className="warning-box">
            Tabel input PMP Area 15 belum tersedia di Supabase. Jalankan migrasi{" "}
            <code>docs/ops/sql/create-pmp-area15-inputs.sql</code> sebelum menyimpan score.
          </p>
        ) : null}
        {latestInput ? (
          <div className="task-grid-3">
            <article className="summary-card">
              <span>Latest PMP15 score</span>
              <strong>{latestInput.score_0_5 ?? NA_TEXT}</strong>
              <small>{latestInput.score_100 ?? NA_TEXT}/100</small>
            </article>
            <article className="summary-card">
              <span>Status</span>
              <strong>{latestInput.status || NA_TEXT}</strong>
              <small>{formatDateText(latestInput.input_at || latestInput.updated_at)}</small>
            </article>
            <article className="summary-card">
              <span>Adjusted BIM score</span>
              <strong>
                {summary?.scoring_adjustment?.adjusted_total_score_100 ??
                  summary?.total_bim_score_100 ??
                  NA_TEXT}
              </strong>
              <small>Bonus {summary?.scoring_adjustment?.bonus_score_100 ?? 0}</small>
            </article>
          </div>
        ) : (
          <p className="inline-note">
            Belum ada input PMP Area 15 untuk project dan period ini. BIM score tetap berjalan normal tanpa bonus.
          </p>
        )}

        <div className="field-grid">
          <label htmlFor="pmp15-score">
            PMP15 score (0-5)
            <input
              id="pmp15-score"
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={scoreDraft}
              onChange={(event) => setScoreDraft(event.target.value)}
              disabled={!canWriteInput || !inputTableReady || !selectedProjectId || !selectedPeriodId || isSubmittingInput}
            />
          </label>
          <label htmlFor="pmp15-status">
            Status dokumen PMP
            <select
              id="pmp15-status"
              value={statusDraft}
              onChange={(event) => setStatusDraft(event.target.value)}
              disabled={!canWriteInput || !inputTableReady || isSubmittingInput}
            >
              <option value="DRAFT">DRAFT</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REVISED">REVISED</option>
            </select>
          </label>
          <label htmlFor="pmp15-source">
            Referensi sumber
            <input
              id="pmp15-source"
              value={sourceDraft}
              onChange={(event) => setSourceDraft(event.target.value)}
              placeholder="Contoh: PMP workbook rev. 02 / link dokumen"
              disabled={!canWriteInput || !inputTableReady || isSubmittingInput}
            />
          </label>
        </div>
        <label htmlFor="pmp15-notes">
          Catatan kalibrasi
          <textarea
            id="pmp15-notes"
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            placeholder="Ringkas dasar score PMP15 eksternal."
            disabled={!canWriteInput || !inputTableReady || isSubmittingInput}
          />
        </label>
        <div className="wizard-actions">
          <button
            type="button"
            className="action-primary"
            onClick={() => void onSubmitInput()}
            disabled={!canWriteInput || !inputTableReady || !selectedProjectId || !selectedPeriodId || isSubmittingInput}
          >
            {isSubmittingInput ? "Menyimpan..." : "Simpan Input PMP15"}
          </button>
        </div>
        {loadingInputs ? <p className="task-note">Memuat riwayat input PMP15...</p> : null}
        {inputMessage ? <p className="task-note action-feedback">{inputMessage}</p> : null}
        {inputError ? <p className="error-box">{inputError}</p> : null}
      </section>

      <section className="task-panel">
        <h2>Riwayat Input PMP15</h2>
        {inputRows.length === 0 ? (
          <p className="empty-state">Belum ada input PMP15 untuk period ini.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="audit-table responsive-stack-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Input By</th>
                  <th>Referensi</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {inputRows.map((item, index) => (
                  <tr key={item.id || `${item.input_at}-${index}`}>
                    <td>{formatDateText(item.input_at || item.updated_at || item.created_at)}</td>
                    <td>
                      {item.score_0_5 ?? NA_TEXT}
                      <small> / {item.score_100 ?? NA_TEXT}</small>
                    </td>
                    <td>{item.status || NA_TEXT}</td>
                    <td>{item.input_by || item.created_by || NA_TEXT}</td>
                    <td>{item.source_reference || NA_TEXT}</td>
                    <td>{item.notes || NA_TEXT}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {loadingSummary ? <p className="task-note">Memuat bridge PMP Area 15...</p> : null}
      <PmpArea15CompliancePanel
        summary={summary}
        title="PMP Area 15 Governance Readout"
        showControls={false}
      />
    </main>
  );
}
