import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import BackendStatusBanner from "@/components/BackendStatusBanner";
import Role1Layout from "@/components/Role1Layout";
import { canWriteRole1Evidence } from "@/lib/accessControl";
import {
  DataMode,
  LocalEvidenceWithReview,
  NA_TEXT,
  formatBimUseDisplay,
  fetchEvidenceListReadMode,
  fetchRole1Context,
  mapEvidenceRowsWithReview,
  statusLabel,
} from "@/lib/role1TaskLayer";
import { useCredential } from "@/lib/useCredential";
import { getRoleLabel, setStoredCredential } from "@/lib/userCredential";

type GroupedEvidence = {
  DRAFT: EvidenceViewItem[];
  SUBMITTED: EvidenceViewItem[];
  NEEDS_REVISION: EvidenceViewItem[];
};

type EvidenceViewItem = LocalEvidenceWithReview;

function renderEvidenceValue(item: LocalEvidenceWithReview) {
  if (item.type === "TEXT") {
    return (
      <p>
        TEXT: <span>{item.text_content || NA_TEXT}</span>
      </p>
    );
  }

  if (item.type === "URL") {
    return (
      <p>
        URL: {item.external_url ? <a href={item.external_url} target="_blank" rel="noopener noreferrer">{item.external_url}</a> : NA_TEXT}
      </p>
    );
  }

  return (
    <>
      <p>
        view_url: {item.file_view_url ? <a href={item.file_view_url} target="_blank" rel="noopener noreferrer">{item.file_view_url}</a> : NA_TEXT}
      </p>
      <p>
        download_url: {item.file_download_url ? <a href={item.file_download_url} target="_blank" rel="noopener noreferrer">{item.file_download_url}</a> : NA_TEXT}
      </p>
      <p>
        reference_url: {item.file_reference_url ? (
          item.file_reference_url.startsWith("data:") ? (
            <a href={item.file_reference_url} target="_blank" rel="noopener noreferrer">
              Local binary file (data URL)
            </a>
          ) : (
            <a href={item.file_reference_url} target="_blank" rel="noopener noreferrer">{item.file_reference_url}</a>
          )
        ) : NA_TEXT}
      </p>
    </>
  );
}

