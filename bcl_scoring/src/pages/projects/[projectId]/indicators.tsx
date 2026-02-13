import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import BackendStatusBanner from "@/components/BackendStatusBanner";
import Role1Layout from "@/components/Role1Layout";
import { IndicatorRecord, NA_TEXT, fetchRole1Context } from "@/lib/role1TaskLayer";

type PerspectiveGroup = {
  key: string;
  title: string;
  indicators: IndicatorRecord[];
};

function inferPerspectiveGroup(indicator: IndicatorRecord): string {
  const code = String(indicator.code || "").toUpperCase();
  const prefix = code.split("-")[0];
  if (/^P[1-5]$/.test(prefix)) return prefix;
  return indicator.perspective_id || NA_TEXT;
}

function perspectiveOrder(key: string): number {
  const hit = String(key || "").toUpperCase().match(/^P([1-5])$/);
  if (!hit) return 99;
  return Number.parseInt(hit[1], 10);
}

export default function ProjectIndicatorsPage() {
  const router = useRouter();
  const { projectId } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<Awaited<ReturnType<typeof fetchRole1Context>> | null>(null);

  useEffect(() => {
    if (!router.isReady || typeof projectId !== "string") return;

    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const nextContext = await fetchRole1Context(projectId);
        if (!mounted) return;
        setContext(nextContext);
      } catch (e) {
        if (!mounted) return;
        setContext(null);
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router.isReady, projectId]);

  const perspectiveGroups = useMemo(() => {
    if (!context) return [] as PerspectiveGroup[];
    const grouped = new Map<string, IndicatorRecord[]>();
    for (const indicator of context.indicators) {
      const key = inferPerspectiveGroup(indicator);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)?.push(indicator);
    }

    return [...grouped.entries()]
      .map(([key, indicators]) => ({
        key,
        title: key === NA_TEXT ? "Perspective Not Available" : key,
        indicators: [...indicators].sort((a, b) => a.code.localeCompare(b.code)),
      }))
      .sort((a, b) => perspectiveOrder(a.key) - perspectiveOrder(b.key) || a.title.localeCompare(b.title));
  }, [context]);

  if (loading) {
    return (
      <main className="task-shell">
        <section className="task-panel">Loading...</section>
      </main>
    );
  }

  if (!context || typeof projectId !== "string") {
    return (
      <main className="task-shell">
        <section className="task-panel">
          <h1>Daftar Indicators</h1>
          <p className="error-box">{error || "Project context not found."}</p>
          <p>
            <Link href="/projects">Kembali ke Projects</Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <Role1Layout
      projectId={projectId}
      title="Daftar Indicators"
      subtitle="Menampilkan indikator aktif yang terpasang pada project terpilih (project-scoped)."
      project={context.project}
      activePeriod={context.active_period}
      periodStatusLabel={context.period_status_label}
    >
      {error ? <p className="error-box">{error}</p> : null}
      <BackendStatusBanner mode={context.data_mode} message={context.backend_message} />

      <section className="task-panel">
        <h2>Indicator Mapping</h2>
        <p className="inline-note">
          Perspective tetap baseline organisasi (locked). Halaman ini menampilkan indikator yang aktif untuk project
          ini.
        </p>
      </section>

      {perspectiveGroups.length === 0 ? (
        <section className="task-panel empty-state">
          <p>Belum ada indikator aktif pada project ini.</p>
          <p>Silakan lakukan assignment indikator dari Admin Panel agar indikator muncul di halaman ini.</p>
        </section>
      ) : (
        perspectiveGroups.map((group) => (
          <section className="task-panel" key={group.key}>
            <h3>
              {group.title} ({group.indicators.length})
            </h3>
            <div className="admin-table-wrap">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th align="left">Code</th>
                    <th align="left">Indicator</th>
                    <th align="left">BIM Use</th>
                    <th align="left">Deskripsi</th>
                  </tr>
                </thead>
                <tbody>
                  {group.indicators.map((indicator) => (
                    <tr key={indicator.id}>
                      <td>{indicator.code || NA_TEXT}</td>
                      <td>{indicator.title || NA_TEXT}</td>
                      <td>{indicator.bim_use_tags.length ? indicator.bim_use_tags.join(", ") : NA_TEXT}</td>
                      <td>{indicator.description || NA_TEXT}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </Role1Layout>
  );
}
