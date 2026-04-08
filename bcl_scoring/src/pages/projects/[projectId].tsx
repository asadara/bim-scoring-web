import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import PmpArea15ActionList from "@/components/PmpArea15ActionList";
import PmpArea15CompliancePanel from "@/components/PmpArea15CompliancePanel";
import Role1Layout from "@/components/Role1Layout";
import { canWriteRole1Evidence } from "@/lib/accessControl";
import { fetchReadOnlySummaryReadMode } from "@/lib/approverTaskLayer";
import { getPrimaryActionText, useAppLanguage } from "@/lib/language";
import { exportPmpArea15Workbook } from "@/lib/pmpArea15Export";
import {
  DataMode,
  NA_TEXT,
  buildEvidenceCounts,
  fetchEvidenceListReadMode,
  fetchRole1Context,
  mapEvidenceRowsWithReview,
  statusLabel,
} from "@/lib/role1TaskLayer";
import { useCredential } from "@/lib/useCredential";
import { getRoleLabel, isManualRoleSwitchEnabled, setStoredCredential } from "@/lib/userCredential";

export default function ProjectRole1HomePage() {
  const router = useRouter();
  const { projectId } = router.query;
  const credential = useCredential();
  const language = useAppLanguage();
  const actionText = useMemo(() => getPrimaryActionText(language), [language]);
  const manualRoleSwitchEnabled = isManualRoleSwitchEnabled();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<Awaited<ReturnType<typeof fetchRole1Context>> | null>(null);
  const [evidenceRows, setEvidenceRows] = useState<ReturnType<typeof mapEvidenceRowsWithReview>>([]);
  const [evidenceMode, setEvidenceMode] = useState<DataMode>("backend");
  const [evidenceMessage, setEvidenceMessage] = useState<string | null>(null);
  const [summaryCompliance, setSummaryCompliance] = useState<Awaited<ReturnType<typeof fetchReadOnlySummaryReadMode>>["data"]["compliance"]>(null);
  const [summaryMessage, setSummaryMessage] = useState<string | null>(null);
  const [exportInfo, setExportInfo] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const scopedProjectId = useMemo(() => {
    if (credential.role !== "role1") return null;
    const scopedIds = Array.isArray(credential.scoped_project_ids)
      ? credential.scoped_project_ids.map((id) => String(id || "").trim()).filter(Boolean)
      : [];
    return scopedIds[0] || null;
  }, [credential.role, credential.scoped_project_ids]);

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
    void router.replace(`/projects/${scopedProjectId}`);
  }, [credential.role, projectId, router, router.isReady, scopedProjectId]);

  useEffect(() => {
    if (!context || typeof projectId !== "string") return;

    let mounted = true;
    const refresh = () => {
      fetchEvidenceListReadMode(projectId, context.active_period?.id ?? null)
        .then((result) => {
          if (!mounted) return;
          setEvidenceRows(mapEvidenceRowsWithReview(result.data));
          setEvidenceMode(result.mode);
          setEvidenceMessage(result.backend_message);
        })
        .catch((e) => {
          if (!mounted) return;
          setEvidenceRows([]);
          setEvidenceMode("backend");
          setEvidenceMessage(e instanceof Error ? e.message : "Backend not available");
        });
    };

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      mounted = false;
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [context, projectId]);

  useEffect(() => {
    if (!context || typeof projectId !== "string") return;

    let mounted = true;
    const refresh = () => {
      fetchReadOnlySummaryReadMode(projectId, context.active_period?.id ?? null)
        .then((result) => {
          if (!mounted) return;
          setSummaryCompliance(result.data.compliance);
          setSummaryMessage(result.backend_message);
        })
        .catch((e) => {
          if (!mounted) return;
          setSummaryCompliance(null);
          setSummaryMessage(e instanceof Error ? e.message : "Summary not available");
        });
    };

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      mounted = false;
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [context, projectId]);

  const counts = useMemo(() => buildEvidenceCounts(evidenceRows), [evidenceRows]);

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
          <h1>{typeof projectId === "string" ? `Evidence Tasks - ${projectId}` : "Evidence Tasks"}</h1>
          <p className="error-box">{error || "Project context not found."}</p>
          <p>
            <Link href="/projects">{actionText.backToProjects}</Link>
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
  const canWriteEvidence = canWriteRole1Evidence(credential.role);
  const hasActivePeriod = Boolean(context.active_period?.id);
  const canAddEvidence = canWriteEvidence && !context.period_locked && hasActivePeriod;
  const activePeriod = context.active_period;
  const projectDisplayName = context.project?.name || context.project?.code || projectId;
  const headerTitle = `Evidence Tasks - ${projectDisplayName}`;

  async function onExportPmpArea15() {
    if (!summaryCompliance || typeof projectId !== "string") {
      setExportInfo("Bridge PMP Area 15 belum tersedia untuk diekspor.");
      return;
    }

    try {
      setIsExporting(true);
      const fileName = await exportPmpArea15Workbook({
        summary: summaryCompliance,
        project_label: projectDisplayName,
        project_id: projectId,
        period_label:
          activePeriod && activePeriod.year !== null && activePeriod.week !== null
            ? `${activePeriod.year} W${activePeriod.week}`
            : activePeriod?.id || null,
        period_id: activePeriod?.id ?? null,
      });
      setExportInfo(`Export Excel selesai (${fileName}).`);
    } catch (e) {
      setExportInfo(e instanceof Error ? e.message : "Gagal generate Excel PMP Area 15.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Role1Layout
      projectId={projectId}
      title={headerTitle}
      subtitle="Task-first panel untuk menyiapkan evidence berdasarkan BIM Use dan indikator."
      project={context.project}
      activePeriod={context.active_period}
      periodStatusLabel={context.period_status_label}
      backendMode={context.data_mode === "prototype" || evidenceMode === "prototype" ? "prototype" : "backend"}
      backendMessage={context.backend_message || evidenceMessage}
    >
      {error ? <p className="error-box">{error}</p> : null}

      <section className="task-panel">
        <h2>Aksi Utama</h2>
        <div className="wizard-actions">
          <button
            type="button"
            className="action-primary"
            onClick={() => router.push(`/projects/${projectId}/evidence/add`)}
            disabled={!canAddEvidence}
          >
            {actionText.addEvidenceForBimUse}
          </button>
          <Link href={`/projects/${projectId}/evidence`} className="secondary-link">
            {actionText.viewMyEvidenceList}
          </Link>
        </div>
      </section>

      <section className="task-grid-3" aria-label="Evidence status summary">
        <Link className="summary-card summary-card-action" href={`/projects/${projectId}/evidence#draft`}>
          <span>{statusLabel("DRAFT")}</span>
          <strong>{counts.DRAFT}</strong>
          <small>Open draft bucket</small>
        </Link>
        <Link className="summary-card summary-card-action" href={`/projects/${projectId}/evidence#submitted`}>
          <span>{statusLabel("SUBMITTED")}</span>
          <strong>{counts.SUBMITTED}</strong>
          <small>Open submitted bucket</small>
        </Link>
        <Link className="summary-card summary-card-action" href={`/projects/${projectId}/evidence#needs-revision`}>
          <span>{statusLabel("NEEDS_REVISION")}</span>
          <strong>{counts.NEEDS_REVISION}</strong>
          <small>Open revision bucket</small>
        </Link>
      </section>

      <section className="task-panel">
        <h2>Periode Aktif</h2>
        <p>
          Status: <span className={statusClass}>{context.period_status_label || NA_TEXT}</span>
        </p>
        {!hasActivePeriod ? (
          <p className="inline-note">
            Belum ada period aktif untuk project ini. Admin dapat menambahkan period di halaman{" "}
            <Link href="/admin">Admin Control Panel</Link>.
          </p>
        ) : null}
        {context.period_locked ? (
          <p className="warning-box">
            Period sudah LOCKED; input evidence tidak dapat dilakukan.
          </p>
        ) : null}
        {credential.role === "admin" ? (
          <p className="inline-note">
            Anda sedang menggunakan role <strong>Admin</strong> (read-only untuk input evidence). Gunakan role{" "}
            <strong>BIM Coordinator Project</strong> yang memang ditetapkan admin untuk menambah evidence.
            {manualRoleSwitchEnabled ? (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() =>
                    setStoredCredential({
                      role: "role1",
                      user_id: credential.user_id,
                      scoped_project_ids: typeof projectId === "string" ? [projectId] : [],
                    })
                  }
                >
                  {actionText.switchRoleNow}
                </button>
              </>
            ) : null}
          </p>
        ) : null}
        {!canWriteEvidence && credential.role !== "admin" ? (
          <p className="read-only-banner">
            Mode read-only aktif untuk role <strong>{getRoleLabel(credential.role)}</strong>. Aksi input evidence
            dinonaktifkan.
          </p>
        ) : null}

      </section>

      <PmpArea15ActionList projectId={projectId} summary={summaryCompliance} />

      <PmpArea15CompliancePanel summary={summaryCompliance} title="PMP Area 15 Governance Readout" />

      <section className="task-panel">
        <h2>Generate PMP Area 15</h2>
        <p>
          Output Excel dibuat dari BIM Scoring dan bridge compliance, bukan dari input manual pada file Excel.
        </p>
        {summaryMessage ? <p className="task-note">{summaryMessage}</p> : null}
        <div className="wizard-actions">
          <button type="button" onClick={() => void onExportPmpArea15()} disabled={!summaryCompliance || isExporting}>
            {isExporting ? "Generating Excel..." : "Export PMP Area 15 (.xlsx)"}
          </button>
        </div>
        {exportInfo ? <p className="task-note action-feedback">{exportInfo}</p> : null}
      </section>

    </Role1Layout>
  );
}
