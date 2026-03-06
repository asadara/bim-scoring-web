const webBase = (process.env.WEB_BASE_URL || "https://bcl-scoring.asadara83.workers.dev").replace(/\/+$/, "");
const apiBase = (process.env.API_BASE_URL || "").replace(/\/+$/, "");
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 20_000);
const allowedOrigin = (process.env.ALLOWED_ORIGIN || webBase).replace(/\/+$/, "");
const disallowedOrigin = (process.env.DISALLOWED_ORIGIN || "https://evil.example").replace(/\/+$/, "");
const blockedPath = process.env.BLOCKED_PATH || "/this-path-should-not-be-allowed";

function ok(msg) {
  console.log(`[OK] ${msg}`);
}

function fail(msg) {
  console.error(`[FAIL] ${msg}`);
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout (${requestTimeoutMs}ms) at ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readJsonSafe(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function checkUnknownOriginBlocked() {
  const url = `${apiBase}/ready`;
  const res = await fetchWithTimeout(url, {
    headers: { Origin: disallowedOrigin },
  });
  const body = await readJsonSafe(res);

  if (res.status !== 403) {
    return {
      ok: false,
      message: `Unknown origin should be blocked (expected 403, got ${res.status}) at ${url}`,
    };
  }

  if (!String(body?.error || "").toLowerCase().includes("origin")) {
    return {
      ok: false,
      message: `Unknown origin blocked but error message is unexpected at ${url}`,
    };
  }

  return { ok: true, message: `Unknown origin blocked (403) at ${url}` };
}

async function checkBlockedPath() {
  const url = `${apiBase}${blockedPath.startsWith("/") ? blockedPath : `/${blockedPath}`}`;
  const res = await fetchWithTimeout(url, {
    headers: { Origin: allowedOrigin },
  });
  const body = await readJsonSafe(res);

  if (res.status !== 403) {
    return {
      ok: false,
      message: `Blocked path should return 403 (got ${res.status}) at ${url}`,
    };
  }

  if (!String(body?.error || "").toLowerCase().includes("path")) {
    return {
      ok: false,
      message: `Blocked path returned 403 but error message is unexpected at ${url}`,
    };
  }

  return { ok: true, message: `Blocked path enforcement active (403) at ${url}` };
}

async function checkAllowedOriginPassesReady() {
  const url = `${apiBase}/ready`;
  const res = await fetchWithTimeout(url, {
    headers: { Origin: allowedOrigin },
  });
  const body = await readJsonSafe(res);
  if (res.status !== 200 || body?.ready !== true) {
    return {
      ok: false,
      message: `Allowed origin should pass /ready (expected 200 ready=true, got ${res.status}) at ${url}`,
    };
  }
  return { ok: true, message: `Allowed origin passed /ready (200) at ${url}` };
}

async function main() {
  if (!apiBase) {
    fail("API_BASE_URL is required. Example: API_BASE_URL=https://bcl-api-gateway.example.workers.dev");
    process.exit(1);
  }

  const checks = [checkAllowedOriginPassesReady, checkBlockedPath, checkUnknownOriginBlocked];
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
    fail(`Gateway hardening smoke failed (${failed} check(s) failed).`);
    process.exit(1);
  }

  ok("Gateway hardening smoke passed (all checks OK).");
}

main();
