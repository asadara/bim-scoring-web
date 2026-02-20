import { AppRole } from "@/lib/userCredential";

export type MainNavItem = {
  href: string;
  label: string;
};

const ROUTE_ACCESS_RULES: Array<{ prefix: string; roles: AppRole[] }> = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/me", roles: ["admin", "role1", "role2", "role3", "viewer"] },
  { prefix: "/projects", roles: ["admin", "role1"] },
  { prefix: "/ho/review", roles: ["admin", "role2"] },
  { prefix: "/approve", roles: ["admin", "role3"] },
  { prefix: "/audit", roles: ["admin", "role2", "role3", "viewer"] },
];

export const MAIN_NAV_ITEMS: MainNavItem[] = [
  { href: "/", label: "Desktop" },
  { href: "/me", label: "Akun Saya" },
  { href: "/projects", label: "BIM Coordinator Project" },
  { href: "/ho/review", label: "BIM Coordinator HO" },
  { href: "/approve", label: "BIM Manager" },
  { href: "/audit", label: "Audit" },
  { href: "/admin", label: "Admin" },
];

export function normalizePath(path: string): string {
  return (path || "/").split("#")[0].split("?")[0] || "/";
}

function getMatchedRule(path: string): { prefix: string; roles: AppRole[] } | null {
  const cleanPath = normalizePath(path);
  if (cleanPath === "/" || cleanPath === "/start") return null;

  const sorted = [...ROUTE_ACCESS_RULES].sort((a, b) => b.prefix.length - a.prefix.length);
  return sorted.find((rule) => cleanPath === rule.prefix || cleanPath.startsWith(`${rule.prefix}/`)) || null;
}

export function canRoleAccessPath(role: AppRole, path: string): boolean {
  const rule = getMatchedRule(path);
  if (!rule) return true;
  return rule.roles.includes(role);
}

export function getMainNavItemsForRole(role: AppRole): MainNavItem[] {
  return MAIN_NAV_ITEMS.filter((item) => canRoleAccessPath(role, item.href));
}

export function canWriteRole1Evidence(role: AppRole): boolean {
  return role === "role1";
}

export function canWriteRole2Review(role: AppRole): boolean {
  return role === "role2";
}

export function canWriteRole3Approval(role: AppRole): boolean {
  return role === "role3";
}

export function canWriteAdminControl(role: AppRole): boolean {
  return role === "admin";
}
