import { createClient, type User } from "@supabase/supabase-js";

import { buildApiUrl, safeFetchJson } from "@/lib/http";
import { AppRole, setStoredCredential } from "@/lib/userCredential";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const DEFAULT_PASSWORD_EMAIL_DOMAIN = (
  process.env.NEXT_PUBLIC_AUTH_PASSWORD_EMAIL_DOMAIN || "pegawai.local"
).trim().toLowerCase();
const OAUTH_REDIRECT_URL = (process.env.NEXT_PUBLIC_SUPABASE_AUTH_REDIRECT_URL || "").trim();
const PENDING_REQUESTED_ROLE_STORAGE_KEY = "bim_pending_requested_role_v1";

let cachedClient: ReturnType<typeof createClient> | null = null;
export type RequestedRole = "role1" | "role2" | "role3" | "viewer";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizeRole(raw: unknown): AppRole {
  if (typeof raw !== "string") return "viewer";
  const value = raw.trim().toLowerCase();
  if (value === "admin") return "admin";
  if (value === "role1") return "role1";
  if (value === "role2") return "role2";
  if (value === "role3") return "role3";
  return "viewer";
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

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const out = value.trim();
  return out ? out : null;
}

function normalizeEmployeeNumber(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function toPasswordEmail(employeeNumber: string): string {
  const normalized = normalizeEmployeeNumber(employeeNumber).replace(/[^A-Z0-9._-]/g, "");
  return `${normalized}@${DEFAULT_PASSWORD_EMAIL_DOMAIN}`;
}

function readUserName(user: User): string | null {
  if (isObject(user.user_metadata)) {
    return (
      normalizeText(user.user_metadata.full_name) ||
      normalizeText(user.user_metadata.name) ||
      normalizeText(user.user_metadata.display_name)
    );
  }
  return null;
}

function readEmployeeNumber(user: User): string | null {
  if (isObject(user.user_metadata)) {
    return normalizeText(user.user_metadata.employee_number) || normalizeText(user.user_metadata.nip);
  }
  return null;
}

function readProvider(user: User): string | null {
  if (isObject(user.app_metadata)) {
    return normalizeText(user.app_metadata.provider);
  }
  return null;
}

function readRequestedRole(user: User): RequestedRole | null {
  if (!isObject(user.user_metadata)) return null;
  return normalizeRequestedRole(user.user_metadata.requested_role);
}

function getWindowLocationOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

function getAuthRedirectUrl(): string {
  if (OAUTH_REDIRECT_URL) return OAUTH_REDIRECT_URL;
  const origin = getWindowLocationOrigin();
  return origin ? `${origin}/auth/sign-in` : "";
}

function setPendingRequestedRole(role: RequestedRole | null): void {
  if (typeof window === "undefined") return;
  if (!role) {
    window.localStorage.removeItem(PENDING_REQUESTED_ROLE_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(PENDING_REQUESTED_ROLE_STORAGE_KEY, role);
}

function getPendingRequestedRole(): RequestedRole | null {
  if (typeof window === "undefined") return null;
  return normalizeRequestedRole(window.localStorage.getItem(PENDING_REQUESTED_ROLE_STORAGE_KEY));
}

async function callAccountRequest(payload: {
  user_id: string;
  email: string | null;
  name: string | null;
  employee_number: string | null;
  provider: string | null;
  requested_role: RequestedRole | null;
}): Promise<void> {
  const result = await safeFetchJson<unknown>(buildApiUrl("/auth/account-request"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!result.ok) {
    throw new Error(result.error || "Failed to submit account request");
  }
}

async function resolveRole(user_id: string): Promise<{ role: AppRole; assigned: boolean }> {
  const result = await safeFetchJson<unknown>(buildApiUrl(`/auth/resolve-role/${encodeURIComponent(user_id)}`));
  if (!result.ok) return { role: "viewer", assigned: false };

  const root = isObject(result.data) ? result.data : {};
  const data = isObject(root.data) ? root.data : {};
  const role = normalizeRole(data.role);
  const assigned = data.assigned === true;
  return { role, assigned };
}

export function isAuthConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseBrowserClient() {
  if (!isAuthConfigured()) {
    throw new Error(
      "Supabase auth belum terkonfigurasi. Set NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  if (cachedClient) return cachedClient;
  cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cachedClient;
}

export async function syncCredentialFromAuth(): Promise<void> {
  if (!isAuthConfigured()) {
    setStoredCredential({ role: "viewer", user_id: null, pending_role: false }, { source: "auth" });
    return;
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setStoredCredential({ role: "viewer", user_id: null, pending_role: false }, { source: "auth" });
    return;
  }

  const user = data.session?.user || null;
  if (!user) {
    setStoredCredential({ role: "viewer", user_id: null, pending_role: false }, { source: "auth" });
    return;
  }

  const provider = readProvider(user);
  const full_name = readUserName(user);
  const employee_number = readEmployeeNumber(user);
  const requested_role = readRequestedRole(user) || getPendingRequestedRole();
  const roleResult = await resolveRole(user.id);

  setStoredCredential(
    {
      role: roleResult.role,
      user_id: user.id,
      full_name,
      employee_number,
      auth_provider: provider,
      pending_role: !roleResult.assigned,
    },
    { source: "auth" }
  );

  try {
    await callAccountRequest({
      user_id: user.id,
      email: normalizeText(user.email),
      name: full_name,
      employee_number,
      provider,
      requested_role,
    });
    if (requested_role) {
      setPendingRequestedRole(null);
    }
  } catch {
    // Best effort only. Auth session stays valid even if account request API is unavailable.
  }
}

export function startAuthCredentialSync(): () => void {
  if (!isAuthConfigured()) {
    return () => {};
  }

  const supabase = getSupabaseBrowserClient();
  const subscription = supabase.auth.onAuthStateChange(() => {
    void syncCredentialFromAuth();
  });

  return () => {
    subscription.data.subscription.unsubscribe();
  };
}

export async function signInWithEmployeePassword(input: {
  employee_number: string;
  password: string;
}): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const email = toPasswordEmail(input.employee_number);
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (error) throw new Error(error.message || "Sign in gagal");
  await syncCredentialFromAuth();
}

export async function signUpWithEmployeePassword(input: {
  name: string;
  employee_number: string;
  password: string;
  requested_role: RequestedRole;
}): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const normalizedEmployeeNumber = normalizeEmployeeNumber(input.employee_number);
  const email = toPasswordEmail(normalizedEmployeeNumber);
  const requestedRole = normalizeRequestedRole(input.requested_role) || "viewer";
  setPendingRequestedRole(requestedRole);
  const { error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        full_name: input.name.trim(),
        employee_number: normalizedEmployeeNumber,
        requested_role: requestedRole,
      },
    },
  });
  if (error) throw new Error(error.message || "Sign up gagal");
  await syncCredentialFromAuth();
}

export async function signInWithGoogleOAuth(input?: { requested_role?: RequestedRole | null }): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const redirectTo = getAuthRedirectUrl();
  const requestedRole = normalizeRequestedRole(input?.requested_role);
  if (requestedRole) {
    setPendingRequestedRole(requestedRole);
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo || undefined,
      scopes: "email profile",
      queryParams: {
        prompt: "select_account",
      },
    },
  });
  if (error) throw new Error(error.message || "Google sign in gagal");
}

export async function signOutAuth(): Promise<void> {
  if (!isAuthConfigured()) {
    setStoredCredential({ role: "viewer", user_id: null, pending_role: false }, { source: "auth" });
    return;
  }
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message || "Sign out gagal");
  await syncCredentialFromAuth();
}

export async function updateAuthProfile(input: {
  name?: string;
  employee_number?: string;
}): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const payload: Record<string, string> = {};
  if (typeof input.name === "string" && input.name.trim()) payload.full_name = input.name.trim();
  if (typeof input.employee_number === "string" && input.employee_number.trim()) {
    payload.employee_number = normalizeEmployeeNumber(input.employee_number);
  }
  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase.auth.updateUser({ data: payload });
  if (error) throw new Error(error.message || "Update profil gagal");
  await syncCredentialFromAuth();
}
