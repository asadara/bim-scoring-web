import { FormEvent, useEffect, useMemo, useState } from "react";

import Role2Layout from "@/components/Role2Layout";
import {
  IndicatorRecord,
  NA_TEXT,
  ProjectRecord,
  fetchIndicatorsReadMode,
  fetchProjectsReadMode,
} from "@/lib/role1TaskLayer";
import {
  Role2BimUseProposal,
  Role2ProposalType,
  listRole2BimUseProposals,
  submitRole2BimUseProposal,
} from "@/lib/role2ProposalClient";
import { useCredential } from "@/lib/useCredential";

function toNonEmptyString(value: string): string | null {
  const out = value.trim();
  return out ? out : null;
}

export default function Role2ProposalPage() {
  const credential = useCredential();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [indicators, setIndicators] = useState<IndicatorRecord[]>([]);
  const [proposals, setProposals] = useState<Role2BimUseProposal[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [proposalType, setProposalType] = useState<Role2ProposalType>("BIM_USE_CREATE");
  const [proposedBimUse, setProposedBimUse] = useState("");
  const [selectedIndicatorIds, setSelectedIndicatorIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const actor = useMemo(() => {
    if (!credential.user_id) return null;
    return { actorId: credential.user_id, actorRole: credential.role };
  }, [credential.user_id, credential.role]);

  const scopedProjectIds = useMemo(() => {
    return Array.isArray(credential.scoped_project_ids) ? credential.scoped_project_ids : [];
  }, [credential.scoped_project_ids]);

  const visibleProjects = useMemo(() => {
    if (credential.role !== "role2") return projects;
    if (scopedProjectIds.length === 0) return projects;
    const allowed = new Set(scopedProjectIds);
    return projects.filter((item) => allowed.has(item.id));
  }, [projects, scopedProjectIds, credential.role]);

  const selectedProject = useMemo(
    () => visibleProjects.find((item) => item.id === selectedProjectId) || null,
    [visibleProjects, selectedProjectId]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!actor) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const projectsResult = await fetchProjectsReadMode();
        const nextProjects = projectsResult.data;
        const nextVisible =
          credential.role === "role2" && scopedProjectIds.length > 0
            ? nextProjects.filter((item) => scopedProjectIds.includes(item.id))
            : nextProjects;
        if (!mounted) return;
        setProjects(nextProjects);
        setSelectedProjectId(nextVisible[0]?.id || "");

        const proposalRows = await listRole2BimUseProposals(actor);
        if (!mounted) return;
        setProposals(proposalRows);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Gagal memuat data proposal");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [actor, credential.role, scopedProjectIds]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedProjectId) {
        setIndicators([]);
        setSelectedIndicatorIds([]);
        return;
      }
      try {
        const result = await fetchIndicatorsReadMode(selectedProjectId);
        if (!mounted) return;
        setIndicators(result.data);
        setSelectedIndicatorIds([]);
      } catch {
        if (!mounted) return;
        setIndicators([]);
        setSelectedIndicatorIds([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedProjectId]);

  function toggleIndicator(indicatorId: string) {
    setSelectedIndicatorIds((prev) => {
      if (prev.includes(indicatorId)) return prev.filter((item) => item !== indicatorId);
      return [...prev, indicatorId];
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actor) {
      setError("Silakan sign in sebagai Role 2.");
      return;
    }
    if (!selectedProjectId) {
      setError("Pilih project scope terlebih dahulu.");
      return;
    }
    if (proposalType === "BIM_USE_CREATE" && !toNonEmptyString(proposedBimUse)) {
      setError("Nama BIM Use wajib diisi untuk proposal BIM_USE_CREATE.");
      return;
    }
    if (proposalType === "BIM_USE_MAPPING_UPDATE" && selectedIndicatorIds.length === 0) {
      setError("Pilih minimal 1 indikator untuk proposal mapping.");
      return;
    }
    if (!toNonEmptyString(reason)) {
      setError("Alasan proposal wajib diisi.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await submitRole2BimUseProposal(actor, {
        project_id: selectedProjectId,
        proposal_type: proposalType,
        proposed_bim_use: proposalType === "BIM_USE_CREATE" ? proposedBimUse : proposedBimUse || null,
        indicator_ids: proposalType === "BIM_USE_MAPPING_UPDATE" ? selectedIndicatorIds : [],
        reason,
      });
      const rows = await listRole2BimUseProposals(actor);
      setProposals(rows);
      setProposedBimUse("");
      setSelectedIndicatorIds([]);
      setReason("");
      setNotice("Proposal berhasil dikirim ke Admin.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim proposal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Role2Layout
      title="Proposal BIM Use & Indicator Mapping"
      subtitle="Role 2 hanya mengajukan proposal. Perubahan master tetap diputuskan Admin."
      projectId={selectedProjectId || null}
      project={selectedProject}
      periodStatusLabel="OPEN"
      projectLabel={selectedProject?.name || selectedProject?.code || NA_TEXT}
      activePeriodLabel="N/A"
      activePeriod={null}
    >
      <section className="task-panel">
        <p className="inline-note">
          Guardrail aktif: Role 2 tidak dapat menambah indikator/perspektif secara langsung. Semua perubahan melalui proposal queue.
        </p>
        {error ? <p className="error-box">{error}</p> : null}
        {notice ? <p className="task-note">{notice}</p> : null}
        {loading ? <p>Loading...</p> : null}

        {!loading ? (
          <form className="auth-stack" onSubmit={onSubmit}>
            <label className="auth-field">
              Project Scope
              <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
                {visibleProjects.length === 0 ? <option value="">Tidak ada project scope</option> : null}
                {visibleProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name || project.code || project.id}
                  </option>
                ))}
              </select>
            </label>

            <label className="auth-field">
              Jenis Proposal
              <select value={proposalType} onChange={(event) => setProposalType(event.target.value as Role2ProposalType)}>
                <option value="BIM_USE_CREATE">Tambah daftar BIM Use (proposal)</option>
                <option value="BIM_USE_MAPPING_UPDATE">Ubah mapping BIM Use ke indikator (proposal)</option>
              </select>
            </label>

            <label className="auth-field">
              Nama BIM Use (Proposal)
              <input
                value={proposedBimUse}
                onChange={(event) => setProposedBimUse(event.target.value)}
                placeholder="mis. Design Authoring / Clash Detection / 4D Planning"
              />
            </label>

            <fieldset className="auth-fieldset">
              <legend>Indicator (Read-only reference)</legend>
              <p className="auth-hint">
                Pilih indikator untuk usulan mapping. Daftar indikator ini tidak bisa diubah oleh Role 2.
              </p>
              <div className="auth-checkbox-grid">
                {indicators.length === 0 ? (
                  <span className="auth-hint">Tidak ada indikator aktif untuk project ini.</span>
                ) : (
                  indicators.map((indicator) => (
                    <label key={indicator.id} className="auth-checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedIndicatorIds.includes(indicator.id)}
                        onChange={() => toggleIndicator(indicator.id)}
                        disabled={proposalType !== "BIM_USE_MAPPING_UPDATE"}
                      />
                      <span>
                        {indicator.code} - {indicator.title}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </fieldset>

            <label className="auth-field">
              Alasan Pengajuan
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Jelaskan alasan perubahan BIM Use/mapping untuk project scope ini."
                rows={4}
              />
            </label>

            <button type="submit" className="primary-cta" disabled={submitting || !actor}>
              {submitting ? "Mengirim..." : "Kirim Proposal ke Admin"}
            </button>
          </form>
        ) : null}
      </section>

      <section className="task-panel">
        <h2>Riwayat Proposal Saya</h2>
        <div className="admin-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Dibuat</th>
                <th>Project</th>
                <th>Tipe</th>
                <th>BIM Use</th>
                <th>Indicator IDs</th>
                <th>Status</th>
                <th>Catatan Admin</th>
              </tr>
            </thead>
            <tbody>
              {proposals.length === 0 ? (
                <tr>
                  <td colSpan={7}>Belum ada proposal.</td>
                </tr>
              ) : (
                proposals.map((item) => {
                  const projectName = projects.find((project) => project.id === item.project_id)?.name || item.project_id || "N/A";
                  const indicatorList = Array.isArray(item.indicator_ids) ? item.indicator_ids : [];
                  return (
                    <tr key={item.id}>
                      <td>{item.created_at ? new Date(item.created_at).toLocaleString() : "N/A"}</td>
                      <td>{projectName}</td>
                      <td>{item.proposal_type || "N/A"}</td>
                      <td>{item.proposed_bim_use || "N/A"}</td>
                      <td>{indicatorList.length ? indicatorList.join(", ") : "N/A"}</td>
                      <td>{item.status || "N/A"}</td>
                      <td>{item.decision_note || "N/A"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </Role2Layout>
  );
}
