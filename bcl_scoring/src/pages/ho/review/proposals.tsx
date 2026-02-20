import { FormEvent, useEffect, useMemo, useState } from "react";

import Role2Layout from "@/components/Role2Layout";
import {
  BimUseGroup,
  IndicatorRecord,
  NA_TEXT,
  ProjectRecord,
  fetchIndicatorDefinitionsReadMode,
  fetchIndicatorsReadMode,
  fetchProjectActiveIndicatorsReadMode,
  fetchProjectsReadMode,
  groupIndicatorsByBimUse,
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

type WorkspaceBimUseSummary = {
  project_id: string;
  project_label: string;
  indicator_total: number;
  bim_use_count_by_label: Record<string, number>;
  backend_message: string | null;
};

export default function Role2ProposalPage() {
  const credential = useCredential();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [indicators, setIndicators] = useState<IndicatorRecord[]>([]);
  const [defaultIndicators, setDefaultIndicators] = useState<IndicatorRecord[]>([]);
  const [workspaceBimUseSummaries, setWorkspaceBimUseSummaries] = useState<WorkspaceBimUseSummary[]>([]);
  const [proposals, setProposals] = useState<Role2BimUseProposal[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [proposalType, setProposalType] = useState<Role2ProposalType>("BIM_USE_CREATE");
  const [proposedBimUse, setProposedBimUse] = useState("");
  const [selectedIndicatorIds, setSelectedIndicatorIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [indicatorLoadError, setIndicatorLoadError] = useState<string | null>(null);
  const [defaultIndicatorsError, setDefaultIndicatorsError] = useState<string | null>(null);
  const [workspaceSummaryError, setWorkspaceSummaryError] = useState<string | null>(null);
  const [showDefaultReference, setShowDefaultReference] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
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

  const referenceProjectId = useMemo(() => {
    if (selectedProjectId) return selectedProjectId;
    return visibleProjects[0]?.id || "";
  }, [selectedProjectId, visibleProjects]);

  const defaultPerspectiveSections = useMemo(() => {
    const grouped = new Map<string, IndicatorRecord[]>();
    for (const indicator of defaultIndicators) {
      const key = indicator.perspective_id || "UNASSIGNED";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)?.push(indicator);
    }
    const sections = [...grouped.entries()].map(([perspectiveId, rows]) => ({
      perspectiveId,
      indicators: [...rows].sort((a, b) => a.code.localeCompare(b.code)),
    }));
    sections.sort((a, b) => a.perspectiveId.localeCompare(b.perspectiveId));
    return sections;
  }, [defaultIndicators]);

  const defaultBimUseGroups = useMemo<BimUseGroup[]>(() => {
    return groupIndicatorsByBimUse(defaultIndicators);
  }, [defaultIndicators]);

  const bimUseUniverse = useMemo(() => {
    const labels = new Set<string>();
    for (const item of defaultBimUseGroups) {
      if (item.label) labels.add(item.label);
    }
    for (const row of workspaceBimUseSummaries) {
      for (const label of Object.keys(row.bim_use_count_by_label)) {
        if (label) labels.add(label);
      }
    }
    return [...labels].sort((a, b) => a.localeCompare(b));
  }, [defaultBimUseGroups, workspaceBimUseSummaries]);

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
        setIndicatorLoadError(null);
        return;
      }
      try {
        const result = await fetchIndicatorsReadMode(selectedProjectId);
        if (!mounted) return;
        setIndicators(result.data);
        setSelectedIndicatorIds([]);
        setIndicatorLoadError(result.backend_message || null);
      } catch {
        if (!mounted) return;
        setIndicators([]);
        setSelectedIndicatorIds([]);
        setIndicatorLoadError("Gagal memuat indikator untuk project terpilih.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedProjectId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!actor || !referenceProjectId) {
        setDefaultIndicators([]);
        setDefaultIndicatorsError(null);
        return;
      }
      try {
        const result = await fetchIndicatorDefinitionsReadMode(referenceProjectId);
        if (!mounted) return;
        setDefaultIndicators(result.data);
        setDefaultIndicatorsError(result.backend_message || null);
      } catch (err) {
        if (!mounted) return;
        setDefaultIndicators([]);
        setDefaultIndicatorsError(err instanceof Error ? err.message : "Gagal memuat default indicator definitions.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [actor, referenceProjectId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!actor || visibleProjects.length === 0) {
        setWorkspaceBimUseSummaries([]);
        setWorkspaceSummaryError(null);
        return;
      }

      setSummaryLoading(true);
      setWorkspaceSummaryError(null);
      try {
        const rows = await Promise.all(
          visibleProjects.map(async (project) => {
            const result = await fetchProjectActiveIndicatorsReadMode(project.id);
            const groups = groupIndicatorsByBimUse(result.data);
            const bim_use_count_by_label: Record<string, number> = {};
            for (const group of groups) {
              if (!group.label) continue;
              bim_use_count_by_label[group.label] = group.indicators.length;
            }
            return {
              project_id: project.id,
              project_label: project.name || project.code || project.id,
              indicator_total: result.data.length,
              bim_use_count_by_label,
              backend_message: result.backend_message,
            } satisfies WorkspaceBimUseSummary;
          })
        );
        if (!mounted) return;
        setWorkspaceBimUseSummaries(rows);
      } catch (err) {
        if (!mounted) return;
        setWorkspaceBimUseSummaries([]);
        setWorkspaceSummaryError(err instanceof Error ? err.message : "Gagal memuat ringkasan BIM Use per workspace.");
      } finally {
        if (mounted) setSummaryLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [actor, visibleProjects]);

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
    if (proposalType === "BIM_USE_MAPPING_UPDATE" && !toNonEmptyString(proposedBimUse)) {
      setError("Nama BIM Use target wajib diisi untuk proposal BIM_USE_MAPPING_UPDATE.");
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
        <h2>Referensi Perspektif & Indicator Default (Database)</h2>
        <p className="task-subtitle">
          Section ini bersifat reference-only untuk Role 2. Default dalam keadaan tertutup, buka jika dibutuhkan.
        </p>
        <div className="wizard-actions">
          <button
            type="button"
            onClick={() => setShowDefaultReference((prev) => !prev)}
            disabled={!referenceProjectId}
          >
            {showDefaultReference ? "Tutup Referensi" : "Buka Referensi"}
          </button>
        </div>
        {showDefaultReference ? (
          <div className="group-section">
            {defaultIndicatorsError ? <p className="warning-box">{defaultIndicatorsError}</p> : null}
            {defaultPerspectiveSections.length === 0 ? (
              <p className="auth-hint">Belum ada indicator default yang dapat ditampilkan.</p>
            ) : (
              defaultPerspectiveSections.map((section) => (
                <div key={section.perspectiveId} className="task-panel desktop-drawer-panel">
                  <p className="task-kicker">Perspective</p>
                  <h3>{section.perspectiveId}</h3>
                  <div className="admin-table-wrap">
                    <table className="audit-table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Indicator</th>
                          <th>BIM Use</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.indicators.map((indicator) => (
                          <tr key={indicator.id}>
                            <td>{indicator.code}</td>
                            <td>{indicator.title}</td>
                            <td>{indicator.bim_use_tags.length ? indicator.bim_use_tags.join(", ") : indicator.bim_use_id || NA_TEXT}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </section>

      <section className="task-panel">
        <h2>Indikasi BIM Use per Workspace</h2>
        <p className="task-subtitle">
          Menampilkan BIM Use yang sudah terdaftar pada tiap workspace dan yang belum terdaftar (0 indikator).
        </p>
        {workspaceSummaryError ? <p className="error-box">{workspaceSummaryError}</p> : null}
        {summaryLoading ? <p>Loading ringkasan BIM Use workspace...</p> : null}
        {!summaryLoading ? (
          <div className="admin-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Workspace</th>
                  <th>Total Indicator Aktif</th>
                  <th>BIM Use Terdaftar</th>
                  <th>BIM Use Belum Ada</th>
                </tr>
              </thead>
              <tbody>
                {workspaceBimUseSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Belum ada data workspace untuk ringkasan BIM Use.</td>
                  </tr>
                ) : (
                  workspaceBimUseSummaries.map((row) => {
                    const registered = bimUseUniverse.filter((label) => (row.bim_use_count_by_label[label] || 0) > 0);
                    const missing = bimUseUniverse.filter((label) => (row.bim_use_count_by_label[label] || 0) === 0);
                    return (
                      <tr key={row.project_id}>
                        <td>
                          <strong>{row.project_label}</strong>
                          {row.backend_message ? (
                            <>
                              <br />
                              <small>{row.backend_message}</small>
                            </>
                          ) : null}
                        </td>
                        <td>{row.indicator_total}</td>
                        <td>
                          {registered.length === 0 ? (
                            <span className="warning-box">Belum ada BIM Use terdaftar.</span>
                          ) : (
                            registered.map((label) => `${label} (${row.bim_use_count_by_label[label] || 0})`).join(", ")
                          )}
                        </td>
                        <td>
                          {missing.length === 0
                            ? "Semua BIM Use sudah terdaftar"
                            : missing.map((label) => `${label} (0)`).join(", ")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

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
                Pilih indikator sebagai referensi usulan. Untuk tipe BIM_USE_MAPPING_UPDATE, minimal pilih 1 indikator.
              </p>
              {indicatorLoadError ? <p className="warning-box">{indicatorLoadError}</p> : null}
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
