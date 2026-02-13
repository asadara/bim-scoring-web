import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { canRoleAccessPath, getMainNavItemsForRole, normalizePath } from "@/lib/accessControl";
import {
  AppRole,
  UserCredential,
  getRoleLabel,
  getStoredCredential,
  setStoredCredential,
} from "@/lib/userCredential";

function isRouteActive(currentPath: string, href: string): boolean {
  const cleanPath = normalizePath(currentPath);
  if (href === "/") return cleanPath === "/";
  return cleanPath === href || cleanPath.startsWith(`${href}/`);
}

const DEFAULT_CREDENTIAL: UserCredential = {
  role: "viewer",
  user_id: null,
  updated_at: "",
};

const ROLE_OPTIONS: Array<{ value: AppRole; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "role1", label: "BIM Coordinator Project" },
  { value: "role2", label: "BIM Coordinator HO" },
  { value: "role3", label: "BIM Manager" },
  { value: "viewer", label: "Viewer / Auditor" },
];

function defaultPathForRole(role: AppRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "role1":
      return "/projects";
    case "role2":
      return "/ho/review";
    case "role3":
      return "/approve";
    case "viewer":
    default:
      return "/audit";
  }
}

export default function MainNav() {
  const router = useRouter();
  const [credential, setCredential] = useState<UserCredential>(DEFAULT_CREDENTIAL);
  const [draftRole, setDraftRole] = useState<AppRole>("viewer");
  const [draftUserId, setDraftUserId] = useState("");

  useEffect(() => {
    const sync = () => {
      setCredential(getStoredCredential());
    };

    sync();

    window.addEventListener("storage", sync);
    window.addEventListener("bim:credential-updated", sync as EventListener);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("bim:credential-updated", sync as EventListener);
    };
  }, []);

  useEffect(() => {
    setDraftRole(credential.role);
    setDraftUserId(credential.user_id || "");
  }, [credential.role, credential.user_id, credential.updated_at]);

  const navItems = useMemo(() => {
    return getMainNavItemsForRole(credential.role);
  }, [credential.role]);

  const currentPath = normalizePath(router.asPath || router.pathname || "/");

  function handleApplySwitch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = setStoredCredential({
      role: draftRole,
      user_id: draftUserId.trim() || null,
    });
    if (!canRoleAccessPath(saved.role, currentPath)) {
      void router.push(defaultPathForRole(saved.role));
    }
  }

  return (
    <div className="main-nav-shell">
      <div className="main-nav-inner">
        <p className="main-nav-caption">
          Access: <strong>{getRoleLabel(credential.role)}</strong>
        </p>

        <nav className="main-nav-list" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = isRouteActive(router.asPath || router.pathname || "/", item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`main-nav-link${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <form className="main-nav-switcher" onSubmit={handleApplySwitch}>
          <label>
            Role Uji Coba
            <select value={draftRole} onChange={(event) => setDraftRole(event.target.value as AppRole)}>
              {ROLE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            User ID (opsional)
            <input
              value={draftUserId}
              onChange={(event) => setDraftUserId(event.target.value)}
              placeholder="mis: u-role1-dev"
            />
          </label>
          <button type="submit">Apply</button>
        </form>
      </div>
    </div>
  );
}
