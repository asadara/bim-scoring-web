import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  AdminConfigLock,
  AdminIndicator,
  AdminPerspective,
  AdminProject,
  AdminSession,
  createAdminIndicator,
  createAdminPerspective,
  createAdminProject,
  deleteAdminIndicator,
  deleteAdminPerspective,
  deleteAdminProject,
  getAdminConfigLock,
  listAdminIndicators,
  listAdminPerspectives,
  listAdminProjects,
  setAdminConfigLock,
} from "@/lib/adminTaskLayer";

const ADMIN_SESSION_KEY = "bim_admin_session_v1";

function toNonEmptyString(value: string): string | null {
  const out = value.trim();
  return out ? out : null;
}

function asBooleanLabel(value: boolean | null): string {
  if (value === true) return "Active";
  if (value === false) return "Inactive";
  return "N/A";
}

function parseWeightInput(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleString();
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

export default function AdminControlPanelPage() {
  const [session, setSession] = useState<AdminSession>({ actorId: "admin-web", role: "Admin" });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [perspectives, setPerspectives] = useState<AdminPerspective[]>([]);
  const [indicators, setIndicators] = useState<AdminIndicator[]>([]);
  const [configLock, setConfigLock] = useState<AdminConfigLock | null>(null);
  const [indicatorPerspectiveFilter, setIndicatorPerspectiveFilter] = useState<string>("ALL");

  const [showProjectCreateForm, setShowProjectCreateForm] = useState(false);
  const [showPerspectiveCreateForm, setShowPerspectiveCreateForm] = useState(false);
  const [showIndicatorCreateForm, setShowIndicatorCreateForm] = useState(false);

  const [projectForm, setProjectForm] = useState({
    name: "",
    config_key: "",
  });
  const [perspectiveForm, setPerspectiveForm] = useState({
    title: "",
    description: "",
    weight: "",
  });
  const [indicatorForm, setIndicatorForm] = useState({
    perspective_id: "",
    title: "",
    description: "",
  });
  const [lockReason, setLockReason] = useState("");

  const sortedPerspectiveOptions = useMemo(() => {
    return [...perspectives].sort((a, b) =>
      String(a.title || a.code || "").localeCompare(String(b.title || b.code || ""))
    );
  }, [perspectives]);

  const perspectiveTitleById = useMemo(() => {
    return new Map(
      perspectives.map((item) => [item.id, item.title || item.code || "Perspective tanpa judul"])
    );
  }, [perspectives]);

  async function reloadData(currentSession: AdminSession, perspectiveFilter: string) {
    const perspectiveId = perspectiveFilter !== "ALL" ? perspectiveFilter : null;
    const [projectRows, perspectiveRows, indicatorRows, lockRow] = await Promise.all([
      listAdminProjects(currentSession),
      listAdminPerspectives(currentSession),
      listAdminIndicators(currentSession, { perspective_id: perspectiveId }),
      getAdminConfigLock(currentSession),
    ]);
    setProjects(projectRows);
    setPerspectives(perspectiveRows);
    setIndicators(indicatorRows);
    setConfigLock(lockRow);
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
        await reloadData(session, indicatorPerspectiveFilter);
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
  }, [session, indicatorPerspectiveFilter]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  }, [session]);

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
      await reloadData(session, indicatorPerspectiveFilter);
    }, "Project workspace berhasil dibuat.");
  }

  async function handleCreatePerspective(event: FormEvent) {
    event.preventDefault();
    const title = toNonEmptyString(perspectiveForm.title);
    if (!title) {
      setError("Title perspective wajib diisi.");
      return;
    }
    const code = buildInternalCode(`PSP${buildCodePrefix(title, "GEN")}`);
    await runAction(async () => {
      await createAdminPerspective(session, {
        code,
        title,
        description: toNonEmptyString(perspectiveForm.description) || undefined,
        weight: parseWeightInput(perspectiveForm.weight),
        is_active: true,
      });
      setPerspectiveForm({ title: "", description: "", weight: "" });
      setShowPerspectiveCreateForm(false);
      await reloadData(session, indicatorPerspectiveFilter);
    }, "Perspective berhasil ditambahkan (kode internal dibuat otomatis).");
  }

  async function handleCreateIndicator(event: FormEvent) {
    event.preventDefault();
    const perspective_id = toNonEmptyString(indicatorForm.perspective_id);
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
        title: "",
        description: "",
      }));
      setShowIndicatorCreateForm(false);
      await reloadData(session, indicatorPerspectiveFilter);
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
      await reloadData(session, indicatorPerspectiveFilter);
    }, nextLock ? "Config lock diaktifkan." : "Config lock dibuka.");
  }

  async function handleDeleteProject(id: string) {
    await runAction(async () => {
      await deleteAdminProject(session, id);
      await reloadData(session, indicatorPerspectiveFilter);
    }, "Project berhasil dihapus.");
  }

  async function handleDeletePerspective(id: string) {
    await runAction(async () => {
      await deleteAdminPerspective(session, id);
      await reloadData(session, indicatorPerspectiveFilter);
    }, "Perspective berhasil dihapus.");
  }

  async function handleDeleteIndicator(id: string) {
    await runAction(async () => {
      await deleteAdminIndicator(session, id);
      await reloadData(session, indicatorPerspectiveFilter);
    }, "Indicator berhasil dihapus.");
  }

  return (
    <main className="task-shell">
      <header className="task-header">
        <p className="task-kicker">BIM Scoring Platform</p>
        <h1>Admin Control Panel</h1>
        <p className="task-subtitle">
          Workspace untuk Admin: kelola project, perspectives, indicators, dan lock konfigurasi.
        </p>
        <div className="wizard-actions">
          <Link href="/">Dashboard</Link>
          <Link href="/start">Start</Link>
          <Link href="/projects">Role 1</Link>
          <Link href="/ho/review">Role 2</Link>
          <Link href="/approve">Role 3</Link>
          <Link href="/audit">Audit</Link>
        </div>
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
                  await reloadData(session, indicatorPerspectiveFilter);
                }, "Data admin dimuat ulang.");
              }}
            >
              Reload Data
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
        <h2>Perspectives (Org Level)</h2>
        <p className="task-subtitle">Tampilan fokus ke metadata manusiawi tanpa ID/kode teknis.</p>
        <div className="wizard-actions">
          <button
            type="button"
            className="action-primary"
            disabled={working}
            onClick={() => setShowPerspectiveCreateForm((prev) => !prev)}
          >
            {showPerspectiveCreateForm ? "Tutup Form Tambah" : "Tambah Perspective"}
          </button>
        </div>

        <div className="admin-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Perspective</th>
                <th>Deskripsi</th>
                <th>Bobot</th>
                <th>Status</th>
                <th>Diperbarui</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {perspectives.length === 0 && (
                <tr>
                  <td colSpan={6}>Belum ada perspective.</td>
                </tr>
              )}
              {perspectives.map((item) => (
                <tr key={item.id}>
                  <td>{item.title || "Tanpa judul"}</td>
                  <td>{item.description || "N/A"}</td>
                  <td>{item.weight ?? "N/A"}</td>
                  <td>{asBooleanLabel(item.is_active)}</td>
                  <td>{formatDateTime(item.updated_at)}</td>
                  <td>
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => {
                        const yes = window.confirm(`Hapus perspective "${item.title || "tanpa judul"}"?`);
                        if (!yes) return;
                        void handleDeletePerspective(item.id);
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

        {showPerspectiveCreateForm && (
          <form className="field-grid" onSubmit={(event) => void handleCreatePerspective(event)}>
            <label>
              Judul Perspective
              <input
                value={perspectiveForm.title}
                onChange={(event) => setPerspectiveForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Governance & Strategy"
                required
              />
            </label>
            <label>
              Bobot (opsional)
              <input
                value={perspectiveForm.weight}
                onChange={(event) => setPerspectiveForm((prev) => ({ ...prev, weight: event.target.value }))}
                placeholder="15"
              />
            </label>
            <label>
              Deskripsi
              <textarea
                value={perspectiveForm.description}
                onChange={(event) =>
                  setPerspectiveForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Deskripsi perspective"
              />
            </label>
            <p className="inline-note">Kode internal perspective dibuat otomatis saat simpan.</p>
            <div className="wizard-actions">
              <button type="submit" className="action-primary" disabled={working}>
                Simpan Perspective
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="task-panel">
        <h2>Indicators</h2>
        <p className="task-subtitle">Daftar indikator menampilkan informasi operasional yang mudah dibaca.</p>
        <div className="wizard-actions">
          <button
            type="button"
            className="action-primary"
            disabled={working}
            onClick={() => setShowIndicatorCreateForm((prev) => !prev)}
          >
            {showIndicatorCreateForm ? "Tutup Form Tambah" : "Tambah Indicator"}
          </button>
        </div>

        <div className="wizard-actions admin-filter-row">
          <label>
            Filter perspective
            <select
              value={indicatorPerspectiveFilter}
              onChange={(event) => setIndicatorPerspectiveFilter(event.target.value)}
            >
              <option value="ALL">All</option>
              {sortedPerspectiveOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title || item.code || "Perspective tanpa judul"}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Perspective</th>
                <th>Judul Indikator</th>
                <th>Deskripsi</th>
                <th>Status</th>
                <th>Diperbarui</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {indicators.length === 0 && (
                <tr>
                  <td colSpan={6}>Belum ada indikator.</td>
                </tr>
              )}
              {indicators.map((item) => (
                <tr key={item.id}>
                  <td>{perspectiveTitleById.get(item.perspective_id || "") || "N/A"}</td>
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
              Perspective
              <select
                value={indicatorForm.perspective_id}
                onChange={(event) =>
                  setIndicatorForm((prev) => ({ ...prev, perspective_id: event.target.value }))
                }
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
