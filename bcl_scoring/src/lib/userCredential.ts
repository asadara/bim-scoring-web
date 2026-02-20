export type AppRole = "admin" | "role1" | "role2" | "role3" | "viewer";

export type UserCredential = {
  role: AppRole;
  user_id: string | null;
  full_name?: string | null;
  employee_number?: string | null;
  auth_provider?: string | null;
  pending_role?: boolean;
  scoped_project_ids?: string[];
  updated_at: string;
};

export const USER_CREDENTIAL_STORAGE_KEY = "bim_user_credential_v1";

const ADMIN_SESSION_STORAGE_KEY = "bim_admin_session_v1";
const MANUAL_ROLE_SWITCH_ENABLED = String(process.env.NEXT_PUBLIC_AUTH_ALLOW_ROLE_SWITCH || "false")
  .trim()
  .toLowerCase() === "true";

const ROLE_ALIAS_MAP: Record<string, AppRole> = {
  admin: "admin",
  administrator: "admin",
  superadmin: "admin",
  role0: "admin",
  role1: "role1",
  coordinator: "role1",
  "bim coordinator project": "role1",
  "bim koordinator proyek": "role1",
  role2: "role2",
  reviewer: "role2",
  "bim coordinator ho": "role2",
  "bim koordinator ho": "role2",
  "ho reviewer": "role2",
  role3: "role3",
  approver: "role3",
  "bim manager": "role3",
  auditor: "viewer",
  viewer: "viewer",
  read_only: "viewer",
};

export function getRoleLabel(role: AppRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "role1":
      return "BIM Coordinator Project";
    case "role2":
      return "BIM Coordinator HO";
    case "role3":
      return "BIM Manager";
    case "viewer":
    default:
      return "Viewer / Auditor";
  }
}

export function normalizeRole(input: unknown): AppRole {
  if (typeof input !== "string") return "viewer";
  const raw = input.trim().toLowerCase();
  if (!raw) return "viewer";
  return ROLE_ALIAS_MAP[raw] || "viewer";
}

function parseCredential(raw: string | null): UserCredential | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<UserCredential>;
    const role = normalizeRole(parsed.role);
    const user_id = typeof parsed.user_id === "string" && parsed.user_id.trim() ? parsed.user_id.trim() : null;
    const full_name = typeof parsed.full_name === "string" && parsed.full_name.trim()
      ? parsed.full_name.trim()
      : null;
    const employee_number = typeof parsed.employee_number === "string" && parsed.employee_number.trim()
      ? parsed.employee_number.trim()
      : null;
    const auth_provider = typeof parsed.auth_provider === "string" && parsed.auth_provider.trim()
      ? parsed.auth_provider.trim().toLowerCase()
      : null;
    const pending_role = parsed.pending_role === true;
    const scoped_project_ids = Array.isArray(parsed.scoped_project_ids)
      ? [...new Set(parsed.scoped_project_ids.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean))]
      : [];
    const updated_at = typeof parsed.updated_at === "string" && parsed.updated_at.trim()
      ? parsed.updated_at.trim()
      : new Date().toISOString();
    return { role, user_id, full_name, employee_number, auth_provider, pending_role, scoped_project_ids, updated_at };
  } catch {
    return null;
  }
}

function readAdminSessionRole(): AppRole | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { role?: string };
    const role = normalizeRole(parsed.role);
    return role === "admin" ? role : null;
  } catch {
    return null;
  }
}

export function getStoredCredential(): UserCredential {
  if (typeof window === "undefined") {
    return {
      role: "viewer",
      user_id: null,
      full_name: null,
      employee_number: null,
      auth_provider: null,
      pending_role: false,
      scoped_project_ids: [],
      updated_at: new Date().toISOString(),
    };
  }

  const direct = parseCredential(window.localStorage.getItem(USER_CREDENTIAL_STORAGE_KEY));
  if (direct) return direct;

  const adminRole = readAdminSessionRole();
  if (MANUAL_ROLE_SWITCH_ENABLED && adminRole === "admin") {
    const fallback: UserCredential = {
      role: "admin",
      user_id: "admin-web",
      full_name: "Admin Web",
      employee_number: null,
      auth_provider: "manual",
      pending_role: false,
      scoped_project_ids: [],
      updated_at: new Date().toISOString(),
    };
    window.localStorage.setItem(USER_CREDENTIAL_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }

  const fallback: UserCredential = {
    role: "viewer",
    user_id: null,
    full_name: null,
    employee_number: null,
    auth_provider: null,
    pending_role: false,
    updated_at: new Date().toISOString(),
  };
  window.localStorage.setItem(USER_CREDENTIAL_STORAGE_KEY, JSON.stringify(fallback));
  return fallback;
}

export function setStoredCredential(
  input: {
    role: AppRole;
    user_id?: string | null;
    full_name?: string | null;
    employee_number?: string | null;
    auth_provider?: string | null;
    pending_role?: boolean;
    scoped_project_ids?: string[] | null;
  },
  options?: { source?: "manual" | "auth" }
): UserCredential {
  const source = options?.source || "manual";
  if (source === "manual" && !MANUAL_ROLE_SWITCH_ENABLED) {
    return getStoredCredential();
  }

  const payload: UserCredential = {
    role: normalizeRole(input.role),
    user_id: typeof input.user_id === "string" && input.user_id.trim() ? input.user_id.trim() : null,
    full_name: typeof input.full_name === "string" && input.full_name.trim() ? input.full_name.trim() : null,
    employee_number:
      typeof input.employee_number === "string" && input.employee_number.trim()
        ? input.employee_number.trim()
        : null,
    auth_provider:
      typeof input.auth_provider === "string" && input.auth_provider.trim()
        ? input.auth_provider.trim().toLowerCase()
        : null,
    pending_role: input.pending_role === true,
    scoped_project_ids: Array.isArray(input.scoped_project_ids)
      ? [...new Set(input.scoped_project_ids.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean))]
      : [],
    updated_at: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(USER_CREDENTIAL_STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("bim:credential-updated", { detail: payload }));
  }
  return payload;
}
