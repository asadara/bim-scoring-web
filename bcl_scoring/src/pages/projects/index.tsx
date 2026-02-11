import Link from "next/link";
import { useEffect, useState } from "react";

import { NA_TEXT, ProjectRecord, fetchProjects } from "@/lib/role1TaskLayer";

export default function ProjectsIndexPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await fetchProjects();
        if (!mounted) return;
        setProjects(rows);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setProjects([]);
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="task-shell">
      <header className="task-header">
        <p className="task-kicker">BIM Scoring Platform</p>
        <h1>Projects</h1>
        <p className="task-subtitle">Pilih project untuk membuka task layer Role 1.</p>
        <p className="inline-note">
          Mulai dari proyek -&gt; pilih BIM Use -&gt; submit evidence untuk indikator terkait.
        </p>
        <div className="wizard-actions">
          <a href="#project-list" className="primary-cta">
            Pilih Proyek
          </a>
          <Link href="/start">Start Here</Link>
          <Link href="/ho/review">Open HO Review</Link>
          <Link href="/approve">Open Approvals</Link>
          <Link href="/audit">Open Audit</Link>
        </div>
      </header>

      <section className="task-panel" id="project-list">
        {loading && <p>Loading...</p>}
        {error && <p className="error-box">{error}</p>}

        {!loading && !error && projects.length === 0 && (
          <div className="empty-state">
            <p>Not available</p>
            <p>Hubungi admin untuk menambahkan proyek.</p>
          </div>
        )}

        {!loading && !error && projects.length > 0 && (
          <div className="evidence-list">
            {projects.map((project) => (
              <article key={project.id} className="evidence-item">
                <p>
                  <strong>{project.name || project.code || NA_TEXT}</strong>
                </p>
                <p>
                  Code: {project.code || NA_TEXT} | Phase: {project.phase || NA_TEXT}
                </p>
                <div className="item-actions">
                  <Link href={`/projects/${project.id}`} className="revisi">
                    Open Evidence Tasks - Proyek
                  </Link>
                  <Link href={`/projects/${project.id}/indicators`}>Open Indicators</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
