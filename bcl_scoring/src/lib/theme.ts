export type AppThemeId = "slate-teal" | "navy-sand" | "charcoal-copper";

export const APP_THEME_STORAGE_KEY = "bim:theme";
export const DEFAULT_APP_THEME: AppThemeId = "slate-teal";

export const APP_THEMES: Array<{ id: AppThemeId; label: string }> = [
  { id: "slate-teal", label: "Slate + Teal" },
  { id: "navy-sand", label: "Navy + Sand" },
  { id: "charcoal-copper", label: "Charcoal + Copper" },
];

export function isAppThemeId(value: string | null | undefined): value is AppThemeId {
  return value === "slate-teal" || value === "navy-sand" || value === "charcoal-copper";
}

export function resolveStoredTheme(): AppThemeId {
  if (typeof window === "undefined") return DEFAULT_APP_THEME;
  const raw = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
  return isAppThemeId(raw) ? raw : DEFAULT_APP_THEME;
}

export function applyTheme(themeId: AppThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", themeId);
}

export function persistAndApplyTheme(themeId: AppThemeId): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, themeId);
  }
  applyTheme(themeId);
}