export default function MyEvidenceListPage() {
  const router = useRouter();
  const { projectId } = router.query;
  const credential = useCredential();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<Awaited<ReturnType<typeof fetchRole1Context>> | null>(null);
  const [items, setItems] = useState<EvidenceViewItem[]>([]);
  const [evidenceMode, setEvidenceMode] = useState<DataMode>("backend");
  const [evidenceMessage, setEvidenceMessage] = useState<string | null>(null);

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

    let mounted = true;
    const refresh = () => {
      fetchEvidenceListReadMode(projectId, context.active_period?.id ?? null)
        .then((result) => {
          if (!mounted) return;
          setItems(mapEvidenceRowsWithReview(result.data));
          setEvidenceMode(result.mode);
          setEvidenceMessage(result.backend_message);
        })
        .catch((e) => {
          if (!mounted) return;
          setItems([]);
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

  const grouped = useMemo<GroupedEvidence>(() => {
    const result: GroupedEvidence = {
      DRAFT: [],
      SUBMITTED: [],
      NEEDS_REVISION: [],
    };

    for (const item of items) {
      const groupKey =
        item.effective_status === "ACCEPTABLE" || item.effective_status === "REJECTED"
          ? "SUBMITTED"
          : item.effective_status;
      result[groupKey].push(item);
    }

    return result;
  }, [items]);

  const indicatorLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!context) return map;
    for (const indicator of context.indicators) {
      const code = indicator.code || NA_TEXT;
      const title = indicator.title || NA_TEXT;
      map.set(indicator.id, `${code} - ${title}`);
    }
    return map;
  }, [context]);

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
          <h1>My Evidence List</h1>
          <p className="error-box">{error || "Project context not found."}</p>
          <p>
            <Link href="/projects">Kembali ke Projects</Link>
          </p>
        </section>
      </main>
    );
  }

  const sections: Array<keyof GroupedEvidence> = ["DRAFT", "SUBMITTED", "NEEDS_REVISION"];
  const sectionLabel = (status: keyof GroupedEvidence): string => {
    if (status === "SUBMITTED") return "Submitted / Reviewed";
    return statusLabel(status);
  };
  const effectiveStatusLabel = (status: LocalEvidenceWithReview["effective_status"]): string => {
    if (status === "ACCEPTABLE") return "Reviewed - ACCEPTABLE";
    if (status === "REJECTED") return "Reviewed - REJECTED";
    if (status === "NEEDS_REVISION") return "Needs Revision";
    if (status === "SUBMITTED") return "Awaiting Review";
    return "Draft";
  };
  const canWrite = canWriteRole1Evidence(credential.role);

  return (
    <Role1Layout
      projectId={projectId}
      title="My Evidence List"
      subtitle="Daftar evidence dari database untuk project dan period aktif."
      project={context.project}
      activePeriod={context.active_period}
      periodStatusLabel={context.period_status_label}
    >
      <BackendStatusBanner
        mode={context.data_mode === "prototype" || evidenceMode === "prototype" ? "prototype" : "backend"}
        message={context.backend_message || evidenceMessage}
      />
      <section className="task-panel">
        <h2>Evidence Status Groups</h2>
        <p className="inline-note">Data evidence sinkron dari backend.</p>
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
            Mode read-only aktif untuk role <strong>{getRoleLabel(credential.role)}</strong>. Aksi edit/revisi evidence
            dinonaktifkan.
          </p>
        ) : null}
        {items.length === 0 ? <p className="empty-state">Belum ada evidence tersimpan pada period ini.</p> : null}
      </section>

      {sections.map((status) => {
        const bucket = grouped[status];
        const anchorId =
          status === "DRAFT" ? "draft" : status === "SUBMITTED" ? "submitted" : "needs-revision";
        return (
          <section key={status} id={anchorId} className="task-panel group-section">
            <h3>
              {sectionLabel(status)} ({bucket.length})
            </h3>

            {bucket.length === 0 ? <p className="empty-state">No items.</p> : null}

            {bucket.length > 0 ? (
              <div className="evidence-list">
                {bucket.map((item) => (
                  <article className="evidence-item" key={item.id}>
                    <p>
                      <strong>{item.title || NA_TEXT}</strong>
                    </p>
                    <p>{item.description || NA_TEXT}</p>
                    <p>
                      BIM Use: {formatBimUseDisplay(item.bim_use_id)} | Type: {item.type}
                    </p>
                    <p>
                      Indicators:{" "}
                      {item.indicator_ids.length
                        ? item.indicator_ids.map((id) => indicatorLabelMap.get(id) || id).join("; ")
                        : NA_TEXT}
                    </p>
                    <p>
                      Lifecycle status: <strong>{effectiveStatusLabel(item.effective_status)}</strong>
                    </p>
                    {renderEvidenceValue(item)}

                    {item.latest_review_outcome ? (
                      <p>
                        Reviewed: {item.latest_review_outcome} | Reviewer: {item.reviewed_by || NA_TEXT} | Time: {item.reviewed_at || NA_TEXT}
                      </p>
                    ) : null}
                    {item.effective_status === "NEEDS_REVISION" ? (
                      <p>Review reason: {item.latest_review_reason || item.review_reason || NA_TEXT}</p>
                    ) : null}

                    <p className="inline-note">Source: {item.storage_label || "Database"}</p>

                    <div className="item-actions">
                      {context.period_locked || !canWrite ? (
                        <button type="button" disabled>
                          Edit ({context.period_locked ? "LOCKED" : "READ-ONLY"})
                        </button>
                      ) : (
                        <Link href={`/projects/${projectId}/evidence/add?evidenceId=${encodeURIComponent(item.id)}`}>
                          Edit
                        </Link>
                      )}
                      {item.effective_status === "NEEDS_REVISION" ? (
                        context.period_locked || !canWrite ? (
                          <button type="button" disabled>
                            Revisi ({context.period_locked ? "LOCKED" : "READ-ONLY"})
                          </button>
                        ) : (
                          <Link
                            className="revisi"
                            href={`/projects/${projectId}/evidence/add?mode=revisi&evidenceId=${encodeURIComponent(item.id)}`}
                          >
                            Revisi
                          </Link>
                        )
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </Role1Layout>
  );
}
