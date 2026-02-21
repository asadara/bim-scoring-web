import { useEffect, useState } from "react";

import type { AppThemeId } from "@/lib/theme";
import type { AppRole } from "@/lib/userCredential";

export type AppLanguage = "id" | "en";

export const DEFAULT_APP_LANGUAGE: AppLanguage = "id";

type GlobalText = {
  access: string;
  pendingRole: string;
  user: string;
  theme: string;
  account: string;
  myAccount: string;
  mainNavigationAria: string;
  themeMenuAria: string;
  accountMenuAria: string;
  activeTheme: string;
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
    account: "Akun",
    myAccount: "Akun Saya",
    mainNavigationAria: "Navigasi utama",
    themeMenuAria: "Menu tema",
    accountMenuAria: "Menu akun",
    activeTheme: "Aktif",
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
    account: "Account",
    myAccount: "My Account",
    mainNavigationAria: "Main navigation",
    themeMenuAria: "Theme menu",
    accountMenuAria: "Account menu",
    activeTheme: "Active",
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

const THEME_LABELS: Record<AppLanguage, Record<AppThemeId, string>> = {
  id: {
    "slate-teal": "Slate + Teal",
    "navy-sand": "Navy + Sand",
    "charcoal-copper": "Charcoal + Copper",
  },
  en: {
    "slate-teal": "Slate + Teal",
    "navy-sand": "Navy + Sand",
    "charcoal-copper": "Charcoal + Copper",
  },
};

type PrimaryActionText = {
  addEvidenceNow: string;
  viewWorkspace: string;
  viewAllWorkspaces: string;
  refreshList: string;
  addEvidenceForBimUse: string;
  viewMyEvidenceList: string;
  openWorkspace: string;
  openAdminControl: string;
  openAuditTrail: string;
  openEvidenceWorkspace: string;
  openInsight: string;
  close: string;
  switchRoleNow: string;
  backToProjects: string;
};

const PRIMARY_ACTION_TEXT: Record<AppLanguage, PrimaryActionText> = {
  id: {
    addEvidenceNow: "Tambah Evidence Sekarang",
    viewWorkspace: "Lihat Workspace",
    viewAllWorkspaces: "Lihat Semua Workspace",
    refreshList: "Refresh List",
    addEvidenceForBimUse: "Tambahkan Evidence untuk BIM Use",
    viewMyEvidenceList: "Lihat My Evidence List",
    openWorkspace: "Buka Workspace",
    openAdminControl: "Buka Admin Control",
    openAuditTrail: "Buka Audit Trail",
    openEvidenceWorkspace: "Buka Evidence Workspace",
    openInsight: "Buka Insight",
    close: "Tutup",
    switchRoleNow: "Ganti Role Sekarang",
    backToProjects: "Kembali ke Projects",
  },
  en: {
    addEvidenceNow: "Add Evidence Now",
    viewWorkspace: "Open Workspace",
    viewAllWorkspaces: "View All Workspaces",
    refreshList: "Refresh List",
    addEvidenceForBimUse: "Add Evidence for BIM Use",
    viewMyEvidenceList: "View My Evidence List",
    openWorkspace: "Open Workspace",
    openAdminControl: "Open Admin Control",
    openAuditTrail: "Open Audit Trail",
    openEvidenceWorkspace: "Open Evidence Workspace",
    openInsight: "Open Insight",
    close: "Close",
    switchRoleNow: "Switch Role Now",
    backToProjects: "Back to Projects",
  },
};

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return value === "id" || value === "en";
}

function normalizeLanguageTag(raw: string | null | undefined): AppLanguage | null {
  const text = String(raw || "").trim().toLowerCase();
  if (!text) return null;
  if (text === "id" || text === "in" || text.startsWith("id-") || text.startsWith("in-")) return "id";
  if (text === "en" || text.startsWith("en-")) return "en";
  return null;
}

export function resolvePreferredLanguage(): AppLanguage {
  if (typeof navigator !== "undefined") {
    const candidates = [
      ...(Array.isArray(navigator.languages) ? navigator.languages : []),
      navigator.language,
    ];
    for (const tag of candidates) {
      const hit = normalizeLanguageTag(tag);
      if (hit) return hit;
    }
  }
  return DEFAULT_APP_LANGUAGE;
}

export function resolveAppliedLanguage(): AppLanguage {
  if (typeof document !== "undefined") {
    const hit = normalizeLanguageTag(document.documentElement.lang);
    if (hit) return hit;
  }
  return resolvePreferredLanguage();
}

export function applyLanguage(language: AppLanguage): void {
  if (typeof document === "undefined") return;
  const current = normalizeLanguageTag(document.documentElement.lang);
  if (current === language) return;
  document.documentElement.lang = language;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bim:language-updated", { detail: language }));
  }
}

export function useAppLanguage(): AppLanguage {
  const [language, setLanguage] = useState<AppLanguage>(DEFAULT_APP_LANGUAGE);

  useEffect(() => {
    const sync = () => setLanguage(resolveAppliedLanguage());
    sync();
    if (typeof window === "undefined") return;
    window.addEventListener("bim:language-updated", sync as EventListener);
    window.addEventListener("languagechange", sync as EventListener);
    return () => {
      window.removeEventListener("bim:language-updated", sync as EventListener);
      window.removeEventListener("languagechange", sync as EventListener);
    };
  }, []);

  return language;
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

export function localizeThemeLabel(themeId: AppThemeId, language: AppLanguage): string {
  return THEME_LABELS[language][themeId] || themeId;
}

export function getPrimaryActionText(language: AppLanguage): PrimaryActionText {
  return PRIMARY_ACTION_TEXT[language];
}
