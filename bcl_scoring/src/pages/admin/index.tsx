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

  const [projectForm, setProjectForm] = useState({
    code: "",
    name: "",
    config_key: "",
  });
  const [perspectiveForm, setPerspectiveForm] = useState({
    code: "",
    title: "",
    description: "",
    weight: "",
  });
  const [indicatorForm, setIndicatorForm] = useState({
    perspective_id: "",
    bim_use_id: "",
    code: "",
    title: "",
    description: "",
  });
  const [lockReason, setLockReason] = useState("");

  const sortedPerspectiveOptions = useMemo(() => {
    return [...perspectives].sort((a, b) =>
      String(a.code || "").localeCompare(String(b.code || ""))
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
        code: toNonEmptyString(projectForm.code) || undefined,
        name,
        config_key: toNonEmptyString(projectForm.config_key) || undefined,
        is_active: true,
      });
      setProjectForm({ code: "", name: "", config_key: "" });
      await reloadData(session, indicatorPerspectiveFilter);
    }, "Project workspace berhasil dibuat.");
  }

  async function handleCreatePerspective(event: FormEvent) {
    event.preventDefault();
    const code = toNonEmptyString(perspectiveForm.code);
    const title = toNonEmptyString(perspectiveForm.title);
    if (!code || !title) {
      setError("Perspective code dan title wajib diisi.");
      return;
    }
    await runAction(async () => {
      await createAdminPerspective(session, {
        code,
        title,
        description: toNonEmptyString(perspectiveForm.description) || undefined,
        weight: parseWeightInput(perspectiveForm.weight),
        is_active: true,
      });
      setPerspectiveForm({ code: "", title: "", description: "", weight: "" });
      await reloadData(session, indicatorPerspectiveFilter);
    }, "Perspective berhasil ditambahkan.");
  }

  async function handleCreateIndicator(event: FormEvent) {
    event.preventDefault();
    const perspective_id = toNonEmptyString(indicatorForm.perspective_id);
    const code = toNonEmptyString(indicatorForm.code);
    const title = toNonEmptyString(indicatorForm.title);
    if (!perspective_id || !code || !title) {
      setError("Perspective, code, dan title indikator wajib diisi.");
      return;
    }
    await runAction(async () => {
      await createAdminIndicator(session, {
        perspective_id,
        code,
        title,
        description: toNonEmptyString(indicatorForm.description) || undefined,
        bim_use_id: toNonEmptyString(indicatorForm.bim_use_id) || undefined,
        is_active: true,
      });
      setIndicatorForm((prev) => ({
        ...prev,
        bim_use_id: "",
        code: "",
        title: "",
        description: "",
      }));
      await reloadData(session, indicatorPerspectiveFilter);
    }, "Indicator berhasil ditambahkan.");
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
        <form className="field-grid" onSubmit={(event) => void handleCreateProject(event)}>
          <label>
            Project Code
            <input
              value={projectForm.code}
              onChange={(event) => setProjectForm((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="PRJ-NEW-001"
            />
          </label>
          <label>
            Project Name
            <input
              value={projectForm.name}
              onChange={(event) => setProjectForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Nama Workspace Proyek"
              required
            />
          </label>
          <label>
            Config Key
            <input
              value={projectForm.config_key}
              onChange={(event) => setProjectForm((prev) => ({ ...prev, config_key: event.target.value }))}
              placeholder="PRJ-001"
            />
          </label>
          <div className="wizard-actions">
            <button type="submit" className="action-primary" disabled={working}>
              Tambah Project
            </button>
          </div>
        </form>

        <div className="admin-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Code</th>
                <th>Name</th>
                <th>Config Key</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 && (
                <tr>
                  <td colSpan={6}>No project found.</td>
                </tr>
              )}
              {projects.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.code || "N/A"}</td>
                  <td>{item.name || "N/A"}</td>
                  <td>{item.config_key || "N/A"}</td>
                  <td>{asBooleanLabel(item.is_active)}</td>
                  <td>
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => {
                        const yes = window.confirm(`Delete project ${item.name || item.id}?`);
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
      </section>

      <section className="task-panel">
        <h2>Perspectives (Org Level)</h2>
        <form className="field-grid" onSubmit={(event) => void handleCreatePerspective(event)}>
          <label>
            Perspective Code
            <input
              value={perspectiveForm.code}
              onChange={(event) => setPerspectiveForm((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="P6"
              required
            />
          </label>
          <label>
            Title
            <input
              value={perspectiveForm.title}
              onChange={(event) => setPerspectiveForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Governance Insight"
              required
            />
          </label>
          <label>
            Weight (optional)
            <input
              value={perspectiveForm.weight}
              onChange={(event) => setPerspectiveForm((prev) => ({ ...prev, weight: event.target.value }))}
              placeholder="15"
            />
          </label>
          <label>
            Description
            <textarea
              value={perspectiveForm.description}
              onChange={(event) =>
                setPerspectiveForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Deskripsi perspective"
            />
          </label>
          <div className="wizard-actions">
            <button type="submit" className="action-primary" disabled={working}>
              Tambah Perspective
            </button>
          </div>
        </form>

        <div className="admin-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Code</th>
                <th>Title</th>
                <th>Weight</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {perspectives.length === 0 && (
                <tr>
                  <td colSpan={6}>No perspectives found.</td>
                </tr>
              )}
              {perspectives.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.code || "N/A"}</td>
                  <td>{item.title || "N/A"}</td>
                  <td>{item.weight ?? "N/A"}</td>
                  <td>{asBooleanLabel(item.is_active)}</td>
                  <td>
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => {
                        const yes = window.confirm(`Delete perspective ${item.code || item.id}?`);
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
      </section>

      <section className="task-panel">
        <h2>Indicators</h2>
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
              <option value="">Select perspective</option>
              {sortedPerspectiveOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code || item.id} - {item.title || "No title"}
                </option>
              ))}
            </select>
          </label>
          <label>
            BIM Use ID
            <input
              value={indicatorForm.bim_use_id}
              onChange={(event) => setIndicatorForm((prev) => ({ ...prev, bim_use_id: event.target.value }))}
              placeholder="BU-01"
            />
          </label>
          <label>
            Indicator Code
            <input
              value={indicatorForm.code}
              onChange={(event) => setIndicatorForm((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="P2-07"
              required
            />
          </label>
          <label>
            Title
            <input
              value={indicatorForm.title}
              onChange={(event) => setIndicatorForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Model coordination issue closure"
              required
            />
          </label>
          <label>
            Description
            <textarea
              value={indicatorForm.description}
              onChange={(event) => setIndicatorForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Deskripsi indikator"
            />
          </label>
          <div className="wizard-actions">
            <button type="submit" className="action-primary" disabled={working}>
              Tambah Indicator
            </button>
          </div>
        </form>

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
                  {item.code || item.id}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Perspective ID</th>
                <th>Code</th>
                <th>Title</th>
                <th>BIM Use</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {indicators.length === 0 && (
                <tr>
                  <td colSpan={7}>No indicators found.</td>
                </tr>
              )}
              {indicators.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.perspective_id || "N/A"}</td>
                  <td>{item.code || "N/A"}</td>
                  <td>{item.title || "N/A"}</td>
                  <td>{item.bim_use_id || "N/A"}</td>
                  <td>{asBooleanLabel(item.is_active)}</td>
                  <td>
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => {
                        const yes = window.confirm(`Delete indicator ${item.code || item.id}?`);
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
      </section>
    </main>
  );
}
