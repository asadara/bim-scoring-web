const webBase = (process.env.WEB_BASE_URL || "https://bim-scoring-web.onrender.com").replace(/\/+$/, "");
const apiBase = (process.env.API_BASE_URL || "https://bim-scoring-api.onrender.com").replace(/\/+$/, "");
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 20_000);

function ok(msg) {
  console.log(`[OK] ${msg}`);
}

function fail(msg) {
  console.error(`[FAIL] ${msg}`);
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout (${requestTimeoutMs}ms) at ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url) {
  const res = await fetchWithTimeout(url);
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
  const res = await fetchWithTimeout(url);
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
        mustContainAny: [
          'data-e2e-marker="bim-scoring-root-shell"',
          'content="bim-scoring-root-shell"',
        ],
      }),
    () =>
      checkPage({
        name: "Legacy route alias",
        path: "/bcl/index.html",
        mustContainAny: [
          'data-e2e-marker="bcl-legacy-shell"',
          'content="bcl-legacy-shell"',
        ],
      }),
    () =>
      checkPage({
        name: "Dashboard JS asset",
        path: "/bcl/js/dashboard.js",
        mustContainAll: ["apiFetch(", "apiUrl("],
      }),
    () =>
      checkPage({
        name: "Projects route",
        path: "/projects",
        mustContainAll: ['"page":"/projects"'],
        mustContainAny: ["Project", "Role 1", "Checking Access", "Memeriksa Akses"],
      }),
    () =>
      checkPage({
        name: "HO review route",
        path: "/ho/review",
        mustContainAll: ['"page":"/ho/review"'],
        mustContainAny: ["Evidence Review - HO", "Review Evidence", "Checking Access", "Memeriksa Akses"],
      }),
    () =>
      checkPage({
        name: "Approve route",
        path: "/approve",
        mustContainAll: ['"page":"/approve"'],
        mustContainAny: ["Period Approval", "Approval", "Checking Access", "Memeriksa Akses"],
      }),
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
