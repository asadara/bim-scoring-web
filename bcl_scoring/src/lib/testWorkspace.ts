type WorkspaceLike = {
  id?: string | null;
  name?: string | null;
  config_key?: string | null;
};

function normalizeWorkspaceToken(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function hasTestWorkspaceNameHint(value: string | null | undefined): boolean {
  const token = normalizeWorkspaceToken(value);
  if (!token) return false;
  return (
    token.includes("ujicoba") ||
    token.includes("ijocoba") ||
    token.includes("testworkspace") ||
    token.includes("workspacetest")
  );
}

export function hasTestWorkspaceConfigFlag(value: string | null | undefined): boolean {
  const raw = String(value || "");
  if (!raw.trim()) return false;
  return (
    /workspace_type\s*[:=]\s*test\b/i.test(raw) ||
    /\bworkspace\s*[:=]\s*test\b/i.test(raw) ||
    /\bis_test\s*[:=]\s*(true|1)\b/i.test(raw)
  );
}

export function isTestWorkspaceProject(project: WorkspaceLike | null | undefined): boolean {
  if (!project) return false;
  if (hasTestWorkspaceConfigFlag(project.config_key)) return true;
  return hasTestWorkspaceNameHint(project.name);
}

export function resolveTestWorkspaceProject<T extends WorkspaceLike>(items: T[]): T | null {
  const byConfig = items.find((item) => hasTestWorkspaceConfigFlag(item.config_key));
  if (byConfig) return byConfig;
  return items.find((item) => hasTestWorkspaceNameHint(item.name)) || null;
}
