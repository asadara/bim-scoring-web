export type AppRole = "admin" | "role1" | "role2" | "role3" | "viewer";

export type UserCredential = {
  role: AppRole;
  user_id: string | null;
  updated_at: string;
};

export const USER_CREDENTIAL_STORAGE_KEY = "bim_user_credential_v1";

const ADMIN_SESSION_STORAGE_KEY = "bim_admin_session_v1";

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
      return "Viewer";
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
    const updated_at = typeof parsed.updated_at === "string" && parsed.updated_at.trim()
      ? parsed.updated_at.trim()
      : new Date().toISOString();
    return { role, user_id, updated_at };
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
    return { role: "viewer", user_id: null, updated_at: new Date().toISOString() };
  }

  const direct = parseCredential(window.localStorage.getItem(USER_CREDENTIAL_STORAGE_KEY));
  if (direct) return direct;

  const adminRole = readAdminSessionRole();
  if (adminRole === "admin") {
    const fallback: UserCredential = {
      role: "admin",
      user_id: "admin-web",
      updated_at: new Date().toISOString(),
    };
    window.localStorage.setItem(USER_CREDENTIAL_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }

  const fallback: UserCredential = {
    role: "viewer",
    user_id: null,
    updated_at: new Date().toISOString(),
  };
  window.localStorage.setItem(USER_CREDENTIAL_STORAGE_KEY, JSON.stringify(fallback));
  return fallback;
}

export function setStoredCredential(input: { role: AppRole; user_id?: string | null }): UserCredential {
  const payload: UserCredential = {
    role: normalizeRole(input.role),
    user_id: typeof input.user_id === "string" && input.user_id.trim() ? input.user_id.trim() : null,
    updated_at: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(USER_CREDENTIAL_STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("bim:credential-updated", { detail: payload }));
  }
  return payload;
}
