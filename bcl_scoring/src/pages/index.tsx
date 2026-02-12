import Head from "next/head";
import Link from "next/link";
import Script from "next/script";
import { getApiBaseUrlFromEnv } from "@/lib/runtimeEnv";

export default function Home() {
  const apiBaseUrl = getApiBaseUrlFromEnv();

  return (
    <>
      <Head>
        <title>BCL Dashboard</title>
        <link rel="stylesheet" href="/bcl/css/dashboard.css" />
      </Head>

      <Script id="bcl-runtime-config" strategy="beforeInteractive">
        {`window.__BCL_API_BASE_URL__ = ${JSON.stringify(apiBaseUrl)};`}
      </Script>

      <main id="app">
        <header className="task-panel" style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0 }}>Desktop</h1>
          <p style={{ marginTop: 8 }}>
            Dashboard utama BIM Scoring. Akses workflow detail:{" "}
            <Link href="/start">Start</Link> | <Link href="/projects">Role 1</Link> |{" "}
            <Link href="/ho/review">Role 2</Link> | <Link href="/approve">Role 3</Link> |{" "}
            <Link href="/audit">Audit</Link> | <Link href="/admin">Admin</Link>
          </p>
        </header>

        <header id="header"></header>
        <section id="cards" className="grid"></section>
      </main>

      <div id="drawer" className="drawer hidden">
        <div className="drawer-head">
          <strong id="drawer-title">Perspective</strong>
          <button id="drawer-close">x</button>
        </div>
        <div id="drawer-body" className="drawer-body"></div>
      </div>

      <Script src="/bcl/js/dashboard.js" strategy="afterInteractive" type="module" />
    </>
  );
}
