import { buildApiUrl } from "@/lib/http";

export type AdminSession = {
  actorId: string;
  role: string;
};

export type AdminProject = {
  id: string;
  code: string | null;
  name: string | null;
  config_key: string | null;
  is_active: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminPerspective = {
  id: string;
  code: string | null;
  title: string | null;
  description: string | null;
  weight: number | null;
  is_active: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminIndicator = {
  id: string;
  perspective_id: string | null;
  bim_use_id: string | null;
  code: string | null;
  title: string | null;
  description: string | null;
  is_active: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminUser = {
  id: string;
  email: string | null;
  name: string | null;
  employee_number: string | null;
  requested_role?: string | null;
  requested_role_submitted_at?: string | null;
  is_active: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminRoleMapping = {
  id: string;
  user_id: string;
  role: string;
  project_id: string | null;
  is_active: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminConfigLock = {
  scope: string;
  is_locked: boolean;
  reason: string | null;
  updated_by: string | null;
  updated_at: string | null;
  created_at?: string | null;
};

export type AdminScoringPeriod = {
  id: string;
  project_id: string;
  year: number | null;
  week: number | null;
  start_date: string | null;
  end_date: string | null;
  status: "OPEN" | "LOCKED" | string;
  version: number | null;
  locked_at?: string | null;
  locked_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminBulkPeriodGenerationResult = {
  scope: "year" | "month";
  project_id: string;
  year: number;
  month: number | null;
  status: "OPEN" | "LOCKED" | string;
  created_count: number;
  skipped_count: number;
  total_candidate_count: number;
  created: AdminScoringPeriod[];
  skipped: Array<{
    year: number;
    week: number;
    start_date: string | null;
    end_date: string | null;
    reason: string;
  }>;
};

type AdminErrorPayload =
  | string
  | {
      code?: string;
      message?: string;
    };

type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: AdminErrorPayload;
};

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const out = value.trim();
  return out ? out : null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "Unknown error");
}

function normalizeAdminSession(session: AdminSession): AdminSession {
  const actorId = toNonEmptyString(session.actorId) || "admin-ui";
  const role = toNonEmptyString(session.role) || "Admin";
  return { actorId, role };
}

function extractApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const root = payload as ApiEnvelope<unknown>;
  const err = root.error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err && typeof err === "object") {
    const text = toNonEmptyString(err.message) || toNonEmptyString(err.code);
    if (text) return text;
  }
  return fallback;
}

function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "data")) {
    return (payload as ApiEnvelope<T>).data as T;
  }
  return payload as T;
}

async function requestAdmin<T>(
  sessionInput: AdminSession,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const session = normalizeAdminSession(sessionInput);
  const headers = new Headers(init.headers);
  headers.set("x-actor-role", session.role);
  headers.set("x-actor-id", session.actorId);
  if (!(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers,
  });

  const raw = await response.text();
  let payload: unknown = null;
  if (raw.trim()) {
    try {
      payload = JSON.parse(raw) as unknown;
    } catch (error) {
      throw new Error(`Invalid JSON from admin API: ${toErrorMessage(error)}`);
    }
  }

  if (!response.ok) {
    const fallback = `${response.status} ${response.statusText}`;
    throw new Error(extractApiErrorMessage(payload, fallback));
  }

  if (payload && typeof payload === "object") {
    const asEnvelope = payload as ApiEnvelope<T>;
    if (asEnvelope.ok === false) {
      throw new Error(extractApiErrorMessage(payload, "Admin API rejected request"));
    }
  }

  return unwrapData<T>(payload);
}

export async function listAdminProjects(session: AdminSession): Promise<AdminProject[]> {
  return await requestAdmin<AdminProject[]>(session, "/admin/projects");
}

export async function createAdminProject(
  session: AdminSession,
  input: { code?: string; name: string; config_key?: string; is_active?: boolean }
): Promise<AdminProject> {
  return await requestAdmin<AdminProject>(session, "/admin/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateAdminProject(
  session: AdminSession,
  projectId: string,
  patch: { code?: string | null; name?: string | null; config_key?: string | null; is_active?: boolean | null }
): Promise<AdminProject> {
  return await requestAdmin<AdminProject>(session, `/admin/projects/${encodeURIComponent(projectId)}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function deleteAdminProject(session: AdminSession, projectId: string): Promise<AdminProject> {
  return await requestAdmin<AdminProject>(session, `/admin/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
  });
}

export async function listAdminPerspectives(session: AdminSession): Promise<AdminPerspective[]> {
  return await requestAdmin<AdminPerspective[]>(session, "/admin/perspectives");
}

