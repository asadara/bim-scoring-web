import { useRouter } from "next/router";
import { useEffect } from "react";

export default function StartRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    void router.replace("/");
  }, [router]);

  return (
    <main className="task-shell">
      <section className="task-panel">
        <h1>Redirecting</h1>
        <p className="task-subtitle">Halaman Start dihapus. Mengarahkan ke Desktop...</p>
      </section>
    </main>
  );
}
