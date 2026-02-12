const webBase = (process.env.WEB_BASE_URL || "https://bim-scoring-web.onrender.com").replace(/\/+$/, "");
const apiBase = (process.env.API_BASE_URL || "https://bim-scoring-api.onrender.com").replace(/\/+$/, "");

function ok(msg) {
  console.log(`[OK] ${msg}`);
}

function fail(msg) {
  console.error(`[FAIL] ${msg}`);
}

async function fetchText(url) {
  const res = await fetch(url);
  const text = await res.text();
  return { res, text };
}

async function checkPage({ name, path, mustContainAny = [], mustContainAll = [] }) {
  const url = `${webBase}${path}`;
  const { res, text } = await fetchText(url);
  if (res.status !== 200) {
    return { ok: false, message: `${name}: status ${res.status} at ${url}` };
  }

  for (const marker of mustContainAll) {
    if (!text.includes(marker)) {
      return { ok: false, message: `${name}: marker "${marker}" not found at ${url}` };
    }
  }

  if (mustContainAny.length > 0) {
    const hit = mustContainAny.some((marker) => text.includes(marker));
    if (!hit) {
      return {
        ok: false,
        message: `${name}: none of markers found (${mustContainAny.join(", ")}) at ${url}`,
      };
    }
  }

  return { ok: true, message: `${name}: 200 ${url}` };
}

async function checkApiHealth(path, expectedFlag = "ok") {
  const url = `${apiBase}${path}`;
  const res = await fetch(url);
  if (res.status !== 200) {
    return { ok: false, message: `API ${path}: status ${res.status} at ${url}` };
  }
  const json = await res.json();
  if (json?.[expectedFlag] !== true) {
    return {
      ok: false,
      message: `API ${path}: payload ${expectedFlag}=false at ${url}`,
    };
  }
  return { ok: true, message: `API ${path}: 200 ${expectedFlag}=true ${url}` };
}

async function main() {
  const checks = [
    () =>
      checkPage({
        name: "Web root",
        path: "/",
        mustContainAny: ["Desktop", "BCL Dashboard"],
      }),
    () =>
      checkPage({
        name: "Legacy route alias",
        path: "/bcl/index.html",
        mustContainAny: ["Desktop", "BCL Dashboard"],
      }),
    () =>
      checkPage({
        name: "Dashboard JS asset",
        path: "/bcl/js/dashboard.js",
        mustContainAll: ["apiFetch(", "apiUrl("],
      }),
    () => checkPage({ name: "Projects route", path: "/projects", mustContainAny: ["Project", "Role 1"] }),
    () => checkPage({ name: "HO review route", path: "/ho/review", mustContainAny: ["Review", "Role 2"] }),
    () => checkPage({ name: "Approve route", path: "/approve", mustContainAny: ["Approve", "Approval"] }),
    () => checkPage({ name: "Audit route", path: "/audit", mustContainAny: ["Audit", "Snapshot"] }),
    () => checkApiHealth("/health", "ok"),
    () => checkApiHealth("/ready", "ready"),
  ];

  let failed = 0;
  for (const run of checks) {
    try {
      const result = await run();
      if (result.ok) ok(result.message);
      else {
        failed += 1;
        fail(result.message);
      }
    } catch (error) {
      failed += 1;
      fail(error instanceof Error ? error.message : String(error));
    }
  }

  if (failed > 0) {
    fail(`Smoke check failed (${failed} check(s) failed).`);
    process.exit(1);
  }

  ok("Smoke check passed (all checks OK).");
}

main();
