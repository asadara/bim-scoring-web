import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { getMainNavItemsForRole, normalizePath } from "@/lib/accessControl";
import { isAuthConfigured, signOutAuth } from "@/lib/authClient";
import { UserCredential, getRoleLabel, getStoredCredential } from "@/lib/userCredential";

function isRouteActive(currentPath: string, href: string): boolean {
  const cleanPath = normalizePath(currentPath);
  if (href === "/") return cleanPath === "/";
  return cleanPath === href || cleanPath.startsWith(`${href}/`);
}

const DEFAULT_CREDENTIAL: UserCredential = {
  role: "viewer",
  user_id: null,
  full_name: null,
  employee_number: null,
  auth_provider: null,
  pending_role: false,
  scoped_project_ids: [],
  updated_at: "",
};

export default function MainNav() {
  const router = useRouter();
  const [credential, setCredential] = useState<UserCredential>(DEFAULT_CREDENTIAL);
  const [busySignOut, setBusySignOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const navItems = useMemo(() => getMainNavItemsForRole(credential.role), [credential.role]);
  const currentPath = normalizePath(router.asPath || router.pathname || "/");

  async function handleSignOut() {
    setBusySignOut(true);
    setError(null);
    try {
      await signOutAuth();
      if (currentPath !== "/" && currentPath !== "/audit") {
        await router.push("/auth/sign-in");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal keluar.");
    } finally {
      setBusySignOut(false);
    }
  }

  return (
    <div className="main-nav-shell">
      <div className="main-nav-inner">
        <p className="main-nav-caption">
          Access: <strong>{getRoleLabel(credential.role)}</strong>
          {credential.pending_role ? " (menunggu role admin)" : ""}
          {credential.user_id ? (
            <>
              {" "}
              | User: <strong>{credential.full_name || credential.employee_number || credential.user_id}</strong>
            </>
          ) : null}
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

        <div className="main-nav-auth-actions">
          {isAuthConfigured() ? (
            credential.user_id ? (
              <>
                <button type="button" onClick={() => void handleSignOut()} disabled={busySignOut}>
                  {busySignOut ? "Keluar..." : "Keluar"}
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/sign-in" className="main-nav-auth-link">
                  Masuk
                </Link>
                <Link href="/auth/sign-up" className="main-nav-auth-link">
                  Daftar
                </Link>
              </>
            )
          ) : (
            <span className="main-nav-auth-note">Auth belum dikonfigurasi</span>
          )}
        </div>
      </div>
      {error ? <div className="main-nav-auth-error">{error}</div> : null}
    </div>
  );
}
