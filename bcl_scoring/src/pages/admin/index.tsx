import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  AdminBulkPeriodGenerationResult,
  AdminConfigLock,
  AdminIndicator,
  AdminPerspective,
  AdminProject,
  AdminScoringPeriod,
  AdminSession,
  bulkGenerateAdminProjectPeriods,
  createAdminIndicator,
  createAdminProjectPeriod,
  createAdminProject,
  deleteAdminIndicator,
  deleteAdminProject,
  getAdminConfigLock,
  listAdminIndicators,
  listAdminProjectPeriods,
  listAdminPerspectives,
  listAdminProjects,
  setAdminConfigLock,
} from "@/lib/adminTaskLayer";
import { AppRole, getRoleLabel, getStoredCredential, setStoredCredential } from "@/lib/userCredential";

const ADMIN_SESSION_KEY = "bim_admin_session_v1";

const ROLE_OPTIONS: Array<{ value: AppRole; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "role1", label: "BIM Coordinator Project" },
  { value: "role2", label: "BIM Coordinator HO" },
  { value: "role3", label: "BIM Manager" },
  { value: "viewer", label: "Viewer / Auditor" },
];

const MONTH_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Januari" },
  { value: 2, label: "Februari" },
  { value: 3, label: "Maret" },
  { value: 4, label: "April" },
  { value: 5, label: "Mei" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "Agustus" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Desember" },
];

function toNonEmptyString(value: string): string | null {
  const out = value.trim();
  return out ? out : null;
}

function asBooleanLabel(value: boolean | null): string {
  if (value === true) return "Active";
  if (value === false) return "Inactive";
  return "N/A";
}

function formatDateTime(value?: string | null): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleString();
}

function isLegacyPerspectiveCode(code: string | null | undefined): boolean {
  const raw = String(code || "")
    .trim()
    .toUpperCase();
  if (!raw) return false;
  return raw.startsWith("LEGACY_") || raw.startsWith("DUMMY") || raw.startsWith("TMP");
}

function buildCodePrefix(text: string, fallback: string): string {
  const initials = text
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  return initials || fallback;
}

