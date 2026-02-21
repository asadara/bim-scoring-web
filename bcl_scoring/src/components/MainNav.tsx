import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";

import { getMainNavItemsForRole, normalizePath } from "@/lib/accessControl";
import { isAuthConfigured, signOutAuth } from "@/lib/authClient";
import {
  getGlobalText,
  getRoleLabelLocalized,
  localizeMainNavLabel,
  localizeThemeLabel,
  useAppLanguage,
} from "@/lib/language";
import {
  APP_THEMES,
  DEFAULT_APP_THEME,
  isAppThemeId,
  persistAndApplyTheme,
  resolveStoredTheme,
  type AppThemeId,
} from "@/lib/theme";
import { UserCredential, getStoredCredential } from "@/lib/userCredential";

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
  const language = useAppLanguage();
  const [themeId, setThemeId] = useState<AppThemeId>(DEFAULT_APP_THEME);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [busySignOut, setBusySignOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sync = () => {
      setCredential(getStoredCredential());
      setThemeId(resolveStoredTheme());
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
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const targetNode = event.target as Node | null;
      if (themeMenuRef.current && targetNode && !themeMenuRef.current.contains(targetNode)) {
        setThemeMenuOpen(false);
      }
      if (accountMenuRef.current && targetNode && !accountMenuRef.current.contains(targetNode)) {
        setAccountMenuOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setThemeMenuOpen(false);
      setAccountMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    setThemeMenuOpen(false);
    setAccountMenuOpen(false);
  }, [router.asPath]);

  const navItems = useMemo(
    () =>
      getMainNavItemsForRole(credential.role).filter(
        (item) => item.href !== "/me" || Boolean(credential.user_id)
      ),
    [credential.role, credential.user_id]
  );
  const currentPath = normalizePath(router.asPath || router.pathname || "/");
  const text = useMemo(() => getGlobalText(language), [language]);

  async function handleSignOut() {
    setBusySignOut(true);
    setError(null);
    setAccountMenuOpen(false);
    try {
      await signOutAuth();
      if (currentPath !== "/" && currentPath !== "/audit") {
        await router.push("/auth/sign-in");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : text.signOutFailed);
    } finally {
      setBusySignOut(false);
    }
  }

  function handleThemeChange(nextValue: string) {
    if (!isAppThemeId(nextValue)) return;
    setThemeId(nextValue);
    persistAndApplyTheme(nextValue);
    setThemeMenuOpen(false);
  }

  return (
    <div className="main-nav-shell">
      <div className="main-nav-inner">
        <p className="main-nav-caption">
          {text.access}: <strong>{getRoleLabelLocalized(credential.role, language)}</strong>
          {credential.pending_role ? ` ${text.pendingRole}` : ""}
          {credential.user_id ? (
            <>
              {" "}
              | {text.user}: <strong>{credential.full_name || credential.employee_number || credential.user_id}</strong>
            </>
          ) : null}
        </p>

        <nav className="main-nav-list" aria-label={text.mainNavigationAria}>
          {navItems.map((item) => {
            const active = isRouteActive(router.asPath || router.pathname || "/", item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`main-nav-link${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {localizeMainNavLabel(item.href, item.label, language)}
              </Link>
            );
          })}

          <div className="main-nav-menu-wrap" ref={themeMenuRef}>
            <button
              type="button"
              className="main-nav-menu-button"
              aria-haspopup="menu"
              aria-expanded={themeMenuOpen}
              aria-label={text.themeMenuAria}
              onClick={() => {
                setThemeMenuOpen((prev) => {
                  const next = !prev;
                  if (next) setAccountMenuOpen(false);
                  return next;
                });
              }}
            >
              {text.theme}
            </button>
            {themeMenuOpen ? (
              <div className="main-nav-menu-panel" role="menu" aria-label={text.themeMenuAria}>
                {APP_THEMES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={themeId === item.id}
                    className={`main-nav-menu-item ${themeId === item.id ? "is-active" : ""}`}
                    onClick={() => handleThemeChange(item.id)}
                  >
                    <span>{localizeThemeLabel(item.id, language)}</span>
                    {themeId === item.id ? <small>{text.activeTheme}</small> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="main-nav-menu-wrap" ref={accountMenuRef}>
            <button
              type="button"
              className="main-nav-menu-button"
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              aria-label={text.accountMenuAria}
              onClick={() => {
                setAccountMenuOpen((prev) => {
                  const next = !prev;
                  if (next) setThemeMenuOpen(false);
                  return next;
                });
              }}
            >
              {text.account}
            </button>
            {accountMenuOpen ? (
              <div className="main-nav-menu-panel" role="menu" aria-label={text.accountMenuAria}>
                {isAuthConfigured() ? (
                  credential.user_id ? (
                    <>
                      <Link
                        href="/me"
                        className="main-nav-menu-item"
                        role="menuitem"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        {text.myAccount}
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        className="main-nav-menu-item"
                        onClick={() => void handleSignOut()}
                        disabled={busySignOut}
                      >
                        {busySignOut ? text.signingOut : text.signOut}
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/auth/sign-in"
                        className="main-nav-menu-item"
                        role="menuitem"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        {text.signIn}
                      </Link>
                      <Link
                        href="/auth/sign-up"
                        className="main-nav-menu-item"
                        role="menuitem"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        {text.signUp}
                      </Link>
                    </>
                  )
                ) : (
                  <span className="main-nav-menu-note">{text.authNotConfigured}</span>
                )}
              </div>
            ) : null}
          </div>
        </nav>
      </div>
      {error ? <div className="main-nav-auth-error">{error}</div> : null}
    </div>
  );
}
