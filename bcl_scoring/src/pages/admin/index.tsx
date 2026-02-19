import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  AdminConfigLock,
  AdminIndicator,
  AdminPerspective,
  AdminProject,
  AdminRoleMapping,
  AdminScoringPeriod,
  AdminSession,
  AdminUser,
  Role2BimUseProposal,
  createAdminRoleMapping,
  createAdminIndicator,
  createAdminProject,
  decideRole2BimUseProposal,
  deleteAdminIndicator,
  getAdminConfigLock,
  listAdminIndicators,
  listAdminProjectPeriods,
  listAdminPerspectives,
  listAdminProjects,
  listRole2BimUseProposals,
  listAdminRoleMappings,
  listAdminUsers,
  setAdminConfigLock,
  updateAdminRoleMapping,
  updateAdminProject,
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
type RequestedRole = "role1" | "role2" | "role3" | "viewer";

type WeekAnchor = "SUNDAY" | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY";

const WEEK_ANCHOR_OPTIONS: Array<{ value: WeekAnchor; label: string }> = [
  { value: "MONDAY", label: "Senin" },
  { value: "TUESDAY", label: "Selasa" },
  { value: "WEDNESDAY", label: "Rabu" },
  { value: "THURSDAY", label: "Kamis" },
  { value: "FRIDAY", label: "Jumat" },
  { value: "SATURDAY", label: "Sabtu" },
  { value: "SUNDAY", label: "Minggu" },
];

const ROLE_PRIORITY: AppRole[] = ["admin", "role3", "role2", "role1", "viewer"];

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

function normalizeRequestedRole(raw: unknown): RequestedRole | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (value === "role1") return "role1";
  if (value === "role2") return "role2";
  if (value === "role3") return "role3";
  if (value === "viewer" || value === "auditor") return "viewer";
  return null;
}

function normalizeRequestedProjectIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((item) => toNonEmptyString(String(item || ""))).filter(Boolean) as string[])];
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return [
          ...new Set(
            parsed.map((item) => toNonEmptyString(String(item || ""))).filter(Boolean) as string[]
          ),
        ];
      }
      return [];
    } catch {
      return [];
    }
  }
  return [];
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

function parseWeekAnchorFromConfigKey(configKey: string | null | undefined): WeekAnchor {
  const raw = String(configKey || "").trim();
  if (!raw) return "MONDAY";

  const match = raw.match(/week_anchor\s*[:=]\s*(SUNDAY|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY)/i);
  if (match) return String(match[1]).toUpperCase() as WeekAnchor;

  // Allow plain anchor stored as "MONDAY", etc.
  const normalized = raw.toUpperCase();
  if (
    normalized === "SUNDAY" ||
    normalized === "MONDAY" ||
    normalized === "TUESDAY" ||
    normalized === "WEDNESDAY" ||
    normalized === "THURSDAY" ||
    normalized === "FRIDAY" ||
    normalized === "SATURDAY"
  ) {
    return normalized as WeekAnchor;
  }

  return "MONDAY";
}

function upsertWeekAnchorConfigKey(configKey: string | null | undefined, anchor: WeekAnchor): string {
  const raw = String(configKey || "").trim();
  if (!raw) return `week_anchor=${anchor}`;

  const replaced = raw.replace(
    /week_anchor\s*[:=]\s*(SUNDAY|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY)/i,
    `week_anchor=${anchor}`
  );
  if (replaced !== raw) return replaced;

  return `${raw}; week_anchor=${anchor}`;
}

function resolveUserGlobalRole(userId: string, mappings: AdminRoleMapping[]): AppRole {
  const globalRoles = mappings
    .filter((item) => item.user_id === userId && item.is_active !== false && !toNonEmptyString(item.project_id || ""))
    .map((item) => {
      const role = String(item.role || "").trim().toLowerCase();
      if (role === "admin") return "admin";
      if (role === "role3") return "role3";
      if (role === "role2") return "role2";
      if (role === "role1") return "role1";
      return "viewer";
    });
  for (const role of ROLE_PRIORITY) {
    if (globalRoles.includes(role)) return role;
  }
  return "viewer";
}

