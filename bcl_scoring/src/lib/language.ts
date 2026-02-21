import type { AppRole } from "@/lib/userCredential";

export type AppLanguage = "id" | "en";

export const APP_LANGUAGE_STORAGE_KEY = "bim:language";
export const DEFAULT_APP_LANGUAGE: AppLanguage = "id";

export const APP_LANGUAGES: Array<{ id: AppLanguage; label: string }> = [
  { id: "id", label: "Indonesia" },
  { id: "en", label: "English" },
];

type GlobalText = {
  access: string;
  pendingRole: string;
  user: string;
  theme: string;
  language: string;
  mainNavigationAria: string;
  signOut: string;
  signingOut: string;
  signIn: string;
  signUp: string;
  authNotConfigured: string;
  signOutFailed: string;
  checkingAccessTitle: string;
  checkingAccessSubtitle: string;
  needsSignInTitle: string;
  needsSignInSubtitle: string;
  restrictedAccessTitle: string;
  restrictedAccessNote: string;
  backToDashboard: string;
  restrictedAccessSubtitle: (roleLabel: string) => string;
};

const GLOBAL_TEXT: Record<AppLanguage, GlobalText> = {
  id: {
    access: "Akses",
    pendingRole: "(menunggu role admin)",
    user: "User",
    theme: "Tema",
    language: "Bahasa",
    mainNavigationAria: "Navigasi utama",
    signOut: "Keluar",
    signingOut: "Keluar...",
    signIn: "Masuk",
    signUp: "Daftar",
    authNotConfigured: "Auth belum dikonfigurasi",
    signOutFailed: "Gagal keluar.",
    checkingAccessTitle: "Memeriksa Akses",
    checkingAccessSubtitle: "Memuat credential aktif...",
    needsSignInTitle: "Perlu Masuk",
    needsSignInSubtitle: "Halaman ini hanya untuk pengguna terautentikasi. Silakan masuk terlebih dahulu.",
    restrictedAccessTitle: "Akses Terbatas",
    restrictedAccessNote:
      "Untuk hak akses lain, gunakan credential sesuai role yang berwenang (review/approval/audit bersifat role-based).",
    backToDashboard: "Kembali ke Dashboard",
    restrictedAccessSubtitle: (roleLabel: string) =>
      `Role aktif Anda ${roleLabel} tidak memiliki akses ke halaman ini.`,
  },
  en: {
    access: "Access",
    pendingRole: "(awaiting admin role assignment)",
    user: "User",
    theme: "Theme",
    language: "Language",
    mainNavigationAria: "Main navigation",
    signOut: "Sign Out",
    signingOut: "Signing Out...",
    signIn: "Sign In",
    signUp: "Sign Up",
    authNotConfigured: "Authentication is not configured",
    signOutFailed: "Failed to sign out.",
    checkingAccessTitle: "Checking Access",
    checkingAccessSubtitle: "Loading active credential...",
    needsSignInTitle: "Sign In Required",
    needsSignInSubtitle: "This page is only for authenticated users. Please sign in first.",
    restrictedAccessTitle: "Access Restricted",
    restrictedAccessNote:
      "To access this page, use credentials with the proper role (review/approval/audit are role-based).",
    backToDashboard: "Back to Dashboard",
    restrictedAccessSubtitle: (roleLabel: string) =>
      `Your active role ${roleLabel} does not have access to this page.`,
  },
};

const ROLE_LABELS: Record<AppLanguage, Record<AppRole, string>> = {
  id: {
    admin: "Admin",
    role1: "Koordinator BIM Proyek",
    role2: "Koordinator BIM HO",
    role3: "BIM Manager",
    viewer: "Viewer / Auditor",
  },
  en: {
    admin: "Admin",
    role1: "BIM Project Coordinator",
    role2: "BIM HO Coordinator",
    role3: "BIM Manager",
    viewer: "Viewer / Auditor",
  },
};

const MAIN_NAV_LABELS: Record<AppLanguage, Record<string, string>> = {
  id: {
    "/": "Dashboard",
    "/me": "Akun Saya",
    "/projects": "Koordinator BIM Proyek",
    "/ho/review": "Koordinator BIM HO",
    "/approve": "BIM Manager",
    "/audit": "Audit",
    "/admin": "Admin",
  },
  en: {
    "/": "Dashboard",
    "/me": "My Account",
    "/projects": "BIM Project Coordinator",
    "/ho/review": "BIM HO Coordinator",
    "/approve": "BIM Manager",
    "/audit": "Audit",
    "/admin": "Admin",
  },
};

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return value === "id" || value === "en";
}

export function resolveStoredLanguage(): AppLanguage {
  if (typeof window === "undefined") return DEFAULT_APP_LANGUAGE;
  const raw = window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
  if (isAppLanguage(raw)) return raw;
  return DEFAULT_APP_LANGUAGE;
}

export function applyLanguage(language: AppLanguage): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language;
}

export function persistAndApplyLanguage(language: AppLanguage): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
  }
  applyLanguage(language);
}

export function getGlobalText(language: AppLanguage): GlobalText {
  return GLOBAL_TEXT[language];
}

export function getRoleLabelLocalized(role: AppRole, language: AppLanguage): string {
  return ROLE_LABELS[language][role] || ROLE_LABELS[language].viewer;
}

export function localizeMainNavLabel(href: string, fallbackLabel: string, language: AppLanguage): string {
  return MAIN_NAV_LABELS[language][href] || fallbackLabel;
}
