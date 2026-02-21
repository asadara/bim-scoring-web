import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { getMainNavItemsForRole, normalizePath } from "@/lib/accessControl";
import { isAuthConfigured, signOutAuth } from "@/lib/authClient";
import {
  APP_LANGUAGES,
  DEFAULT_APP_LANGUAGE,
  getGlobalText,
  getRoleLabelLocalized,
  isAppLanguage,
  localizeMainNavLabel,
  persistAndApplyLanguage,
  resolveStoredLanguage,
  type AppLanguage,
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
  const [language, setLanguage] = useState<AppLanguage>(DEFAULT_APP_LANGUAGE);
  const [themeId, setThemeId] = useState<AppThemeId>(DEFAULT_APP_THEME);
  const [busySignOut, setBusySignOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setCredential(getStoredCredential());
      setLanguage(resolveStoredLanguage());
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

  function handleLanguageChange(nextValue: string) {
    if (!isAppLanguage(nextValue)) return;
    setLanguage(nextValue);
    persistAndApplyLanguage(nextValue);
  }

  function handleThemeChange(nextValue: string) {
    if (!isAppThemeId(nextValue)) return;
    setThemeId(nextValue);
    persistAndApplyTheme(nextValue);
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
        </nav>

        <div className="main-nav-switcher">
          <label>
            {text.language}
            <select
              value={language}
              onChange={(event) => handleLanguageChange(event.target.value)}
              aria-label="Language switcher"
            >
              {APP_LANGUAGES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {text.theme}
            <select
              value={themeId}
              onChange={(event) => handleThemeChange(event.target.value)}
              aria-label="Theme switcher"
            >
              {APP_THEMES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="main-nav-auth-actions">
          {isAuthConfigured() ? (
            credential.user_id ? (
              <>
                <button type="button" onClick={() => void handleSignOut()} disabled={busySignOut}>
                  {busySignOut ? text.signingOut : text.signOut}
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/sign-in" className="main-nav-auth-link">
                  {text.signIn}
                </Link>
                <Link href="/auth/sign-up" className="main-nav-auth-link">
                  {text.signUp}
                </Link>
              </>
            )
          ) : (
            <span className="main-nav-auth-note">{text.authNotConfigured}</span>
          )}
        </div>
      </div>
      {error ? <div className="main-nav-auth-error">{error}</div> : null}
    </div>
  );
}