export default function AdminControlPanelPage() {
  const [session, setSession] = useState<AdminSession>({ actorId: "admin-web", role: "Admin" });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [indicatorLoading, setIndicatorLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [periodFeedback, setPeriodFeedback] = useState<{
    tone: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [perspectives, setPerspectives] = useState<AdminPerspective[]>([]);
  const [indicators, setIndicators] = useState<AdminIndicator[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roleMappings, setRoleMappings] = useState<AdminRoleMapping[]>([]);
  const [role2Proposals, setRole2Proposals] = useState<Role2BimUseProposal[]>([]);
  const [userRoleDraftById, setUserRoleDraftById] = useState<Record<string, AppRole>>({});
  const [periods, setPeriods] = useState<AdminScoringPeriod[]>([]);
  const [configLock, setConfigLock] = useState<AdminConfigLock | null>(null);
  const [indicatorPerspectiveFilter, setIndicatorPerspectiveFilter] = useState<string>("");
  const [periodProjectFilter, setPeriodProjectFilter] = useState<string>("");

  const [showProjectCreateForm, setShowProjectCreateForm] = useState(false);
  const [showIndicatorCreateForm, setShowIndicatorCreateForm] = useState(false);

  const [projectForm, setProjectForm] = useState({
    name: "",
    config_key: "",
  });
  const [weekAnchorDraft, setWeekAnchorDraft] = useState<WeekAnchor>("MONDAY");
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

  const projectNameById = useMemo(() => {
    return new Map(
      projects.map((item) => [item.id, item.name || item.code || item.id])
    );
  }, [projects]);

  const userCurrentRoleById = useMemo(() => {
    const out = new Map<string, AppRole>();
    for (const user of users) {
      out.set(user.id, resolveUserGlobalRole(user.id, roleMappings));
    }
    return out;
  }, [users, roleMappings]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) =>
      String(a.name || a.email || a.employee_number || a.id).localeCompare(
        String(b.name || b.email || b.employee_number || b.id)
      )
    );
  }, [users]);

  const selectedPeriodProject = useMemo(() => {
    if (!periodProjectFilter) return null;
    return projects.find((item) => item.id === periodProjectFilter) || null;
  }, [projects, periodProjectFilter]);
  const hasActivePeriodProject = Boolean(
    selectedPeriodProject && selectedPeriodProject.is_active !== false
  );

  useEffect(() => {
    setWeekAnchorDraft(parseWeekAnchorFromConfigKey(selectedPeriodProject?.config_key));
  }, [selectedPeriodProject?.id, selectedPeriodProject?.config_key]);

  async function reloadBase(currentSession: AdminSession): Promise<string | null> {
    const [projectRows, perspectiveRows, userRows, roleMappingRows, lockRow] = await Promise.all([
      listAdminProjects(currentSession),
      listAdminPerspectives(currentSession),
      listAdminUsers(currentSession),
      listAdminRoleMappings(currentSession),
      getAdminConfigLock(currentSession),
    ]);

    setProjects(projectRows);
    setPerspectives(perspectiveRows);
    setUsers(userRows);
    setRoleMappings(roleMappingRows);
    setUserRoleDraftById(
      userRows.reduce<Record<string, AppRole>>((acc, item) => {
        acc[item.id] = resolveUserGlobalRole(item.id, roleMappingRows);
        return acc;
      }, {})
    );
    setConfigLock(lockRow);

    if (projectRows.length === 0) {
      setPeriodProjectFilter("");
      setPeriods([]);
      return null;
    }

    // Keep current selection if still valid; otherwise default to the first project.
    const preferred = toNonEmptyString(periodProjectFilter);
    const nextProjectId =
      preferred && projectRows.some((item) => item.id === preferred)
        ? preferred
        : projectRows[0].id;
    setPeriodProjectFilter(nextProjectId);
    return nextProjectId;
  }

  async function reloadIndicatorsForPerspective(currentSession: AdminSession, perspectiveId: string): Promise<void> {
    const normalized = toNonEmptyString(perspectiveId);
    if (!normalized) {
      setIndicators([]);
      return;
    }
    const indicatorRows = await listAdminIndicators(currentSession, { perspective_id: normalized });
    setIndicators(indicatorRows);
  }

  async function reloadPeriodsForProject(currentSession: AdminSession, projectId: string): Promise<void> {
    const normalized = toNonEmptyString(projectId);
    if (!normalized) {
      setPeriods([]);
      return;
    }
    const periodRows = await listAdminProjectPeriods(currentSession, normalized);
    setPeriods(periodRows);
  }

  async function reloadAll(currentSession: AdminSession): Promise<void> {
    const nextProjectId = await reloadBase(currentSession);
    const [proposalRows] = await Promise.all([
      listRole2BimUseProposals(currentSession).catch(() => []),
      reloadIndicatorsForPerspective(currentSession, indicatorPerspectiveFilter),
      reloadPeriodsForProject(currentSession, nextProjectId || periodProjectFilter),
    ]);
    setRole2Proposals(proposalRows);
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
        await reloadAll(session);
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
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIndicatorLoading(true);
      try {
        await reloadIndicatorsForPerspective(session, indicatorPerspectiveFilter);
        if (!mounted) return;
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load indicators");
      } finally {
        if (mounted) setIndicatorLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [session, indicatorPerspectiveFilter]);

  useEffect(() => {
    if (!indicatorPerspectiveFilter) return;
    const exists = sortedPerspectiveOptions.some((item) => item.id === indicatorPerspectiveFilter);
    if (exists) return;
    setIndicatorPerspectiveFilter("");
    setShowIndicatorCreateForm(false);
    setIndicatorForm({ perspective_id: "", title: "", description: "" });
  }, [sortedPerspectiveOptions, indicatorPerspectiveFilter]);

  useEffect(() => {
    setPeriodFeedback(null);
  }, [periodProjectFilter]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const normalized = toNonEmptyString(periodProjectFilter);
      if (!normalized) {
        setPeriods([]);
        return;
      }

      setPeriodLoading(true);
      setPeriods([]);
      setPeriodFeedback(null);
      try {
        await reloadPeriodsForProject(session, normalized);
        if (!mounted) return;
      } catch (e) {
        if (!mounted) return;
        const message = e instanceof Error ? e.message : "Failed to load periods";
        setPeriodFeedback({ tone: "error", message });
      } finally {
        if (mounted) setPeriodLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [session, periodProjectFilter]);

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
      await reloadBase(session);
    }, "Project workspace berhasil dibuat.");
  }

  async function handleSaveWeeklyAnchor() {
    const projectId = toNonEmptyString(periodProjectFilter);
    if (!projectId) {
      setError("Pilih workspace project terlebih dahulu.");
      return;
    }
    if (!hasActivePeriodProject) {
      setError("Pilih workspace aktif terlebih dahulu sebelum mengubah anchor period.");
      return;
    }

    setWorking(true);
    setError(null);
    setNotice(null);
    setPeriodFeedback(null);
    try {
      const nextConfigKey = upsertWeekAnchorConfigKey(selectedPeriodProject?.config_key, weekAnchorDraft);
      await updateAdminProject(session, projectId, { config_key: nextConfigKey });
      await reloadBase(session);
      await reloadPeriodsForProject(session, projectId);
      const successMessage = `Anchor period mingguan disimpan: ${weekAnchorDraft}.`;
      setNotice(successMessage);
      setPeriodFeedback({ tone: "success", message: successMessage });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Simpan anchor period gagal.";
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
      await reloadIndicatorsForPerspective(session, indicatorPerspectiveFilter);
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
      await reloadBase(session);
    }, nextLock ? "Config lock diaktifkan." : "Config lock dibuka.");
  }

  async function applyGlobalUserRole(userId: string, nextRole: AppRole) {
    const globalMappings = roleMappings.filter(
      (item) => item.user_id === userId && !toNonEmptyString(item.project_id || "")
    );
    const activeGlobal = globalMappings.filter((item) => item.is_active !== false);

    if (nextRole === "viewer") {
      for (const mapping of activeGlobal) {
        await updateAdminRoleMapping(session, mapping.id, { is_active: false });
      }
      return;
    }

    for (const mapping of activeGlobal) {
      const mappingRole = String(mapping.role || "").trim().toLowerCase();
      if (mappingRole === nextRole) continue;
      await updateAdminRoleMapping(session, mapping.id, { is_active: false });
    }

    const sameRoleMapping = globalMappings.find(
      (item) => String(item.role || "").trim().toLowerCase() === nextRole
    );
    if (sameRoleMapping) {
      if (sameRoleMapping.is_active === false) {
        await updateAdminRoleMapping(session, sameRoleMapping.id, { is_active: true });
      }
    } else {
      await createAdminRoleMapping(session, {
        user_id: userId,
        role: nextRole,
        project_id: null,
        is_active: true,
      });
    }
  }

  async function applyRole2ScopedUserRole(userId: string, requestedProjectIds: string[]) {
    const scopedProjectIds = [...new Set(requestedProjectIds.map((item) => item.trim()).filter(Boolean))];
    if (scopedProjectIds.length === 0) {
      await applyGlobalUserRole(userId, "role2");
      return;
    }

    const allRole2Mappings = roleMappings.filter(
      (item) =>
        item.user_id === userId &&
        String(item.role || "").trim().toLowerCase() === "role2"
    );
    const activeRole2Mappings = allRole2Mappings.filter((item) => item.is_active !== false);

    for (const mapping of activeRole2Mappings) {
      const mappingProjectId = toNonEmptyString(mapping.project_id || "");
      if (mappingProjectId && scopedProjectIds.includes(mappingProjectId)) continue;
      await updateAdminRoleMapping(session, mapping.id, { is_active: false });
    }

    for (const projectId of scopedProjectIds) {
      const sameProject = allRole2Mappings.find((item) => toNonEmptyString(item.project_id || "") === projectId);
      if (sameProject) {
        if (sameProject.is_active === false) {
          await updateAdminRoleMapping(session, sameProject.id, { is_active: true });
        }
      } else {
        await createAdminRoleMapping(session, {
          user_id: userId,
          role: "role2",
          project_id: projectId,
          is_active: true,
        });
      }
    }
  }

  async function handleAssignUserRole(userId: string) {
    const nextRole = userRoleDraftById[userId] || "viewer";
    await runAction(async () => {
      await applyGlobalUserRole(userId, nextRole);
      await reloadBase(session);
    }, `Role user diperbarui ke ${getRoleLabel(nextRole)}.`);
  }

  async function handleApproveRequestedRole(user: AdminUser) {
    const requestedRole = normalizeRequestedRole(user.requested_role);
    if (!requestedRole) {
      setError("Pengajuan role tidak valid atau belum tersedia.");
      return;
    }
    const requestedProjectIds = normalizeRequestedProjectIds(user.requested_project_ids);
    await runAction(async () => {
      if (requestedRole === "role2") {
        await applyRole2ScopedUserRole(user.id, requestedProjectIds);
      } else {
        await applyGlobalUserRole(user.id, requestedRole);
      }
      await reloadAll(session);
    }, `Pengajuan role disetujui: ${user.name || user.email || user.id} -> ${getRoleLabel(requestedRole)}.`);
  }

  async function handleSetProjectActive(projectId: string, nextActive: boolean) {
    await runAction(async () => {
      await updateAdminProject(session, projectId, { is_active: nextActive });
      await reloadBase(session);
      if (periodProjectFilter === projectId) {
        await reloadPeriodsForProject(session, projectId);
      }
    }, nextActive ? "Workspace diaktifkan." : "Workspace dinonaktifkan.");
  }

  async function handleDeleteIndicator(id: string) {
    await runAction(async () => {
      await deleteAdminIndicator(session, id);
      await reloadIndicatorsForPerspective(session, indicatorPerspectiveFilter);
    }, "Indicator berhasil dihapus.");
  }

  async function handleDecideRole2Proposal(proposalId: string, status: "APPROVED" | "REJECTED") {
    await runAction(async () => {
      await decideRole2BimUseProposal(session, proposalId, {
        status,
        decision_note: status === "APPROVED"
          ? "Approved by Admin (proposal-only)."
          : "Rejected by Admin.",
      });
      const rows = await listRole2BimUseProposals(session);
      setRole2Proposals(rows);
    }, status === "APPROVED" ? "Proposal Role 2 disetujui." : "Proposal Role 2 ditolak.");
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
                  await reloadAll(session);
                }, "Data admin dimuat ulang.");
              }}
            >
              Reload Data
            </button>
          </div>
        </form>
      </section>

      <section className="task-panel">
        <h2>User Role Management</h2>
        <p className="task-subtitle">
          Assign role global user dari admin panel, termasuk approve pengajuan role saat pendaftaran.
          Perubahan berlaku setelah user sign out dan sign in ulang.
        </p>
        <div className="admin-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Nomor Pegawai</th>
                <th>Email</th>
                <th>Pengajuan Role</th>
                <th>Pengajuan Scope Project</th>
                <th>Role Aktif</th>
                <th>Set Role</th>
                <th>Approve Pengajuan</th>
                <th>Aksi Manual</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.length === 0 && (
                <tr>
                  <td colSpan={9}>Belum ada user terdaftar.</td>
                </tr>
              )}
              {sortedUsers.map((item) => {
                const currentRole = userCurrentRoleById.get(item.id) || "viewer";
                const draftRole = userRoleDraftById[item.id] || currentRole;
                const requestedRole = normalizeRequestedRole(item.requested_role);
                const requestedProjectIds = normalizeRequestedProjectIds(item.requested_project_ids);
                const requestedScopeLabel =
                  requestedProjectIds.length > 0
                    ? requestedProjectIds.map((id) => projectNameById.get(id) || id).join(", ")
                    : "N/A";
                const activeRole2Scopes = roleMappings
                  .filter(
                    (mapping) =>
                      mapping.user_id === item.id &&
                      mapping.is_active !== false &&
                      String(mapping.role || "").trim().toLowerCase() === "role2"
                  )
                  .map((mapping) => toNonEmptyString(mapping.project_id || ""))
                  .filter(Boolean) as string[];
                const isRequestAlreadyApplied = (() => {
                  if (!requestedRole) return false;
                  if (requestedRole !== "role2") return requestedRole === currentRole;
                  if (requestedProjectIds.length === 0) {
                    return currentRole === "role2" && activeRole2Scopes.length === 0;
                  }
                  return requestedProjectIds.every((projectId) => activeRole2Scopes.includes(projectId));
                })();
                const requestSubmittedAt = formatDateTime(item.requested_role_submitted_at);
                return (
                  <tr key={item.id}>
                    <td>{item.name || "N/A"}</td>
                    <td>{item.employee_number || "N/A"}</td>
                    <td>{item.email || "N/A"}</td>
                    <td>
                      {requestedRole ? (
                        <>
                          <strong>{getRoleLabel(requestedRole)}</strong>
                          <br />
                          <small>
                            Diajukan: {requestSubmittedAt} | Status: {isRequestAlreadyApplied ? "Approved" : "Pending"}
                          </small>
                        </>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td>{requestedScopeLabel}</td>
                    <td>{getRoleLabel(currentRole)}</td>
                    <td>
                      <select
                        value={draftRole}
                        onChange={(event) =>
                          setUserRoleDraftById((prev) => ({
                            ...prev,
                            [item.id]: event.target.value as AppRole,
                          }))
                        }
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={`${item.id}-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={working || !requestedRole || isRequestAlreadyApplied}
                        onClick={() => void handleApproveRequestedRole(item)}
                      >
                        {isRequestAlreadyApplied ? "Sudah Approved" : "Approve Sesuai Pengajuan"}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="action-primary"
                        disabled={working}
                        onClick={() => void handleAssignUserRole(item.id)}
                      >
                        Simpan Role
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="task-panel">
        <h2>Role 2 BIM Use Proposal Queue</h2>
        <p className="task-subtitle">
          Proposal-only workflow. Role 2 mengajukan perubahan BIM Use / mapping indicator, keputusan akhir tetap di Admin.
        </p>
        <p className="inline-note">
          Approve/Reject di sini tidak otomatis mengubah master perspektif/indikator. Perubahan master tetap admin-controlled.
        </p>
        <div className="admin-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Requester</th>
                <th>Project</th>
                <th>Tipe</th>
                <th>Proposed BIM Use</th>
                <th>Indicator IDs</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {role2Proposals.length === 0 ? (
                <tr>
                  <td colSpan={8}>Belum ada proposal Role 2.</td>
                </tr>
              ) : (
                role2Proposals.map((item) => {
                  const requester = users.find((user) => user.id === item.requester_user_id);
                  const indicatorList = Array.isArray(item.indicator_ids) ? item.indicator_ids : [];
                  return (
                    <tr key={item.id}>
                      <td>{requester?.name || requester?.email || item.requester_user_id}</td>
                      <td>{(item.project_id && projectNameById.get(item.project_id)) || item.project_id || "N/A"}</td>
                      <td>{item.proposal_type || "N/A"}</td>
                      <td>{item.proposed_bim_use || "N/A"}</td>
                      <td>{indicatorList.length ? indicatorList.join(", ") : "N/A"}</td>
                      <td>{item.reason || "N/A"}</td>
                      <td>
                        <strong>{item.status || "N/A"}</strong>
                        <br />
                        <small>Dibuat: {formatDateTime(item.created_at)}</small>
                      </td>
                      <td>
                        <div className="item-actions">
                          <button
                            type="button"
                            disabled={working || item.status !== "PENDING"}
                            onClick={() => void handleDecideRole2Proposal(item.id, "APPROVED")}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={working || item.status !== "PENDING"}
                            onClick={() => void handleDecideRole2Proposal(item.id, "REJECTED")}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
        <p className="inline-note">
          Untuk keamanan, aksi hapus workspace dinonaktifkan. Gunakan Deactivate untuk menonaktifkan workspace tanpa menghapus data.
        </p>
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
                        const nextActive = item.is_active === false;
                        const label = item.name || "tanpa nama";
                        const prompt = nextActive
                          ? `Aktifkan workspace "${label}"?`
                          : `Nonaktifkan workspace "${label}"?\n\nCatatan: Data tidak dihapus, hanya disembunyikan dari alur aktif.`;
                        const yes = window.confirm(prompt);
                        if (!yes) return;
                        void handleSetProjectActive(item.id, nextActive);
                      }}
                    >
                      {item.is_active === false ? "Activate" : "Deactivate"}
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
          <label>
            Start Hari Periode (Weekly Anchor)
            <select
              value={weekAnchorDraft}
              onChange={(event) => setWeekAnchorDraft(event.target.value as WeekAnchor)}
              disabled={working || !selectedPeriodProject}
            >
              {WEEK_ANCHOR_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="action-primary"
            disabled={working || !hasActivePeriodProject || !selectedPeriodProject}
            onClick={() => void handleSaveWeeklyAnchor()}
          >
            Simpan Anchor Weekly
          </button>
        </div>
        {selectedPeriodProject && hasActivePeriodProject ? (
          <p className="inline-note">
            Menampilkan period untuk workspace: <strong>{selectedPeriodProject.name || "Tanpa nama"}</strong>
          </p>
        ) : null}
        {!selectedPeriodProject ? <p className="inline-note">Pilih workspace aktif untuk mengatur anchor period.</p> : null}
        {selectedPeriodProject && !hasActivePeriodProject ? (
          <p className="inline-note">
            Workspace terpilih berstatus <strong>Inactive</strong>. Aktifkan workspace atau pilih workspace lain
            untuk mengatur anchor period.
          </p>
        ) : null}
        {selectedPeriodProject ? (
          <p className="inline-note">
            Timezone period: <strong>Asia/Jakarta</strong>, start jam <strong>00:00</strong>. Sistem akan membuat dan
            mengganti period otomatis setiap <strong>7 hari</strong> berdasarkan anchor di atas. Period lama otomatis
            read-only untuk Role 1 (review/approval tetap mengikuti gate policy).
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
              {periodProjectFilter && periodLoading && (
                <tr>
                  <td colSpan={5}>Memuat scoring period...</td>
                </tr>
              )}
              {periodProjectFilter && !periodLoading && periods.length === 0 && (
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
              {indicatorPerspectiveFilter && indicatorLoading && (
                <tr>
                  <td colSpan={5}>Memuat indikator...</td>
                </tr>
              )}
              {indicatorPerspectiveFilter && !indicatorLoading && indicators.length === 0 && (
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
