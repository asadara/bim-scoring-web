import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { getMainNavItemsForRole } from "@/lib/accessControl";
import {
  CurrentAuthAccount,
  RequestedRole,
  getCurrentAuthAccount,
  isAuthConfigured,
  signOutAllAuthSessions,
  signOutAuth,
  syncCredentialFromAuth,
  updateAuthPassword,
  updateAuthProfile,
} from "@/lib/authClient";
import { buildApiUrl, safeFetchJson, toUserFacingSafeFetchError } from "@/lib/http";
import { useCredential } from "@/lib/useCredential";
import { getRoleLabel } from "@/lib/userCredential";

type ProjectOption = {
  id: string;
  code?: string | null;
  name?: string | null;
  is_active?: boolean | null;
};

const REQUESTED_ROLE_LABEL: Record<RequestedRole, string> = {
  role1: "BIM Coordinator Project",
  role2: "BIM Coordinator HO",
  role3: "BIM Manager",
  viewer: "Viewer / Auditor",
};

const EMPTY_ACCOUNT: CurrentAuthAccount = {
  user_id: null,
  email: null,
  full_name: null,
  employee_number: null,
  auth_provider: null,
  requested_role: null,
  requested_project_ids: [],
  created_at: null,
  last_sign_in_at: null,
  updated_at: null,
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const out = value.trim();
  return out ? out : null;
}