export async function listAdminUsers(session: AdminSession): Promise<AdminUser[]> {
  return await requestAdmin<AdminUser[]>(session, "/admin/users");
}

export async function listAdminRoleMappings(session: AdminSession): Promise<AdminRoleMapping[]> {
  return await requestAdmin<AdminRoleMapping[]>(session, "/admin/role-mappings");
}

export async function createAdminRoleMapping(
  session: AdminSession,
  input: { user_id: string; role: string; project_id?: string | null; is_active?: boolean }
): Promise<AdminRoleMapping> {
  return await requestAdmin<AdminRoleMapping>(session, "/admin/role-mappings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateAdminRoleMapping(
  session: AdminSession,
  mappingId: string,
  patch: { user_id?: string; role?: string; project_id?: string | null; is_active?: boolean | null }
): Promise<AdminRoleMapping> {
  return await requestAdmin<AdminRoleMapping>(session, `/admin/role-mappings/${encodeURIComponent(mappingId)}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function createAdminPerspective(
  session: AdminSession,
  input: {
    code: string;
    title: string;
    description?: string;
    weight?: number | null;
    is_active?: boolean;
  }
): Promise<AdminPerspective> {
  return await requestAdmin<AdminPerspective>(session, "/admin/perspectives", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteAdminPerspective(
  session: AdminSession,
  perspectiveId: string
): Promise<AdminPerspective> {
  return await requestAdmin<AdminPerspective>(
    session,
    `/admin/perspectives/${encodeURIComponent(perspectiveId)}`,
    {
      method: "DELETE",
    }
  );
}

export async function listAdminIndicators(
  session: AdminSession,
  filter?: { perspective_id?: string | null }
): Promise<AdminIndicator[]> {
  const perspectiveId = toNonEmptyString(filter?.perspective_id);
  const query = perspectiveId ? `?perspective_id=${encodeURIComponent(perspectiveId)}` : "";
  return await requestAdmin<AdminIndicator[]>(session, `/admin/indicators${query}`);
}

export async function createAdminIndicator(
  session: AdminSession,
  input: {
    perspective_id: string;
    code: string;
    title: string;
    description?: string;
    bim_use_id?: string;
    is_active?: boolean;
  }
): Promise<AdminIndicator> {
  return await requestAdmin<AdminIndicator>(session, "/admin/indicators", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteAdminIndicator(
  session: AdminSession,
  indicatorId: string
): Promise<AdminIndicator> {
  return await requestAdmin<AdminIndicator>(session, `/admin/indicators/${encodeURIComponent(indicatorId)}`, {
    method: "DELETE",
  });
}

export async function getAdminConfigLock(
  session: AdminSession,
  scope = "admin-control"
): Promise<AdminConfigLock> {
  return await requestAdmin<AdminConfigLock>(
    session,
    `/admin/config-lock?scope=${encodeURIComponent(scope)}`
  );
}

export async function setAdminConfigLock(
  session: AdminSession,
  input: { scope?: string; is_locked: boolean; reason?: string | null }
): Promise<AdminConfigLock> {
  const payload = {
    scope: input.scope || "admin-control",
    is_locked: input.is_locked,
    reason: input.reason ?? null,
  };
  return await requestAdmin<AdminConfigLock>(session, "/admin/config-lock", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function listAdminProjectPeriods(
  session: AdminSession,
  projectId: string
): Promise<AdminScoringPeriod[]> {
  return await requestAdmin<AdminScoringPeriod[]>(
    session,
    `/admin/projects/${encodeURIComponent(projectId)}/periods`
  );
}

export async function createAdminProjectPeriod(
  session: AdminSession,
  projectId: string,
  input: {
    year: number;
    week: number;
    start_date?: string | null;
    end_date?: string | null;
    status?: "OPEN" | "LOCKED";
  }
): Promise<AdminScoringPeriod> {
  return await requestAdmin<AdminScoringPeriod>(
    session,
    `/admin/projects/${encodeURIComponent(projectId)}/periods`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function bulkGenerateAdminProjectPeriods(
  session: AdminSession,
  projectId: string,
  input: {
    year: number;
    scope: "year" | "month";
    month?: number | null;
    status?: "OPEN" | "LOCKED";
  }
): Promise<AdminBulkPeriodGenerationResult> {
  return await requestAdmin<AdminBulkPeriodGenerationResult>(
    session,
    `/admin/projects/${encodeURIComponent(projectId)}/periods/bulk-generate`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}