function buildInternalCode(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rnd}`;
}

function getCurrentIsoYearWeek(): { year: number; week: number } {
  const now = new Date();
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: date.getUTCFullYear(), week: weekNo };
}

export default function AdminControlPanelPage() {
  const [session, setSession] = useState<AdminSession>({ actorId: "admin-web", role: "Admin" });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [periodFeedback, setPeriodFeedback] = useState<{
    tone: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [perspectives, setPerspectives] = useState<AdminPerspective[]>([]);
  const [indicators, setIndicators] = useState<AdminIndicator[]>([]);
  const [periods, setPeriods] = useState<AdminScoringPeriod[]>([]);
  const [configLock, setConfigLock] = useState<AdminConfigLock | null>(null);
  const [indicatorPerspectiveFilter, setIndicatorPerspectiveFilter] = useState<string>("");
  const [periodProjectFilter, setPeriodProjectFilter] = useState<string>("");

  const [showProjectCreateForm, setShowProjectCreateForm] = useState(false);
  const [showIndicatorCreateForm, setShowIndicatorCreateForm] = useState(false);
  const [showPeriodCreateForm, setShowPeriodCreateForm] = useState(false);

  const [projectForm, setProjectForm] = useState({
    name: "",
    config_key: "",
  });
  const [periodForm, setPeriodForm] = useState(() => {
    const current = getCurrentIsoYearWeek();
    return {
      year: String(current.year),
      week: String(current.week),
      start_date: "",
      end_date: "",
      status: "OPEN" as "OPEN" | "LOCKED",
    };
  });
  const [periodBulkForm, setPeriodBulkForm] = useState(() => {
    const now = new Date();
    return {
      year: String(now.getUTCFullYear()),
      scope: "year" as "year" | "month",
      month: String(now.getUTCMonth() + 1),
      status: "OPEN" as "OPEN" | "LOCKED",
    };
  });
  const [indicatorForm, setIndicatorForm] = useState({
    perspective_id: "",
    title: "",
    description: "",
  });
  const [lockReason, setLockReason] = useState("");
  const [devRole, setDevRole] = useState<AppRole>(() => {
    if (typeof window === "undefined") return "viewer";
    return getStoredCredential().role;
  });
  const [devUserId, setDevUserId] = useState(() => {
    if (typeof window === "undefined") return "";
    return getStoredCredential().user_id || "";
  });

  const sortedPerspectiveOptions = useMemo(() => {
    return perspectives
      .filter((item) => item.is_active !== false && !isLegacyPerspectiveCode(item.code))
      .sort((a, b) =>
      String(a.title || a.code || "").localeCompare(String(b.title || b.code || ""))
    );
  }, [perspectives]);

  const visiblePerspectiveRows = useMemo(() => {
    return perspectives
      .filter((item) => item.is_active !== false && !isLegacyPerspectiveCode(item.code))
      .sort((a, b) =>
        String(a.title || a.code || "").localeCompare(String(b.title || b.code || ""))
      );
  }, [perspectives]);

  const hiddenLegacyPerspectiveCount = useMemo(() => {
    return perspectives.filter((item) => isLegacyPerspectiveCode(item.code) || item.is_active === false).length;
  }, [perspectives]);

  const selectedIndicatorPerspective = useMemo(() => {
    if (!indicatorPerspectiveFilter) return null;
    return sortedPerspectiveOptions.find((item) => item.id === indicatorPerspectiveFilter) || null;
  }, [sortedPerspectiveOptions, indicatorPerspectiveFilter]);

  const perspectiveTitleById = useMemo(() => {
    return new Map(
      perspectives.map((item) => [item.id, item.title || item.code || "Perspective tanpa judul"])
    );
  }, [perspectives]);

  const selectedPeriodProject = useMemo(() => {
    if (!periodProjectFilter) return null;
    return projects.find((item) => item.id === periodProjectFilter) || null;
  }, [projects, periodProjectFilter]);
  const hasActivePeriodProject = Boolean(
    selectedPeriodProject && selectedPeriodProject.is_active !== false
  );

  async function reloadData(currentSession: AdminSession, perspectiveFilter: string, periodProjectId: string) {
    const [projectRows, perspectiveRows, lockRow] = await Promise.all([
      listAdminProjects(currentSession),
      listAdminPerspectives(currentSession),
      getAdminConfigLock(currentSession),
    ]);
    setProjects(projectRows);
    setPerspectives(perspectiveRows);
    setConfigLock(lockRow);

    const perspectiveId = toNonEmptyString(perspectiveFilter);
    if (!perspectiveId) {
      setIndicators([]);
    } else {
      const indicatorRows = await listAdminIndicators(currentSession, { perspective_id: perspectiveId });
      setIndicators(indicatorRows);
    }

    const targetProjectId =
      toNonEmptyString(periodProjectId) || (projectRows[0]?.id ? String(projectRows[0].id) : null);
    if (!targetProjectId) {
      setPeriods([]);
      return;
    }
    if (targetProjectId !== periodProjectId) {
      setPeriodProjectFilter(targetProjectId);
    }
    const periodRows = await listAdminProjectPeriods(currentSession, targetProjectId);
    setPeriods(periodRows);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<AdminSession>;
      const actorId = toNonEmptyString(parsed.actorId || "") || "admin-web";
      const role = toNonEmptyString(parsed.role || "") || "Admin";
      setSession({ actorId, role });
    } catch {
      // Ignore broken local storage payload.
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await reloadData(session, indicatorPerspectiveFilter, periodProjectFilter);
        if (!mounted) return;
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load admin data");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [session, indicatorPerspectiveFilter, periodProjectFilter]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    if (!indicatorPerspectiveFilter) return;
    const exists = sortedPerspectiveOptions.some((item) => item.id === indicatorPerspectiveFilter);
    if (exists) return;
    setIndicatorPerspectiveFilter("");
    setShowIndicatorCreateForm(false);
    setIndicatorForm({ perspective_id: "", title: "", description: "" });
  }, [sortedPerspectiveOptions, indicatorPerspectiveFilter]);

  useEffect(() => {
    if (projects.length === 0) {
      setPeriodProjectFilter("");
      setPeriods([]);
      setShowPeriodCreateForm(false);
      return;
    }
    if (!periodProjectFilter || !projects.some((item) => item.id === periodProjectFilter)) {
      setPeriodProjectFilter(projects[0].id);
      setShowPeriodCreateForm(false);
    }
  }, [projects, periodProjectFilter]);

  useEffect(() => {
    if (hasActivePeriodProject) return;
    setShowPeriodCreateForm(false);
  }, [hasActivePeriodProject]);

  useEffect(() => {
    setPeriodFeedback(null);
  }, [periodProjectFilter]);

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(successMessage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setWorking(false);
    }
  }

  function handleSaveDevCredential(event: FormEvent) {
    event.preventDefault();
    const saved = setStoredCredential({
      role: devRole,
      user_id: toNonEmptyString(devUserId),
    });
    setNotice(`Credential navigasi disimpan: ${getRoleLabel(saved.role)} (${saved.user_id || "no-user-id"})`);
  }

  async function handleCreateProject(event: FormEvent) {
    event.preventDefault();
    const name = toNonEmptyString(projectForm.name);
    if (!name) {
      setError("Project name wajib diisi.");
      return;
    }
    await runAction(async () => {
      await createAdminProject(session, {
        name,
        config_key: toNonEmptyString(projectForm.config_key) || undefined,
        is_active: true,
      });
      setProjectForm({ name: "", config_key: "" });
      setShowProjectCreateForm(false);
      await reloadData(session, indicatorPerspectiveFilter, periodProjectFilter);
    }, "Project workspace berhasil dibuat.");
  }

  async function handleCreatePeriod(event: FormEvent) {
    event.preventDefault();
    const projectId = toNonEmptyString(periodProjectFilter);
    const year = Number.parseInt(periodForm.year, 10);
    const week = Number.parseInt(periodForm.week, 10);
    if (!projectId) {
      setError("Pilih workspace project terlebih dahulu.");
      return;
    }
    if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) {
      setError("Year/week wajib valid (week 1..53).");
      return;
    }
    if (!hasActivePeriodProject) {
      setError("Pilih workspace aktif terlebih dahulu sebelum menambah period.");
      return;
    }

    setWorking(true);
    setError(null);
    setNotice(null);
    setPeriodFeedback(null);
    try {
      const created = await createAdminProjectPeriod(session, projectId, {
        year,
        week,
        start_date: toNonEmptyString(periodForm.start_date),
        end_date: toNonEmptyString(periodForm.end_date),
        status: periodForm.status,
      });
      setShowPeriodCreateForm(false);
      await reloadData(session, indicatorPerspectiveFilter, periodProjectFilter);
      const createdYear = Number.isInteger(created?.year) ? created.year : year;
      const createdWeek = Number.isInteger(created?.week) ? created.week : week;
      const successMessage = `Period ${createdYear} W${createdWeek} berhasil ditambahkan.`;
      setNotice(successMessage);
      setPeriodFeedback({ tone: "success", message: successMessage });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Tambah period gagal.";
      setError(message);
      setPeriodFeedback({ tone: "error", message });
    } finally {
      setWorking(false);
    }
  }

  async function handleBulkGeneratePeriods(event: FormEvent) {
    event.preventDefault();
    const projectId = toNonEmptyString(periodProjectFilter);
    const year = Number.parseInt(periodBulkForm.year, 10);
    const month = Number.parseInt(periodBulkForm.month, 10);
    const scope = periodBulkForm.scope;
    if (!projectId) {
      setError("Pilih workspace project terlebih dahulu.");
      return;
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      setError("Year harus valid (2000..2100).");
      return;
    }
    if (scope === "month" && (!Number.isInteger(month) || month < 1 || month > 12)) {
      setError("Pilih bulan valid untuk mode bulanan.");
      return;
    }
    if (!hasActivePeriodProject) {
      setError("Pilih workspace aktif terlebih dahulu sebelum generate period.");
      return;
    }

    setWorking(true);
    setError(null);
    setNotice(null);
    setPeriodFeedback(null);
    try {
      const result: AdminBulkPeriodGenerationResult = await bulkGenerateAdminProjectPeriods(session, projectId, {
        year,
        scope,
        month: scope === "month" ? month : null,
        status: periodBulkForm.status,
      });
      await reloadData(session, indicatorPerspectiveFilter, periodProjectFilter);
      const baseMessage = `Generate period selesai: dibuat ${result.created_count}, dilewati ${result.skipped_count} dari total ${result.total_candidate_count}.`;
      const nothingCreated = result.created_count === 0;
      setNotice(baseMessage);
      setPeriodFeedback({
        tone: nothingCreated ? "warning" : "success",
        message: nothingCreated
          ? `${baseMessage} Tidak ada period baru karena semua period target sudah ada.`
          : baseMessage,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Bulk generate period gagal.";
      setError(message);
      setPeriodFeedback({ tone: "error", message });
    } finally {
      setWorking(false);
    }
  }

  async function handleCreateIndicator(event: FormEvent) {
    event.preventDefault();
    const perspective_id =
      toNonEmptyString(indicatorForm.perspective_id) || toNonEmptyString(indicatorPerspectiveFilter);
    const title = toNonEmptyString(indicatorForm.title);
    if (!perspective_id || !title) {
      setError("Perspective dan judul indikator wajib diisi.");
      return;
    }
    const perspectiveLabel = perspectiveTitleById.get(perspective_id) || "GEN";
    const code = buildInternalCode(`IND${buildCodePrefix(`${perspectiveLabel} ${title}`, "GEN")}`);

    await runAction(async () => {
      await createAdminIndicator(session, {
        perspective_id,
        code,
        title,
        description: toNonEmptyString(indicatorForm.description) || undefined,
        is_active: true,
      });
      setIndicatorForm((prev) => ({
        ...prev,
        perspective_id,
        title: "",
        description: "",
      }));
      setShowIndicatorCreateForm(false);
      await reloadData(session, indicatorPerspectiveFilter, periodProjectFilter);
    }, "Indicator berhasil ditambahkan (kode internal dibuat otomatis).");
  }

  async function handleToggleLock(nextLock: boolean) {
    await runAction(async () => {
      await setAdminConfigLock(session, {
        scope: "admin-control",
        is_locked: nextLock,
        reason: toNonEmptyString(lockReason),
      });
      setLockReason("");
      await reloadData(session, indicatorPerspectiveFilter, periodProjectFilter);
    }, nextLock ? "Config lock diaktifkan." : "Config lock dibuka.");
  }

  async function handleDeleteProject(id: string) {
    await runAction(async () => {
      await deleteAdminProject(session, id);
      await reloadData(session, indicatorPerspectiveFilter, periodProjectFilter);
    }, "Project berhasil dihapus.");
  }

  async function handleDeleteIndicator(id: string) {
    await runAction(async () => {
      await deleteAdminIndicator(session, id);
      await reloadData(session, indicatorPerspectiveFilter, periodProjectFilter);
    }, "Indicator berhasil dihapus.");
  }

  function handleChangeIndicatorPerspective(nextPerspectiveId: string) {
    setIndicatorPerspectiveFilter(nextPerspectiveId);
    setIndicatorForm({
      perspective_id: nextPerspectiveId,
      title: "",
      description: "",
    });
  }

  return (
    <main className="task-shell">
      <header className="task-header">
        <p className="task-kicker">BIM Scoring Platform</p>
        <h1>Admin Control Panel</h1>
        <p className="task-subtitle">
          Workspace untuk Admin: kelola project, perspectives, indicators, dan lock konfigurasi.
        </p>
      </header>

      {error && <p className="error-box">{error}</p>}
      {notice && <p className="task-note">{notice}</p>}

      <section className="task-panel">
        <h2>Admin Session</h2>
        <form
          className="field-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const actorId = toNonEmptyString(session.actorId) || "admin-web";
            const role = toNonEmptyString(session.role) || "Admin";
            setSession({ actorId, role });
            setNotice("Session admin diperbarui.");
          }}
        >
          <label>
            Actor ID
            <input
              value={session.actorId}
              onChange={(event) => setSession((prev) => ({ ...prev, actorId: event.target.value }))}
              placeholder="admin-web"
            />
          </label>
          <label>
            Role Header
            <input
              value={session.role}
              onChange={(event) => setSession((prev) => ({ ...prev, role: event.target.value }))}
              placeholder="Admin"
            />
          </label>
          <div className="wizard-actions">
            <button type="submit" className="action-primary" disabled={working}>
              Simpan Session
            </button>
            <button
              type="button"
              disabled={working || loading}
              onClick={() => {
                void runAction(async () => {
                  await reloadData(session, indicatorPerspectiveFilter, periodProjectFilter);
                }, "Data admin dimuat ulang.");
              }}
            >
              Reload Data
            </button>
          </div>
        </form>
      </section>

      <section className="task-panel">
        <h2>Dev Credential (Menu Navigation)</h2>
        <p className="task-subtitle">
          Untuk iterasi lokal sebelum login final, atur role aktif agar visibilitas menu sesuai skenario user.
        </p>
        <form className="field-grid" onSubmit={handleSaveDevCredential}>
          <label>
            Active role
            <select value={devRole} onChange={(event) => setDevRole(event.target.value as AppRole)}>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            User ID (opsional)
            <input
              value={devUserId}
              onChange={(event) => setDevUserId(event.target.value)}
              placeholder="contoh: u-bim-001"
            />
          </label>
          <div className="wizard-actions">
            <button type="submit" className="action-primary" disabled={working}>
              Simpan Credential Navigasi
            </button>
            <button
              type="button"
              disabled={working}
              onClick={() => {
                setDevRole("viewer");
                setDevUserId("");
                const saved = setStoredCredential({ role: "viewer", user_id: null });
                setNotice(
                  `Credential navigasi direset: ${getRoleLabel(saved.role)} (${saved.user_id || "no-user-id"})`
                );
              }}
            >
              Reset ke Viewer
            </button>
          </div>
        </form>
      </section>

      <section className="task-panel">
        <h2>Config Lock</h2>
        {loading ? (
          <p>Loading lock state...</p>
        ) : (
          <div className="admin-lock-bar">
            <p>
              Status:{" "}
              <span className={`status-chip ${configLock?.is_locked ? "status-lock" : "status-open"}`}>
                {configLock?.is_locked ? "LOCKED" : "OPEN"}
              </span>
            </p>
            <p>Reason: {configLock?.reason || "N/A"}</p>
            <p>
              Updated by: {configLock?.updated_by || "N/A"} | Updated at:{" "}
              {configLock?.updated_at || "N/A"}
            </p>
            <label>
              Reason update lock
              <input
                value={lockReason}
                onChange={(event) => setLockReason(event.target.value)}
                placeholder="Freeze reason..."
              />
            </label>
            <div className="wizard-actions">
              <button
                type="button"
                className="action-primary"
                disabled={working}
                onClick={() => void handleToggleLock(true)}
              >
                Lock Config
              </button>
              <button type="button" disabled={working} onClick={() => void handleToggleLock(false)}>
                Unlock Config
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="task-panel">
        <h2>Project Workspace (Admin CRUD)</h2>
        <p className="task-subtitle">Daftar workspace eksisting ditampilkan lebih dulu sebelum aksi CRUD.</p>
        <div className="wizard-actions">
          <button
            type="button"
            className="action-primary"
            disabled={working}
            onClick={() => setShowProjectCreateForm((prev) => !prev)}
          >
            {showProjectCreateForm ? "Tutup Form Tambah" : "Tambah Workspace"}
          </button>
        </div>

        <div className="admin-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Nama Workspace</th>
                <th>Status</th>
                <th>Dibuat</th>
                <th>Diperbarui</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 && (
                <tr>
                  <td colSpan={5}>Belum ada workspace project.</td>
                </tr>
              )}
              {projects.map((item) => (
                <tr key={item.id}>
                  <td>{item.name || "Tanpa nama"}</td>
                  <td>{asBooleanLabel(item.is_active)}</td>
                  <td>{formatDateTime(item.created_at)}</td>
                  <td>{formatDateTime(item.updated_at)}</td>
                  <td>
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => {
                        const yes = window.confirm(`Hapus workspace "${item.name || "tanpa nama"}"?`);
                        if (!yes) return;
                        void handleDeleteProject(item.id);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showProjectCreateForm && (
          <form className="field-grid" onSubmit={(event) => void handleCreateProject(event)}>
            <label>
              Nama Workspace
              <input
                value={projectForm.name}
                onChange={(event) => setProjectForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nama Workspace Proyek"
                required
              />
            </label>
            <label>
              Config Key (opsional)
              <input
                value={projectForm.config_key}
                onChange={(event) => setProjectForm((prev) => ({ ...prev, config_key: event.target.value }))}
                placeholder="Key konfigurasi internal"
              />
            </label>
            <div className="wizard-actions">
              <button type="submit" className="action-primary" disabled={working}>
                Simpan Workspace
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="task-panel">
        <h2>Scoring Period Management</h2>
        <p className="task-subtitle">
          Skema period mingguan per project diatur di sini. Role input/review/approval menggunakan period aktif yang tersedia.
        </p>
        <div className="wizard-actions admin-filter-row">
          <label>
            Workspace Project
            <select
              value={periodProjectFilter}
              onChange={(event) => setPeriodProjectFilter(event.target.value)}
              disabled={projects.length === 0}
            >
              {projects.length === 0 ? <option value="">Belum ada workspace</option> : null}
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name || "Tanpa nama"}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="action-primary"
            disabled={working || !hasActivePeriodProject}
            onClick={() => {
              if (!hasActivePeriodProject) return;
              setShowPeriodCreateForm((prev) => !prev);
            }}
          >
            {showPeriodCreateForm ? "Tutup Form Tambah Period" : "Tambah Period"}
          </button>
        </div>
        {selectedPeriodProject && hasActivePeriodProject ? (
          <p className="inline-note">
            Menampilkan period untuk workspace: <strong>{selectedPeriodProject.name || "Tanpa nama"}</strong>
          </p>
        ) : null}
        {!selectedPeriodProject ? (
          <p className="inline-note">Pilih workspace aktif untuk membuka form tambah/generate period.</p>
        ) : null}
        {selectedPeriodProject && !hasActivePeriodProject ? (
          <p className="inline-note">
            Workspace terpilih berstatus <strong>Inactive</strong>. Aktifkan workspace atau pilih workspace lain
            untuk menambah/generate period.
          </p>
        ) : null}
        {selectedPeriodProject ? (
          <p className="inline-note">
            Total period terdaftar untuk workspace ini: <strong>{periods.length}</strong>
          </p>
        ) : null}
        {periodFeedback ? (
          <p
            className={
              periodFeedback.tone === "error"
                ? "error-box"
                : periodFeedback.tone === "warning"
                  ? "inline-note"
                  : "task-note"
            }
          >
            {periodFeedback.message}
          </p>
        ) : null}

        <div className="admin-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Rentang</th>
                <th>Status</th>
                <th>Version</th>
                <th>Diperbarui</th>
              </tr>
            </thead>
            <tbody>
              {!periodProjectFilter && (
                <tr>
                  <td colSpan={5}>Pilih workspace project terlebih dahulu.</td>
                </tr>
              )}
              {periodProjectFilter && periods.length === 0 && (
                <tr>
                  <td colSpan={5}>Belum ada scoring period untuk project ini.</td>
                </tr>
              )}
              {periods.map((item) => (
                <tr key={item.id}>
                  <td>{item.year && item.week ? `${item.year} W${item.week}` : item.id}</td>
                  <td>{item.start_date || "N/A"} - {item.end_date || "N/A"}</td>
                  <td>{item.status || "OPEN"}</td>
                  <td>{item.version ?? "N/A"}</td>
                  <td>{formatDateTime(item.updated_at || item.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showPeriodCreateForm && hasActivePeriodProject && (
          <>
            <form className="field-grid" onSubmit={(event) => void handleCreatePeriod(event)}>
              <label>
                Year
                <input
                  type="number"
                  value={periodForm.year}
                  onChange={(event) => setPeriodForm((prev) => ({ ...prev, year: event.target.value }))}
                  min={2000}
                  max={2100}
                  required
                />
              </label>
              <label>
                Week
                <input
                  type="number"
                  value={periodForm.week}
                  onChange={(event) => setPeriodForm((prev) => ({ ...prev, week: event.target.value }))}
                  min={1}
                  max={53}
                  required
                />
              </label>
              <label>
                Start Date (opsional)
                <input
                  type="date"
                  value={periodForm.start_date}
                  onChange={(event) => setPeriodForm((prev) => ({ ...prev, start_date: event.target.value }))}
                />
              </label>
              <label>
                End Date (opsional)
                <input
                  type="date"
                  value={periodForm.end_date}
                  onChange={(event) => setPeriodForm((prev) => ({ ...prev, end_date: event.target.value }))}
                />
              </label>
              <label>
                Initial Status
                <select
                  value={periodForm.status}
                  onChange={(event) =>
                    setPeriodForm((prev) => ({ ...prev, status: event.target.value as "OPEN" | "LOCKED" }))
                  }
                >
                  <option value="OPEN">OPEN</option>
                  <option value="LOCKED">LOCKED</option>
                </select>
              </label>
              <p className="inline-note">
                Jika Start/End date kosong, sistem akan mengisi otomatis berdasarkan year-week (ISO week).
              </p>
              <div className="wizard-actions">
                <button type="submit" className="action-primary" disabled={working || !hasActivePeriodProject}>
                  Simpan Period
                </button>
              </div>
            </form>

            <hr className="task-separator" />

            <form className="field-grid" onSubmit={(event) => void handleBulkGeneratePeriods(event)}>
              <label>
                Mode Generate
                <select
                  value={periodBulkForm.scope}
                  onChange={(event) =>
                    setPeriodBulkForm((prev) => ({ ...prev, scope: event.target.value as "year" | "month" }))
                  }
                >
                  <option value="year">1 Tahun (semua minggu)</option>
                  <option value="month">Per Bulan (minggu overlap bulan)</option>
                </select>
              </label>
              <label>
                Year
                <input
                  type="number"
                  value={periodBulkForm.year}
                  onChange={(event) => setPeriodBulkForm((prev) => ({ ...prev, year: event.target.value }))}
                  min={2000}
                  max={2100}
                  required
                />
              </label>
              <label>
                Bulan (jika mode bulanan)
                <select
                  value={periodBulkForm.month}
                  onChange={(event) => setPeriodBulkForm((prev) => ({ ...prev, month: event.target.value }))}
                  disabled={periodBulkForm.scope !== "month"}
                >
                  {MONTH_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Initial Status
                <select
                  value={periodBulkForm.status}
                  onChange={(event) =>
                    setPeriodBulkForm((prev) => ({ ...prev, status: event.target.value as "OPEN" | "LOCKED" }))
                  }
                >
                  <option value="OPEN">OPEN</option>
                  <option value="LOCKED">LOCKED</option>
                </select>
              </label>
              <p className="inline-note">
                Sistem hanya membuat period yang belum ada. Period duplikat otomatis dilewati.
              </p>
              <div className="wizard-actions">
                <button type="submit" className="action-primary" disabled={working || !hasActivePeriodProject}>
                  Generate Period Otomatis
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      <section className="task-panel">
        <h2>Perspectives (Org Level)</h2>
        <p className="task-subtitle">
          Perspective bersifat baseline organisasi (fixed) dan tidak dapat diubah dari admin panel.
        </p>
        <p className="inline-note">
          Perubahan perspective hanya boleh melalui pembaruan blueprint/migrasi terkontrol.
        </p>
        {hiddenLegacyPerspectiveCount > 0 && (
          <p className="inline-note">
            {hiddenLegacyPerspectiveCount} perspective legacy/nonaktif disembunyikan dari daftar utama.
          </p>
        )}

        <div className="admin-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Perspective</th>
                <th>Deskripsi</th>
                <th>Bobot</th>
                <th>Status</th>
                <th>Diperbarui</th>
              </tr>
            </thead>
            <tbody>
              {visiblePerspectiveRows.length === 0 && (
                <tr>
                  <td colSpan={5}>Belum ada perspective aktif yang valid.</td>
                </tr>
              )}
              {visiblePerspectiveRows.map((item) => (
                <tr key={item.id}>
                  <td>{item.title || "Tanpa judul"}</td>
                  <td>{item.description || "N/A"}</td>
                  <td>{item.weight ?? "N/A"}</td>
                  <td>{asBooleanLabel(item.is_active)}</td>
                  <td>{formatDateTime(item.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="task-panel">
        <h2>Indicators</h2>
        <p className="task-subtitle">
          Indikator dikelompokkan per perspective. Pilih perspective terlebih dahulu untuk melihat daftar dan menambah indikator baru.
        </p>
        <div className="wizard-actions">
          <button
            type="button"
            className="action-primary"
            disabled={working || !indicatorPerspectiveFilter}
            onClick={() => setShowIndicatorCreateForm((prev) => !prev)}
          >
            {showIndicatorCreateForm ? "Tutup Form Tambah" : "Tambah Indicator"}
          </button>
        </div>

        <div className="wizard-actions admin-filter-row">
          <label>
            Perspective
            <select
              value={indicatorPerspectiveFilter}
              onChange={(event) => handleChangeIndicatorPerspective(event.target.value)}
            >
              <option value="">Pilih perspective</option>
              {sortedPerspectiveOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title || item.code || "Perspective tanpa judul"}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!indicatorPerspectiveFilter && (
          <p className="inline-note">
            Pilih perspective untuk menampilkan daftar indikator. Ini mencegah daftar terlalu panjang dan scroll berlebihan.
          </p>
        )}
        {selectedIndicatorPerspective && (
          <p className="inline-note">
            Menampilkan indikator untuk: <strong>{selectedIndicatorPerspective.title || "Perspective tanpa judul"}</strong>
          </p>
        )}

        <div className="admin-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Judul Indikator</th>
                <th>Deskripsi</th>
                <th>Status</th>
                <th>Diperbarui</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {!indicatorPerspectiveFilter && (
                <tr>
                  <td colSpan={5}>Pilih perspective terlebih dahulu.</td>
                </tr>
              )}
              {indicatorPerspectiveFilter && indicators.length === 0 && (
                <tr>
                  <td colSpan={5}>Belum ada indikator pada perspective ini.</td>
                </tr>
              )}
              {indicators.map((item) => (
                <tr key={item.id}>
                  <td>{item.title || "Tanpa judul"}</td>
                  <td>{item.description || "N/A"}</td>
                  <td>{asBooleanLabel(item.is_active)}</td>
                  <td>{formatDateTime(item.updated_at)}</td>
                  <td>
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => {
                        const yes = window.confirm(`Hapus indikator "${item.title || "tanpa judul"}"?`);
                        if (!yes) return;
                        void handleDeleteIndicator(item.id);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showIndicatorCreateForm && (
          <form className="field-grid" onSubmit={(event) => void handleCreateIndicator(event)}>
            <label>
              Perspective Terpilih
              <select
                value={indicatorForm.perspective_id || indicatorPerspectiveFilter}
                onChange={(event) => handleChangeIndicatorPerspective(event.target.value)}
                required
              >
                <option value="">Pilih perspective</option>
                {sortedPerspectiveOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title || item.code || "Perspective tanpa judul"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Judul Indikator
                <input
                value={indicatorForm.title}
                onChange={(event) => setIndicatorForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Model coordination issue closure"
                required
              />
            </label>
            <label>
              Deskripsi
              <textarea
                value={indicatorForm.description}
                onChange={(event) => setIndicatorForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Deskripsi indikator"
              />
            </label>
            <p className="inline-note">Kode internal indikator dibuat otomatis saat simpan.</p>
            <div className="wizard-actions">
              <button type="submit" className="action-primary" disabled={working}>
                Simpan Indicator
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