function projectLabel(project: ProjectOption): string {
  const code = normalizeText(project.code);
  const name = normalizeText(project.name);
  if (code && name && !name.toLowerCase().startsWith(code.toLowerCase())) {
    return `${code} - ${name}`;
  }
  return name || code || project.id;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

function providerLabel(value?: string | null): string {
  const normalized = normalizeText(value);
  if (!normalized) return "-";
  if (normalized === "google") return "Google OAuth";
  if (normalized === "email") return "Email/Password";
  return normalized;
}

export default function MePage() {
  const router = useRouter();
  const credential = useCredential();
  const [account, setAccount] = useState<CurrentAuthAccount>(EMPTY_ACCOUNT);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [projectLoadError, setProjectLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"profile" | "password" | "signout" | "signout-all" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [profileName, setProfileName] = useState("");
  const [profileEmployeeNumber, setProfileEmployeeNumber] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await syncCredentialFromAuth();
        const snapshot = await getCurrentAuthAccount();
        if (!mounted) return;
        setAccount(snapshot);
        setProfileName(snapshot.full_name || "");
        setProfileEmployeeNumber(snapshot.employee_number || "");
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Gagal memuat data akun.");
      } finally {
        if (mounted) setLoading(false);
      }

      const projectResult = await safeFetchJson<unknown>(buildApiUrl("/projects"));
      if (!mounted) return;
      if (!projectResult.ok) {
        setProjectOptions([]);
        setProjectLoadError(toUserFacingSafeFetchError(projectResult, "Gagal memuat daftar project."));
        return;
      }
      const root =
        projectResult.data && typeof projectResult.data === "object"
          ? (projectResult.data as Record<string, unknown>)
          : {};
      const rows = Array.isArray(root.data) ? (root.data as ProjectOption[]) : [];
      setProjectOptions(rows);
      setProjectLoadError(null);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const isConfigured = isAuthConfigured();
  const isSignedIn = Boolean(credential.user_id);
  const requestedRoleLabel = account.requested_role ? REQUESTED_ROLE_LABEL[account.requested_role] : "-";
  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    projectOptions.forEach((item) => {
      map.set(item.id, projectLabel(item));
    });
    return map;
  }, [projectOptions]);
  const requestedProjectLabels = useMemo(() => {
    return account.requested_project_ids.map((projectId) => projectNameById.get(projectId) || projectId);
  }, [account.requested_project_ids, projectNameById]);
  const accessibleMenus = useMemo(
    () => getMainNavItemsForRole(credential.role).filter((item) => item.href !== "/me"),
    [credential.role]
  );
  const roleStatusText = credential.pending_role ? "Menunggu penetapan admin" : "Role aktif";

  async function reloadAccountSnapshot(): Promise<void> {
    const snapshot = await getCurrentAuthAccount();
    setAccount(snapshot);
    setProfileName(snapshot.full_name || "");
    setProfileEmployeeNumber(snapshot.employee_number || "");
  }

  async function onSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyAction) return;
    setBusyAction("profile");
    setError(null);
    setInfo(null);
    try {
      await updateAuthProfile({
        name: profileName,
        employee_number: profileEmployeeNumber,
      });
      await reloadAccountSnapshot();
      setInfo("Profil akun berhasil diperbarui.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui profil.");
    } finally {
      setBusyAction(null);
    }
  }

  async function onSavePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyAction) return;
    if (newPassword !== confirmNewPassword) {
      setError("Password baru dan konfirmasi password harus sama.");
      return;
    }
    setBusyAction("password");
    setError(null);
    setInfo(null);
    try {
      await updateAuthPassword({ new_password: newPassword });
      setNewPassword("");
      setConfirmNewPassword("");
      setInfo("Password akun berhasil diperbarui.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui password.");
    } finally {
      setBusyAction(null);
    }
  }

  async function onSignOutCurrentSession() {
    if (busyAction) return;
    setBusyAction("signout");
    setError(null);
    setInfo(null);
    try {
      await signOutAuth();
      await router.push("/auth/sign-in");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal keluar dari sesi saat ini.");
      setBusyAction(null);
    }
  }

  async function onSignOutAllSessions() {
    if (busyAction) return;
    setBusyAction("signout-all");
    setError(null);
    setInfo(null);
    try {
      await signOutAllAuthSessions();
      await router.push("/auth/sign-in");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal keluar dari semua sesi.");
      setBusyAction(null);
    }
  }

  return (
    <>
      <Head>
        <title>Akun Saya - BIM Scoring</title>
      </Head>
      <main className="task-shell auth-shell">
        <section className="task-panel">
          <h1>Akun Saya</h1>
          <p className="task-subtitle">
            Halaman ini merangkum profil user, status role, detail pengajuan, akses halaman, dan pengaturan akun.
          </p>
          {!isConfigured ? (
            <p className="error-box">
              Supabase auth belum dikonfigurasi. Set `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
            </p>
          ) : null}
          {!isSignedIn ? (
            <p className="error-box">
              Anda belum login. Silakan <Link href="/auth/sign-in">Masuk</Link> untuk mengakses halaman ini.
            </p>
          ) : null}
          {error ? <p className="error-box">{error}</p> : null}
          {info ? <p className="auth-status">{info}</p> : null}
          {loading ? <p className="inline-note">Memuat ringkasan akun...</p> : null}
        </section>

        <section className="task-panel">
          <h2>1. Identitas Akun</h2>
          <div className="task-context-grid">
            <div className="context-card">
              <span>Nama Lengkap</span>
              <strong>{account.full_name || credential.full_name || "-"}</strong>
            </div>
            <div className="context-card">
              <span>Email</span>
              <strong>{account.email || "-"}</strong>
            </div>
            <div className="context-card">
              <span>Nomor Pegawai</span>
              <strong>{account.employee_number || credential.employee_number || "-"}</strong>
            </div>
            <div className="context-card">
              <span>Provider Login</span>
              <strong>{providerLabel(account.auth_provider || credential.auth_provider)}</strong>
            </div>
            <div className="context-card">
              <span>User ID</span>
              <strong>{account.user_id || credential.user_id || "-"}</strong>
            </div>
          </div>
        </section>

        <section className="task-panel">
          <h2>2. Status Role</h2>
          <div className="task-context-grid">
            <div className="context-card">
              <span>Role Aktif</span>
              <strong>{getRoleLabel(credential.role)}</strong>
            </div>
            <div className="context-card">
              <span>Status Role</span>
              <strong>{roleStatusText}</strong>
            </div>
            <div className="context-card">
              <span>Role Diajukan</span>
              <strong>{requestedRoleLabel}</strong>
            </div>
            <div className="context-card">
              <span>Login Terakhir</span>
              <strong>{formatDateTime(account.last_sign_in_at)}</strong>
            </div>
            <div className="context-card">
              <span>Sinkronisasi Terakhir</span>
              <strong>{formatDateTime(credential.updated_at)}</strong>
            </div>
          </div>
        </section>

        <section className="task-panel">
          <h2>3. Detail Pengajuan Role</h2>
          <div className="task-context-grid">
            <div className="context-card">
              <span>Role Pengajuan</span>
              <strong>{requestedRoleLabel}</strong>
            </div>
            <div className="context-card">
              <span>Estimasi Waktu Pengajuan</span>
              <strong>{formatDateTime(account.created_at)}</strong>
            </div>
            <div className="context-card">
              <span>Scope Project Diajukan</span>
              <strong>{requestedProjectLabels.length > 0 ? requestedProjectLabels.join(", ") : "-"}</strong>
            </div>
          </div>
          {projectLoadError ? <p className="inline-note">{projectLoadError}</p> : null}
        </section>

        <section className="task-panel">
          <h2>4. Akses Saya Saat Ini</h2>
          <p className="task-subtitle">
            Halaman berikut dapat diakses oleh role aktif Anda: <strong>{getRoleLabel(credential.role)}</strong>.
          </p>
          <div className="wizard-actions">
            {accessibleMenus.map((item) => (
              <Link key={item.href} href={item.href} className="action-primary">
                {item.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="task-panel">
          <h2>5. Pengaturan Akun Dasar</h2>
          <div className="auth-stack">
            <form className="auth-stack" onSubmit={onSaveProfile}>
              <h3>Perbarui Profil</h3>
              <label className="auth-field">
                Nama Lengkap
                <input
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="Nama pegawai"
                  disabled={!isSignedIn || Boolean(busyAction)}
                />
              </label>
              <label className="auth-field">
                Nomor Pegawai
                <input
                  value={profileEmployeeNumber}
                  onChange={(event) => setProfileEmployeeNumber(event.target.value)}
                  placeholder="mis. 20240017"
                  disabled={!isSignedIn || Boolean(busyAction)}
                />
              </label>
              <button type="submit" className="primary-cta" disabled={!isSignedIn || Boolean(busyAction)}>
                {busyAction === "profile" ? "Menyimpan profil..." : "Simpan Profil"}
              </button>
            </form>

            <form className="auth-stack" onSubmit={onSavePassword}>
              <h3>Ubah Password</h3>
              <label className="auth-field">
                Password Baru
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Minimal 8 karakter"
                  minLength={8}
                  required
                  disabled={!isSignedIn || Boolean(busyAction)}
                />
              </label>
              <label className="auth-field">
                Konfirmasi Password Baru
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(event) => setConfirmNewPassword(event.target.value)}
                  placeholder="Ulangi password baru"
                  minLength={8}
                  required
                  disabled={!isSignedIn || Boolean(busyAction)}
                />
              </label>
              <button type="submit" className="primary-cta" disabled={!isSignedIn || Boolean(busyAction)}>
                {busyAction === "password" ? "Menyimpan password..." : "Simpan Password Baru"}
              </button>
            </form>

            <div className="auth-stack">
              <h3>Sesi Login</h3>
              <div className="wizard-actions">
                <button type="button" className="action-primary" onClick={() => void onSignOutCurrentSession()} disabled={!isSignedIn || Boolean(busyAction)}>
                  {busyAction === "signout" ? "Keluar..." : "Keluar Sesi Ini"}
                </button>
                <button type="button" onClick={() => void onSignOutAllSessions()} disabled={!isSignedIn || Boolean(busyAction)}>
                  {busyAction === "signout-all" ? "Memproses..." : "Keluar dari Semua Sesi"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="task-panel">
          <h2>6. Bantuan</h2>
          <p className="inline-note">
            Perubahan role, scope project, atau kebutuhan akses tambahan diproses oleh Admin melalui panel Admin.
          </p>
          <p className="inline-note">
            Jika role belum sesuai kebutuhan kerja Anda, ajukan ulang dari form pendaftaran atau hubungi Admin BIM internal.
          </p>
        </section>
      </main>
    </>
  );
}
