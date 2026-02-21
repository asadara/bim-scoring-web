import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  AdminConfigLock,
  AdminIndicator,
  AdminPerspective,
  AdminProject,
  AdminRoleMapping,
  AdminScoringPeriod,
  AdminSession,
  AdminTestDataCleanupResult,
  AdminUser,
  Role2BimUseProposal,
  cleanupAdminTestData,
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
import { resolveTestWorkspaceProject } from "@/lib/testWorkspace";
import { AppRole, getRoleLabel } from "@/lib/userCredential";

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
type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "default" | "danger";
  onConfirm: () => void | Promise<void>;
};

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
const TEST_WORKSPACE_NAME = "Workspace Ujicoba";

function toNonEmptyString(value: string): string | null {
  const out = value.trim();
  return out ? out : null;
}

function asBooleanLabel(value: boolean | null): string {
  if (value === true) return "Aktif";
  if (value === false) return "Nonaktif";
  return "-";
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
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

function resolveUserAssignedRole(userId: string, mappings: AdminRoleMapping[]): AppRole {
  const roles = mappings
    .filter((item) => item.user_id === userId && item.is_active !== false)
    .map((item) => {
      const role = String(item.role || "").trim().toLowerCase();
      if (role === "admin") return "admin";
      if (role === "role3") return "role3";
      if (role === "role2") return "role2";
      if (role === "role1") return "role1";
      return "viewer";
    });
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) return role;
  }
  return "viewer";
}

