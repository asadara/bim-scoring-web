import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import BackendStatusBanner from "@/components/BackendStatusBanner";
import Role1Layout from "@/components/Role1Layout";
import { canWriteRole1Evidence } from "@/lib/accessControl";
import {
  NA_TEXT,
  buildEvidenceCounts,
  fetchRole1Context,
  listLocalEvidenceWithReview,
  statusLabel,
} from "@/lib/role1TaskLayer";
import { useCredential } from "@/lib/useCredential";
import { getRoleLabel, setStoredCredential } from "@/lib/userCredential";

export default function ProjectRole1HomePage() {
  const router = useRouter();
  const { projectId } = router.query;
  const credential = useCredential();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<Awaited<ReturnType<typeof fetchRole1Context>> | null>(null);
  const [localItems, setLocalItems] = useState<ReturnType<typeof listLocalEvidenceWithReview>>([]);

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

    const refresh = () => {
      const items = listLocalEvidenceWithReview(projectId, context.active_period?.id ?? null);
      setLocalItems(items);
    };

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [context, projectId]);

  const counts = useMemo(() => buildEvidenceCounts(localItems), [localItems]);

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
          <h1>Evidence Tasks - Proyek</h1>
          <p className="error-box">{error || "Project context not found."}</p>
          <p>
            <Link href="/projects">Kembali ke Projects</Link>
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

  return (
    <Role1Layout
      projectId={projectId}
      title="Evidence Tasks - Proyek"
      subtitle="Task-first panel untuk menyiapkan evidence berdasarkan BIM Use dan indikator."
      project={context.project}
      activePeriod={context.active_period}
      periodStatusLabel={context.period_status_label}
    >
      {error ? <p className="error-box">{error}</p> : null}
      <BackendStatusBanner mode={context.data_mode} message={context.backend_message} />

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
            <strong>BIM Coordinator Project</strong> untuk menambah evidence.
            {" "}
            <button
              type="button"
              onClick={() => setStoredCredential({ role: "role1", user_id: credential.user_id })}
            >
              Switch Role Sekarang
            </button>
          </p>
        ) : null}
        {!canWriteEvidence && credential.role !== "admin" ? (
          <p className="read-only-banner">
            Mode read-only aktif untuk role <strong>{getRoleLabel(credential.role)}</strong>. Aksi input evidence
            dinonaktifkan.
          </p>
        ) : null}

        <div className="wizard-actions">
          <button
            type="button"
            className="action-primary"
            onClick={() => router.push(`/projects/${projectId}/evidence/add`)}
            disabled={!canAddEvidence}
          >
            Tambahkan Evidence untuk BIM Use
          </button>
          <Link href={`/projects/${projectId}/evidence`} className="secondary-link">
            Lihat My Evidence List
          </Link>
        </div>

        <p className="inline-note">Evidence akan direview dan tidak langsung memengaruhi skor.</p>
      </section>

      {localItems.length > 0 ? (
        <section className="task-panel">
          <h3>Prototype Storage</h3>
          <p className="prototype-badge">Local draft (prototype, not used in scoring)</p>
          <p>
            {localItems.length} item disimpan sementara di localStorage untuk alur draft/submitted sampai endpoint write tersedia.
          </p>
        </section>
      ) : null}
    </Role1Layout>
  );
}