export default function AdminControlPanelPage() {
  const [session, setSession] = useState<AdminSession>({ actorId: "admin-web", role: "Admin" });
  const reloadAllRef = useRef<(currentSession: AdminSession) => Promise<void>>(async () => {});
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
  const [editingProjectId, setEditingProjectId] = useState("");
  const [projectSettingForm, setProjectSettingForm] = useState<{
    name: string;
    config_key: string;
    is_active: boolean;
    week_anchor: WeekAnchor;
  }>({
    name: "",
    config_key: "",
    is_active: true,
    week_anchor: "MONDAY",
  });
  const [weekAnchorDraft, setWeekAnchorDraft] = useState<WeekAnchor>("MONDAY");
  const [indicatorForm, setIndicatorForm] = useState({
    perspective_id: "",
    title: "",
    description: "",
  });
  const [lockReason, setLockReason] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [cleanupUserFilter, setCleanupUserFilter] = useState("");
  const [cleanupProjectFilter, setCleanupProjectFilter] = useState("");
  const [cleanupPeriodFilter, setCleanupPeriodFilter] = useState("");
  const [cleanupIncludeEvidence, setCleanupIncludeEvidence] = useState(true);
  const [cleanupIncludeRole2Proposals, setCleanupIncludeRole2Proposals] = useState(true);
  const [cleanupIncludeSnapshots, setCleanupIncludeSnapshots] = useState(true);
  const [cleanupIncludeStorage, setCleanupIncludeStorage] = useState(true);
  const [cleanupResult, setCleanupResult] = useState<AdminTestDataCleanupResult | null>(null);

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
      perspectives.map((item) => [item.id, item.title || item.code || "Perspektif tanpa judul"])
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
      out.set(user.id, resolveUserAssignedRole(user.id, roleMappings));
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
  const testWorkspaceProject = useMemo(() => {
    return resolveTestWorkspaceProject(projects);
  }, [projects]);
  const hasActivePeriodProject = Boolean(
    selectedPeriodProject && selectedPeriodProject.is_active !== false
  );

  useEffect(() => {
    setWeekAnchorDraft(parseWeekAnchorFromConfigKey(selectedPeriodProject?.config_key));
  }, [selectedPeriodProject?.id, selectedPeriodProject?.config_key]);

  useEffect(() => {
    if (cleanupProjectFilter) return;
    if (!testWorkspaceProject?.id) return;
    setCleanupProjectFilter(testWorkspaceProject.id);
  }, [cleanupProjectFilter, testWorkspaceProject?.id]);

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
        acc[item.id] = resolveUserAssignedRole(item.id, roleMappingRows);
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
  reloadAllRef.current = reloadAll;

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
        await reloadAllRef.current(session);
        if (!mounted) return;
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Gagal memuat data admin.");
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
    if (!confirmDialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working) {
        setConfirmDialog(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [confirmDialog, working]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIndicatorLoading(true);
      try {
        await reloadIndicatorsForPerspective(session, indicatorPerspectiveFilter);
        if (!mounted) return;
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Gagal memuat indikator.");
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
        const message = e instanceof Error ? e.message : "Gagal memuat periode.";
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
      setError(e instanceof Error ? e.message : "Operasi gagal.");
    } finally {
      setWorking(false);
    }
  }

  function requestConfirm(dialog: ConfirmDialogState) {
    setConfirmDialog(dialog);
  }

  function closeConfirm() {
    if (working) return;
    setConfirmDialog(null);
  }

  async function handleConfirm() {
    if (!confirmDialog) return;
    const action = confirmDialog.onConfirm;
    setConfirmDialog(null);
    await action();
  }

  async function handleCreateProject(event: FormEvent) {
    event.preventDefault();
    const name = toNonEmptyString(projectForm.name);
    if (!name) {
      setError("Nama project wajib diisi.");
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
    }, "Workspace project berhasil dibuat.");
  }

  function handleOpenProjectSettingEditor(project: AdminProject) {
    setEditingProjectId(project.id);
    setProjectSettingForm({
      name: project.name || "",
      config_key: project.config_key || "",
      is_active: project.is_active !== false,
      week_anchor: parseWeekAnchorFromConfigKey(project.config_key),
    });
    setPeriodProjectFilter(project.id);
    setError(null);
    setNotice(null);
  }

  function handleCloseProjectSettingEditor() {
    setEditingProjectId("");
    setProjectSettingForm({
      name: "",
      config_key: "",
      is_active: true,
      week_anchor: "MONDAY",
    });
  }

  async function handleSaveProjectSetting(event: FormEvent) {
    event.preventDefault();
    const projectId = toNonEmptyString(editingProjectId);
    const name = toNonEmptyString(projectSettingForm.name);
    if (!projectId) {
      setError("Pilih workspace yang akan diubah.");
      return;
    }
    if (!name) {
      setError("Nama workspace wajib diisi.");
      return;
    }

    await runAction(async () => {
      const nextConfigKey = upsertWeekAnchorConfigKey(
        projectSettingForm.config_key,
        projectSettingForm.week_anchor
      );
      await updateAdminProject(session, projectId, {
        name,
        config_key: toNonEmptyString(nextConfigKey),
        is_active: projectSettingForm.is_active,
      });
      await reloadBase(session);
      await reloadPeriodsForProject(session, projectId);
      setPeriodProjectFilter(projectId);
      setCleanupProjectFilter(projectId);
      handleCloseProjectSettingEditor();
    }, "Setting workspace berhasil diperbarui.");
  }

  async function handleEnsureTestWorkspace() {
    const existing = resolveTestWorkspaceProject(projects);
    if (existing) {
      setCleanupProjectFilter(existing.id);
      setPeriodProjectFilter(existing.id);
      setNotice(`Workspace ujicoba sudah tersedia: ${existing.name || TEST_WORKSPACE_NAME}.`);
      setError(null);
      return;
    }

    await runAction(async () => {
      const created = await createAdminProject(session, {
        name: TEST_WORKSPACE_NAME,
        config_key: "workspace_type=test; week_anchor=MONDAY",
        is_active: true,
      });
      setCleanupProjectFilter(created.id);
      setPeriodProjectFilter(created.id);
      await reloadBase(session);
      await reloadPeriodsForProject(session, created.id);
    }, "Workspace ujicoba berhasil dibuat.");
  }

  async function handleRunTestDataCleanup(dryRun: boolean) {
    const userId = toNonEmptyString(cleanupUserFilter);
    const projectId = toNonEmptyString(cleanupProjectFilter);
    const periodId = toNonEmptyString(cleanupPeriodFilter);
    if (!userId && !projectId && !periodId) {
      setError("Isi minimal satu filter cleanup: user, workspace, atau period.");
      return;
    }

    await runAction(async () => {
      const result = await cleanupAdminTestData(session, {
        user_id: userId,
        project_id: projectId,
        period_id: periodId,
        dry_run: dryRun,
        include_evidence: cleanupIncludeEvidence,
        include_role2_proposals: cleanupIncludeRole2Proposals,
        include_snapshots: cleanupIncludeSnapshots,
        include_storage: cleanupIncludeStorage,
      });
      setCleanupResult(result);
      await reloadAll(session);
    }, dryRun ? "Simulasi cleanup selesai." : "Cleanup data ujicoba selesai.");
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
      setError("Perspektif dan judul indikator wajib diisi.");
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
    }, "Indikator berhasil ditambahkan (kode internal dibuat otomatis).");
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
    }, nextLock ? "Kunci konfigurasi diaktifkan." : "Kunci konfigurasi dibuka.");
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

  async function applyScopedUserRoleAppend(
    userId: string,
    role: "role2" | "role3",
    requestedProjectIds: string[]
  ) {
    const scopedProjectIds = [...new Set(requestedProjectIds.map((item) => item.trim()).filter(Boolean))];
    if (scopedProjectIds.length === 0) {
      await applyGlobalUserRole(userId, role);
      return;
    }

    const allRoleMappings = roleMappings.filter(
      (item) =>
        item.user_id === userId &&
        String(item.role || "").trim().toLowerCase() === role
    );

    for (const projectId of scopedProjectIds) {
      const sameProject = allRoleMappings.find((item) => toNonEmptyString(item.project_id || "") === projectId);
      if (sameProject) {
        if (sameProject.is_active === false) {
          await updateAdminRoleMapping(session, sameProject.id, { is_active: true });
        }
      } else {
        await createAdminRoleMapping(session, {
          user_id: userId,
          role,
          project_id: projectId,
          is_active: true,
        });
      }
    }
  }

  async function applyRole2ScopedUserRole(userId: string, requestedProjectIds: string[]) {
    await applyScopedUserRoleAppend(userId, "role2", requestedProjectIds);
  }

  async function applyRole3ScopedUserRole(userId: string, requestedProjectIds: string[]) {
    await applyScopedUserRoleAppend(userId, "role3", requestedProjectIds);
  }

  async function applyRole1ScopedUserRole(userId: string, targetProjectId: string | null) {
    const scopedProjectId = toNonEmptyString(targetProjectId || "");
    await applyGlobalUserRole(userId, "role1");

    const allRole1Mappings = roleMappings.filter(
      (item) =>
        item.user_id === userId &&
        String(item.role || "").trim().toLowerCase() === "role1"
    );

    if (!scopedProjectId) {
      for (const mapping of allRole1Mappings) {
        const mappingProjectId = toNonEmptyString(mapping.project_id || "");
        if (mappingProjectId && mapping.is_active !== false) {
          await updateAdminRoleMapping(session, mapping.id, { is_active: false });
        }
      }
      return;
    }

    for (const mapping of allRole1Mappings) {
      const mappingProjectId = toNonEmptyString(mapping.project_id || "");
      if (!mappingProjectId || mappingProjectId === scopedProjectId || mapping.is_active === false) continue;
      await updateAdminRoleMapping(session, mapping.id, { is_active: false });
    }

    const sameProject = allRole1Mappings.find(
      (item) => toNonEmptyString(item.project_id || "") === scopedProjectId
    );
    if (sameProject) {
      if (sameProject.is_active === false) {
        await updateAdminRoleMapping(session, sameProject.id, { is_active: true });
      }
    } else {
      await createAdminRoleMapping(session, {
        user_id: userId,
        role: "role1",
        project_id: scopedProjectId,
        is_active: true,
      });
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
    const currentRole = userCurrentRoleById.get(user.id) || resolveUserAssignedRole(user.id, roleMappings);
    const isRole1WorkspaceSwitchToTest = requestedRole === "role1" && currentRole === "role1";
    const testWorkspaceId = toNonEmptyString(testWorkspaceProject?.id || "");
    const requestedRole2Or3ScopeWithTrial =
      (requestedRole === "role2" || requestedRole === "role3") && requestedProjectIds.length > 0 && testWorkspaceId
        ? [...new Set([...requestedProjectIds, testWorkspaceId])]
        : requestedProjectIds;
    const requestedRole1ProjectId = requestedProjectIds[0] || null;
    if (requestedRole === "role1" && isRole1WorkspaceSwitchToTest && !testWorkspaceId) {
      setError("Workspace ujicoba belum tersedia. Buat workspace ujicoba terlebih dahulu.");
      return;
    }
    const targetRole1ProjectId = isRole1WorkspaceSwitchToTest ? testWorkspaceId : requestedRole1ProjectId;
    if (requestedRole === "role1" && !targetRole1ProjectId) {
      setError("Pengajuan Role 1 belum memiliki target workspace yang valid.");
      return;
    }
    const userLabel = user.name || user.email || user.id;
    const successMessage =
      requestedRole === "role1" && isRole1WorkspaceSwitchToTest
        ? `Pengajuan role disetujui: ${userLabel} -> ${getRoleLabel(requestedRole)} (workspace ujicoba).`
        : (requestedRole === "role2" || requestedRole === "role3") &&
            requestedProjectIds.length > 0 &&
            testWorkspaceId
          ? `Pengajuan role disetujui: ${userLabel} -> ${getRoleLabel(requestedRole)} (termasuk workspace ujicoba untuk trial).`
        : `Pengajuan role disetujui: ${userLabel} -> ${getRoleLabel(requestedRole)}.`;
    await runAction(async () => {
      if (requestedRole === "role2") {
        await applyRole2ScopedUserRole(user.id, requestedRole2Or3ScopeWithTrial);
      } else if (requestedRole === "role3") {
        await applyRole3ScopedUserRole(user.id, requestedRole2Or3ScopeWithTrial);
      } else if (requestedRole === "role1") {
        await applyRole1ScopedUserRole(user.id, targetRole1ProjectId);
      } else {
        await applyGlobalUserRole(user.id, requestedRole);
      }
      await reloadAll(session);
    }, successMessage);
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
    }, "Indikator berhasil dihapus.");
  }

  async function handleDecideRole2Proposal(proposalId: string, status: "APPROVED" | "REJECTED") {
    await runAction(async () => {
      await decideRole2BimUseProposal(session, proposalId, {
        status,
        decision_note: status === "APPROVED"
          ? "Disetujui admin (proposal-only)."
          : "Ditolak admin.",
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
    <main className="task-shell admin-control-panel">
      <header className="task-header">
        <p className="task-kicker">BIM Scoring Platform</p>
        <h1>Panel Kontrol Admin</h1>
        <p className="task-subtitle">
          Workspace untuk admin: kelola project, perspektif, indikator, dan kunci konfigurasi.
        </p>
      </header>

      {error && <p className="error-box">{error}</p>}
      {notice && <p className="task-note action-feedback">{notice}</p>}

      <section className="task-panel">
        <h2>Sesi Admin</h2>
        <p className="inline-note">
          Sesi aktif: <strong>{toNonEmptyString(session.actorId) || "admin-web"}</strong> | Header role:{" "}
          <strong>{toNonEmptyString(session.role) || "Admin"}</strong>
        </p>
      </section>

      <section className="task-panel">
        <h2>Manajemen Role Pengguna</h2>
        <div className="admin-table-wrap">
          <table className="audit-table responsive-stack-table admin-user-table">
            <caption className="sr-only">Daftar user dan manajemen role</caption>
            <thead>
              <tr>
                <th scope="col">Nama</th>
                <th scope="col">Nomor Pegawai</th>
                <th scope="col">Email</th>
                <th scope="col">Pengajuan Role</th>
                <th scope="col">Pengajuan Scope Project</th>
                <th scope="col">Role Aktif</th>
                <th scope="col">Atur Role</th>
                <th scope="col">Setujui Pengajuan</th>
                <th scope="col">Aksi Manual</th>
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
                const isRole1WorkspaceSwitchToTest = requestedRole === "role1" && currentRole === "role1";
                const testWorkspaceId = toNonEmptyString(testWorkspaceProject?.id || "");
                const requestedRole2Or3ScopeWithTrial =
                  (requestedRole === "role2" || requestedRole === "role3") &&
                    requestedProjectIds.length > 0 &&
                    testWorkspaceId
                    ? [...new Set([...requestedProjectIds, testWorkspaceId])]
                    : requestedProjectIds;
                const requestedScopeLabel =
                  requestedRole === "role1"
                    ? isRole1WorkspaceSwitchToTest
                      ? testWorkspaceProject
                        ? `${testWorkspaceProject.name || TEST_WORKSPACE_NAME} (ujicoba)`
                        : "Workspace ujicoba belum tersedia"
                      : requestedProjectIds.length > 0
                        ? requestedProjectIds.map((id) => projectNameById.get(id) || id).join(", ")
                        : "-"
                    : requestedRole2Or3ScopeWithTrial.length > 0
                    ? requestedRole2Or3ScopeWithTrial.map((id) => projectNameById.get(id) || id).join(", ")
                    : "-";
                const activeRole2Scopes = roleMappings
                  .filter(
                    (mapping) =>
                      mapping.user_id === item.id &&
                      mapping.is_active !== false &&
                      String(mapping.role || "").trim().toLowerCase() === "role2"
                  )
                  .map((mapping) => toNonEmptyString(mapping.project_id || ""))
                  .filter(Boolean) as string[];
                const activeRole3Scopes = roleMappings
                  .filter(
                    (mapping) =>
                      mapping.user_id === item.id &&
                      mapping.is_active !== false &&
                      String(mapping.role || "").trim().toLowerCase() === "role3"
                  )
                  .map((mapping) => toNonEmptyString(mapping.project_id || ""))
                  .filter(Boolean) as string[];
                const activeRole1Scopes = roleMappings
                  .filter(
                    (mapping) =>
                      mapping.user_id === item.id &&
                      mapping.is_active !== false &&
                      String(mapping.role || "").trim().toLowerCase() === "role1"
                  )
                  .map((mapping) => toNonEmptyString(mapping.project_id || ""))
                  .filter(Boolean) as string[];
                const normalizedRole1Scopes = [...new Set(activeRole1Scopes)];
                const normalizedRole2Scopes = [...new Set(activeRole2Scopes)];
                const normalizedRole3Scopes = [...new Set(activeRole3Scopes)];
                const isRequestAlreadyApplied = (() => {
                  if (!requestedRole) return false;
                  if (requestedRole === "role1") {
                    if (currentRole !== "role1") return false;
                    const expectedRole1Scope = isRole1WorkspaceSwitchToTest
                      ? testWorkspaceId
                      : requestedProjectIds[0] || null;
                    if (!expectedRole1Scope) return normalizedRole1Scopes.length === 0;
                    return normalizedRole1Scopes.length === 1 && normalizedRole1Scopes[0] === expectedRole1Scope;
                  }
                  if (requestedRole === "role2") {
                    if (currentRole !== "role2") return false;
                    if (requestedRole2Or3ScopeWithTrial.length === 0) return true;
                    return requestedRole2Or3ScopeWithTrial.every((projectId) => normalizedRole2Scopes.includes(projectId));
                  }
                  if (requestedRole === "role3") {
                    if (currentRole !== "role3") return false;
                    if (requestedRole2Or3ScopeWithTrial.length === 0) return true;
                    return requestedRole2Or3ScopeWithTrial.every((projectId) => normalizedRole3Scopes.includes(projectId));
                  }
                  return requestedRole === currentRole;
                })();
                const cannotApproveRole1WithoutTestWorkspace =
                  requestedRole === "role1" && isRole1WorkspaceSwitchToTest && !testWorkspaceProject;
                const requestSubmittedAt = formatDateTime(item.requested_role_submitted_at);
                return (
                  <tr key={item.id}>
                    <td>{item.name || "-"}</td>
                    <td>{item.employee_number || "-"}</td>
                    <td>{item.email || "-"}</td>
                    <td>
                      {requestedRole ? (
                        <>
                          <strong>{getRoleLabel(requestedRole)}</strong>
                          <br />
                          <small>
                            Diajukan: {requestSubmittedAt} | Status: {isRequestAlreadyApplied ? "Disetujui" : "Menunggu"}
                          </small>
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{requestedScopeLabel}</td>
                    <td>{getRoleLabel(currentRole)}</td>
                    <td>
                      <select
                        aria-label={`Set role untuk ${item.name || item.email || item.id}`}
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
                        disabled={working || !requestedRole || isRequestAlreadyApplied || cannotApproveRole1WithoutTestWorkspace}
                        onClick={() => void handleApproveRequestedRole(item)}
                      >
                        {isRequestAlreadyApplied
                          ? "Sudah Disetujui"
                          : cannotApproveRole1WithoutTestWorkspace
                            ? "Butuh Workspace Ujicoba"
                            : "Setujui Sesuai Pengajuan"}
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
        <h2>Workspace Ujicoba & Cleanup</h2>
        <p className="task-subtitle">
          Gunakan workspace ujicoba untuk data non-produksi. Cleanup menghapus data uji coba agar tidak ikut perhitungan.
        </p>
        <p className="inline-note">
          Untuk keamanan, cleanup wajib memakai minimal 1 filter: user, workspace, atau period.
        </p>
        <div className="wizard-actions">
          <button type="button" className="action-primary" disabled={working} onClick={() => void handleEnsureTestWorkspace()}>
            Buat Workspace Ujicoba
          </button>
          {testWorkspaceProject ? (
            <span className="inline-note">
              Workspace ujicoba aktif: <strong>{testWorkspaceProject.name || TEST_WORKSPACE_NAME}</strong>
            </span>
          ) : (
            <span className="inline-note">Workspace ujicoba belum dibuat.</span>
          )}
        </div>

        <div className="field-grid">
          <label>
            Filter User (opsional)
            <select value={cleanupUserFilter} onChange={(event) => setCleanupUserFilter(event.target.value)}>
              <option value="">Semua user (sesuai filter lain)</option>
              {sortedUsers.map((item) => (
                <option key={`cleanup-user-${item.id}`} value={item.id}>
                  {item.name || item.email || item.employee_number || item.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Filter Workspace (opsional)
            <select value={cleanupProjectFilter} onChange={(event) => setCleanupProjectFilter(event.target.value)}>
              <option value="">Semua workspace (sesuai filter lain)</option>
              {projects.map((item) => (
                <option key={`cleanup-project-${item.id}`} value={item.id}>
                  {item.name || item.code || item.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Filter Period ID (opsional)
            <input
              value={cleanupPeriodFilter}
              onChange={(event) => setCleanupPeriodFilter(event.target.value)}
              placeholder="UUID period (opsional)"
            />
          </label>
        </div>

        <div className="wizard-actions">
          <label>
            <input
              type="checkbox"
              checked={cleanupIncludeEvidence}
              onChange={(event) => setCleanupIncludeEvidence(event.target.checked)}
            />
            {" "}
            Hapus evidence + links + audit
          </label>
          <label>
            <input
              type="checkbox"
              checked={cleanupIncludeRole2Proposals}
              onChange={(event) => setCleanupIncludeRole2Proposals(event.target.checked)}
            />
            {" "}
            Hapus proposal Role 2
          </label>
          <label>
            <input
              type="checkbox"
              checked={cleanupIncludeSnapshots}
              onChange={(event) => setCleanupIncludeSnapshots(event.target.checked)}
              disabled={!cleanupIncludeEvidence}
            />
            {" "}
            Hapus summary snapshot period terkait
          </label>
          <label>
            <input
              type="checkbox"
              checked={cleanupIncludeStorage}
              onChange={(event) => setCleanupIncludeStorage(event.target.checked)}
              disabled={!cleanupIncludeEvidence}
            />
            {" "}
            Hapus file storage evidence
          </label>
        </div>

        <div className="wizard-actions">
          <button type="button" disabled={working} onClick={() => void handleRunTestDataCleanup(true)}>
            Simulasi Cleanup (Dry Run)
          </button>
          <button
            type="button"
            className="action-primary"
            disabled={working}
            onClick={() =>
              requestConfirm({
                title: "Eksekusi cleanup data ujicoba?",
                message: "Data test yang cocok dengan filter akan dihapus permanen dari database.",
                confirmLabel: "Eksekusi Cleanup",
                tone: "danger",
                onConfirm: () => handleRunTestDataCleanup(false),
              })
            }
          >
            Eksekusi Cleanup
          </button>
        </div>

        {cleanupResult ? (
          <div className="admin-lock-bar">
            <p>
              Mode: <strong>{cleanupResult.dry_run ? "Dry Run" : "Eksekusi"}</strong>
            </p>
            <p>
              Filter: user={cleanupResult.filters.user_id || "-"} | workspace={cleanupResult.filters.project_id || "-"} | period={cleanupResult.filters.period_id || "-"}
            </p>
            <p>
              Matched: evidence={cleanupResult.matched.evidence}, proposal role2={cleanupResult.matched.role2_proposals}, period terkait={cleanupResult.matched.periods_from_evidence}, file storage={cleanupResult.matched.storage_objects}
            </p>
            <p>
              Deleted: links={cleanupResult.deleted.evidence_links}, evidence={cleanupResult.deleted.evidence}, audit={cleanupResult.deleted.evidence_audit}, proposal role2={cleanupResult.deleted.role2_proposals}, snapshots={cleanupResult.deleted.summary_snapshots}, storage={cleanupResult.deleted.storage_objects}
            </p>
            {cleanupResult.warnings.length > 0 ? (
              <p className="inline-note">Warning: {cleanupResult.warnings.join(" | ")}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="task-panel">
        <h2>Antrian Proposal BIM Use Role 2</h2>
        <p className="task-subtitle">
          Alur proposal-only. Role 2 mengajukan perubahan BIM Use / pemetaan indikator, keputusan akhir tetap di Admin.
        </p>
        <p className="inline-note">
          Setujui/Tolak di sini tidak otomatis mengubah master perspektif/indikator. Perubahan master tetap dikendalikan admin.
        </p>
        <div className="admin-table-wrap">
          <table className="audit-table responsive-stack-table admin-role2-proposal-table">
            <caption className="sr-only">Antrian proposal BIM Use Role 2</caption>
            <thead>
              <tr>
                <th scope="col">Pemohon</th>
                <th scope="col">Project</th>
                <th scope="col">Tipe</th>
                <th scope="col">Usulan BIM Use</th>
                <th scope="col">ID Indikator</th>
                <th scope="col">Alasan</th>
                <th scope="col">Status</th>
                <th scope="col">Aksi</th>
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
                      <td>{(item.project_id && projectNameById.get(item.project_id)) || item.project_id || "-"}</td>
                      <td>{item.proposal_type || "-"}</td>
                      <td>{item.proposed_bim_use || "-"}</td>
                      <td>{indicatorList.length ? indicatorList.join(", ") : "-"}</td>
                      <td>{item.reason || "-"}</td>
                      <td>
                        <strong>{item.status || "-"}</strong>
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
                            Setujui
                          </button>
                          <button
                            type="button"
                            disabled={working || item.status !== "PENDING"}
                            onClick={() => void handleDecideRole2Proposal(item.id, "REJECTED")}
                          >
                            Tolak
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
        <h2>Kunci Konfigurasi</h2>
        {loading ? (
          <p>Memuat status kunci...</p>
        ) : (
          <div className="admin-lock-bar">
            <p>
              Status:{" "}
              <span className={`status-chip ${configLock?.is_locked ? "status-lock" : "status-open"}`}>
                {configLock?.is_locked ? "TERKUNCI" : "TERBUKA"}
              </span>
            </p>
            <p>Alasan: {configLock?.reason || "-"}</p>
            <p>
              Diperbarui oleh: {configLock?.updated_by || "-"} | Diperbarui pada:{" "}
              {configLock?.updated_at || "-"}
            </p>
            <label>
              Alasan pembaruan kunci
              <input
                value={lockReason}
                onChange={(event) => setLockReason(event.target.value)}
                placeholder="Contoh: freeze sebelum audit."
              />
            </label>
            <div className="wizard-actions">
              <button
                type="button"
                className="action-primary"
                disabled={working}
                onClick={() => void handleToggleLock(true)}
              >
                Kunci Konfigurasi
              </button>
              <button type="button" disabled={working} onClick={() => void handleToggleLock(false)}>
                Buka Kunci
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="task-panel">
        <h2>Workspace Project (CRUD Admin)</h2>
        <p className="task-subtitle">Daftar workspace eksisting ditampilkan lebih dulu sebelum aksi CRUD.</p>
        <p className="inline-note">
          Untuk keamanan, aksi hapus workspace dinonaktifkan. Gunakan Nonaktifkan untuk menonaktifkan workspace tanpa menghapus data.
        </p>
        <p className="inline-note">
          Catatan: queue Role 2 hanya menampilkan evidence berstatus <strong>SUBMITTED</strong> pada period aktif dan workspace yang masuk scope role2.
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
          <table className="audit-table responsive-stack-table admin-project-table">
            <caption className="sr-only">Daftar workspace project</caption>
            <thead>
              <tr>
                <th scope="col">Nama Workspace</th>
                <th scope="col">Status</th>
                <th scope="col">Dibuat</th>
                <th scope="col">Diperbarui</th>
                <th scope="col">Aksi</th>
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
                        requestConfirm({
                          title: nextActive ? "Aktifkan workspace?" : "Nonaktifkan workspace?",
                          message: nextActive
                            ? `Workspace "${label}" akan kembali tersedia untuk alur aktif.`
                            : `Workspace "${label}" tidak dihapus, hanya disembunyikan dari alur aktif.`,
                          confirmLabel: nextActive ? "Aktifkan" : "Nonaktifkan",
                          tone: nextActive ? "default" : "danger",
                          onConfirm: () => handleSetProjectActive(item.id, nextActive),
                        });
                      }}
                    >
                      {item.is_active === false ? "Aktifkan" : "Nonaktifkan"}
                    </button>
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => handleOpenProjectSettingEditor(item)}
                    >
                      Edit Setting
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editingProjectId ? (
          <form className="field-grid" onSubmit={(event) => void handleSaveProjectSetting(event)}>
            <label>
              Nama Workspace
              <input
                value={projectSettingForm.name}
                onChange={(event) =>
                  setProjectSettingForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Nama Workspace"
                required
              />
            </label>
            <label>
              Hari Mulai Periode (Anchor Mingguan)
              <select
                value={projectSettingForm.week_anchor}
                onChange={(event) =>
                  setProjectSettingForm((prev) => ({
                    ...prev,
                    week_anchor: event.target.value as WeekAnchor,
                  }))
                }
              >
                {WEEK_ANCHOR_OPTIONS.map((item) => (
                  <option key={`project-setting-${item.value}`} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kunci Konfigurasi (lanjutan, opsional)
              <input
                value={projectSettingForm.config_key}
                onChange={(event) =>
                  setProjectSettingForm((prev) => ({ ...prev, config_key: event.target.value }))
                }
                placeholder="Contoh: workspace_type=test"
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={projectSettingForm.is_active}
                onChange={(event) =>
                  setProjectSettingForm((prev) => ({ ...prev, is_active: event.target.checked }))
                }
              />
              {" "}
              Workspace aktif
            </label>
            <p className="inline-note">
              Saat disimpan, nilai anchor mingguan otomatis ditulis ke <code>config_key</code>.
            </p>
            <div className="wizard-actions">
              <button type="submit" className="action-primary" disabled={working}>
                Simpan Setting Workspace
              </button>
              <button type="button" disabled={working} onClick={() => handleCloseProjectSettingEditor()}>
                Batal
              </button>
            </div>
          </form>
        ) : null}

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
              Kunci Konfigurasi (opsional)
              <input
                value={projectForm.config_key}
                onChange={(event) => setProjectForm((prev) => ({ ...prev, config_key: event.target.value }))}
                placeholder="Kunci konfigurasi internal"
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
        <h2>Manajemen Periode Skoring</h2>
        <p className="task-subtitle">
          Skema periode mingguan per project diatur di sini. Role input/review/approval menggunakan periode aktif yang tersedia.
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
            Hari Mulai Periode (Anchor Mingguan)
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
            Simpan Anchor Mingguan
          </button>
        </div>
        {selectedPeriodProject && hasActivePeriodProject ? (
          <p className="inline-note">
            Menampilkan periode untuk workspace: <strong>{selectedPeriodProject.name || "Tanpa nama"}</strong>
          </p>
        ) : null}
        {!selectedPeriodProject ? <p className="inline-note">Pilih workspace aktif untuk mengatur anchor periode.</p> : null}
        {selectedPeriodProject && !hasActivePeriodProject ? (
          <p className="inline-note">
            Workspace terpilih berstatus <strong>Nonaktif</strong>. Aktifkan workspace atau pilih workspace lain
            untuk mengatur anchor periode.
          </p>
        ) : null}
        {selectedPeriodProject ? (
          <p className="inline-note">
            Zona waktu periode: <strong>Asia/Jakarta</strong>, mulai jam <strong>00:00</strong>. Sistem akan membuat dan
            mengganti periode otomatis setiap <strong>7 hari</strong> berdasarkan anchor di atas. Periode lama otomatis
            read-only untuk Role 1 (review/approval tetap mengikuti kebijakan gate).
          </p>
        ) : null}
        {selectedPeriodProject ? (
          <p className="inline-note">
            Total periode terdaftar untuk workspace ini: <strong>{periods.length}</strong>
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
          <table className="audit-table responsive-stack-table admin-period-table">
            <caption className="sr-only">Daftar periode skoring per workspace</caption>
            <thead>
              <tr>
                <th scope="col">Periode</th>
                <th scope="col">Rentang</th>
                <th scope="col">Status</th>
                <th scope="col">Versi</th>
                <th scope="col">Diperbarui</th>
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
                  <td colSpan={5}>Memuat periode skoring...</td>
                </tr>
              )}
              {periodProjectFilter && !periodLoading && periods.length === 0 && (
                <tr>
                  <td colSpan={5}>Belum ada periode skoring untuk project ini.</td>
                </tr>
              )}
              {periods.map((item) => (
                <tr key={item.id}>
                  <td>{item.year && item.week ? `${item.year} W${item.week}` : item.id}</td>
                  <td>{item.start_date || "-"} - {item.end_date || "-"}</td>
                  <td>{item.status || "TERBUKA"}</td>
                  <td>{item.version ?? "-"}</td>
                  <td>{formatDateTime(item.updated_at || item.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </section>

      <section className="task-panel">
        <h2>Perspektif (Level Organisasi)</h2>
        <p className="task-subtitle">
          Perspektif bersifat baseline organisasi (tetap) dan tidak dapat diubah dari panel admin.
        </p>
        <p className="inline-note">
          Perubahan perspektif hanya boleh melalui pembaruan blueprint/migrasi terkontrol.
        </p>
        {hiddenLegacyPerspectiveCount > 0 && (
          <p className="inline-note">
            {hiddenLegacyPerspectiveCount} perspektif legacy/nonaktif disembunyikan dari daftar utama.
          </p>
        )}

        <div className="admin-table-wrap">
          <table className="audit-table responsive-stack-table admin-perspective-table">
            <caption className="sr-only">Daftar perspektif organisasi</caption>
            <thead>
              <tr>
                <th scope="col">Perspektif</th>
                <th scope="col">Deskripsi</th>
                <th scope="col">Bobot</th>
                <th scope="col">Status</th>
                <th scope="col">Diperbarui</th>
              </tr>
            </thead>
            <tbody>
              {visiblePerspectiveRows.length === 0 && (
                <tr>
                  <td colSpan={5}>Belum ada perspektif aktif yang valid.</td>
                </tr>
              )}
              {visiblePerspectiveRows.map((item) => (
                <tr key={item.id}>
                  <td>{item.title || "Tanpa judul"}</td>
                  <td>{item.description || "-"}</td>
                  <td>{item.weight ?? "-"}</td>
                  <td>{asBooleanLabel(item.is_active)}</td>
                  <td>{formatDateTime(item.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="task-panel">
        <h2>Indikator</h2>
        <p className="task-subtitle">
          Indikator dikelompokkan per perspektif. Pilih perspektif terlebih dahulu untuk melihat daftar dan menambah indikator baru.
        </p>
        <div className="wizard-actions">
          <button
            type="button"
            className="action-primary"
            disabled={working || !indicatorPerspectiveFilter}
            onClick={() => setShowIndicatorCreateForm((prev) => !prev)}
          >
            {showIndicatorCreateForm ? "Tutup Form Tambah" : "Tambah Indikator"}
          </button>
        </div>

        <div className="wizard-actions admin-filter-row">
          <label>
            Perspektif
            <select
              value={indicatorPerspectiveFilter}
              onChange={(event) => handleChangeIndicatorPerspective(event.target.value)}
            >
              <option value="">Pilih perspektif</option>
              {sortedPerspectiveOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title || item.code || "Perspektif tanpa judul"}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!indicatorPerspectiveFilter && (
          <p className="inline-note">
            Pilih perspektif untuk menampilkan daftar indikator. Ini mencegah daftar terlalu panjang dan scroll berlebihan.
          </p>
        )}
        {selectedIndicatorPerspective && (
          <p className="inline-note">
            Menampilkan indikator untuk: <strong>{selectedIndicatorPerspective.title || "Perspektif tanpa judul"}</strong>
          </p>
        )}

        <div className="admin-table-wrap">
          <table className="audit-table responsive-stack-table admin-indicator-table">
            <caption className="sr-only">Daftar indikator per perspektif</caption>
            <thead>
              <tr>
                <th scope="col">Judul Indikator</th>
                <th scope="col">Deskripsi</th>
                <th scope="col">Status</th>
                <th scope="col">Diperbarui</th>
                <th scope="col">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {!indicatorPerspectiveFilter && (
                <tr>
                  <td colSpan={5}>Pilih perspektif terlebih dahulu.</td>
                </tr>
              )}
              {indicatorPerspectiveFilter && indicatorLoading && (
                <tr>
                  <td colSpan={5}>Memuat indikator...</td>
                </tr>
              )}
              {indicatorPerspectiveFilter && !indicatorLoading && indicators.length === 0 && (
                <tr>
                  <td colSpan={5}>Belum ada indikator pada perspektif ini.</td>
                </tr>
              )}
              {indicators.map((item) => (
                <tr key={item.id}>
                  <td>{item.title || "Tanpa judul"}</td>
                  <td>{item.description || "-"}</td>
                  <td>{asBooleanLabel(item.is_active)}</td>
                  <td>{formatDateTime(item.updated_at)}</td>
                  <td>
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => {
                        requestConfirm({
                          title: "Hapus indikator?",
                          message: `Indikator "${item.title || "tanpa judul"}" akan dihapus permanen.`,
                          confirmLabel: "Hapus",
                          tone: "danger",
                          onConfirm: () => handleDeleteIndicator(item.id),
                        });
                      }}
                    >
                      Hapus
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
              Perspektif Terpilih
              <select
                value={indicatorForm.perspective_id || indicatorPerspectiveFilter}
                onChange={(event) => handleChangeIndicatorPerspective(event.target.value)}
                required
              >
                <option value="">Pilih perspektif</option>
                {sortedPerspectiveOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title || item.code || "Perspektif tanpa judul"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Judul Indikator
                <input
                value={indicatorForm.title}
                onChange={(event) => setIndicatorForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Contoh: Penutupan isu koordinasi model"
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
                Simpan Indikator
              </button>
            </div>
          </form>
        )}
      </section>

      {confirmDialog ? (
        <div className="confirm-modal-overlay" onClick={() => closeConfirm()}>
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            aria-describedby="confirm-modal-desc"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="confirm-modal-title">{confirmDialog.title}</h3>
            <p id="confirm-modal-desc">{confirmDialog.message}</p>
            <div className="wizard-actions">
              <button type="button" disabled={working} onClick={() => closeConfirm()}>
                Batal
              </button>
              <button
                type="button"
                className={confirmDialog.tone === "danger" ? "action-danger" : "action-primary"}
                disabled={working}
                onClick={() => void handleConfirm()}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
