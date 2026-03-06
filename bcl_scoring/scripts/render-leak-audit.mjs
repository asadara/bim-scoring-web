const webBase = (process.env.WEB_BASE_URL || "https://bcl-scoring.asadara83.workers.dev").replace(/\/+$/, "");
const apiBase = (process.env.API_BASE_URL || "https://bcl-api-gateway.asadara83.workers.dev").replace(/\/+$/, "");
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 20_000);
const disallowHostSuffixes = (process.env.DISALLOW_HOSTS || "onrender.com")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);
const auditApiPaths = (process.env.AUDIT_API_PATHS || [
  "/health",
  "/ready",
  "/version",
  "/auth/resolve-role/test-user-123",
  "/auth/password-email/EMP-DOES-NOT-EXIST",
  "/projects?limit=1",
  "/projects/queue-summary",
].join(","))
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

function info(message) {
  console.log(`[INFO] ${message}`);
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
}

function hasHostSuffix(hostname, suffix) {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

function formatHeaderValue(value) {
  if (!value) return "-";
  return String(value);
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

function extractScriptUrls(html) {
  const urls = new Set();
  const scriptRegex = /<script[^>]+src="([^"]+)"/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = (match[1] || "").trim();
    if (!raw) continue;
    try {
      urls.add(new URL(raw, `${webBase}/`).toString());
    } catch {
      // Ignore malformed URL.
    }
  }
  return [...urls];
}

function extractHosts(text) {
  const hosts = new Set();
  const urlRegex = /https?:\/\/([a-z0-9.-]+)/gi;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const host = String(match[1] || "").trim().toLowerCase();
    if (host) hosts.add(host);
  }
  return [...hosts];
}

async function auditLiveBundleHosts() {
  const result = {
    allHosts: [],
    blockedHosts: [],
    hostEvidence: new Map(),
  };

  const rootRes = await fetchWithTimeout(`${webBase}/`);
  if (!rootRes.ok) {
    throw new Error(`Failed to load root page: HTTP ${rootRes.status}`);
  }

  const rootHtml = await rootRes.text();
  const scriptUrls = extractScriptUrls(rootHtml);
  if (scriptUrls.length === 0) {
    throw new Error("No script URLs found in root HTML");
  }

  const foundHosts = new Set();
  for (const scriptUrl of scriptUrls) {
    try {
      const res = await fetchWithTimeout(scriptUrl);
      if (!res.ok) continue;
      const text = await res.text();
      const hosts = extractHosts(text);
      for (const host of hosts) {
        foundHosts.add(host);
        if (!result.hostEvidence.has(host)) {
          result.hostEvidence.set(host, scriptUrl);
        }
      }
    } catch {
      // Continue on asset fetch failures.
    }
  }

  result.allHosts = [...foundHosts].sort();
  result.blockedHosts = result.allHosts.filter((host) =>
    disallowHostSuffixes.some((suffix) => hasHostSuffix(host, suffix))
  );
  return result;
}

function checkApiLeakHeaders(headers) {
  const xRenderOriginServer = headers.get("x-render-origin-server");
  const xBclUpstream = headers.get("x-bcl-upstream");

  if (xRenderOriginServer) {
    return {
      leaked: true,
      reason: `x-render-origin-server=${xRenderOriginServer}`,
    };
  }

  if (xBclUpstream) {
    const host = String(xBclUpstream).trim().toLowerCase();
    if (disallowHostSuffixes.some((suffix) => hasHostSuffix(host, suffix))) {
      return {
        leaked: true,
        reason: `x-bcl-upstream=${host}`,
      };
    }
  }

  return { leaked: false, reason: "" };
}

async function auditApiRoutes() {
  const rows = [];
  for (const path of auditApiPaths) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${apiBase}${normalizedPath}`;
    try {
      const res = await fetchWithTimeout(url, {
        method: "GET",
        headers: {
          Origin: webBase,
          Accept: "application/json",
        },
      });
      const leak = checkApiLeakHeaders(res.headers);
      rows.push({
        path: normalizedPath,
        status: res.status,
        leaked: leak.leaked,
        reason: leak.reason || "-",
        edgeRoute: formatHeaderValue(res.headers.get("x-bcl-edge-route")),
        authSource: formatHeaderValue(res.headers.get("x-bcl-auth-source")),
        upstream: formatHeaderValue(res.headers.get("x-bcl-upstream")),
      });
    } catch (error) {
      rows.push({
        path: normalizedPath,
        status: "ERR",
        leaked: true,
        reason: error instanceof Error ? error.message : String(error),
        edgeRoute: "-",
        authSource: "-",
        upstream: "-",
      });
    }
  }
  return rows;
}

function printApiRows(rows) {
  console.log("\n[INFO] API route leak check");
  for (const row of rows) {
    const marker = row.leaked ? "LEAK" : "OK  ";
    console.log(
      `${marker} ${String(row.status).padEnd(4)} ${row.path} | edge=${row.edgeRoute} auth=${row.authSource} upstream=${row.upstream} | ${row.reason}`
    );
  }
}

async function main() {
  info(`WEB_BASE_URL=${webBase}`);
  info(`API_BASE_URL=${apiBase}`);
  info(`DISALLOW_HOSTS=${disallowHostSuffixes.join(",")}`);
  info(`AUDIT_API_PATHS=${auditApiPaths.join(",")}`);

  const bundleAudit = await auditLiveBundleHosts();
  if (bundleAudit.blockedHosts.length > 0) {
    for (const host of bundleAudit.blockedHosts) {
      const evidence = bundleAudit.hostEvidence.get(host) || "(unknown)";
      fail(`Live bundle contains blocked host: ${host} (asset: ${evidence})`);
    }
  } else {
    ok(`Live bundle host scan clean. Hosts found: ${bundleAudit.allHosts.join(", ")}`);
  }

  const apiRows = await auditApiRoutes();
  printApiRows(apiRows);

  const leakedApiRows = apiRows.filter((row) => row.leaked);
  if (leakedApiRows.length > 0 || bundleAudit.blockedHosts.length > 0) {
    fail(
      `Render leak audit failed: bundleBlocked=${bundleAudit.blockedHosts.length}, apiLeak=${leakedApiRows.length}`
    );
    process.exit(1);
  }

  ok("Render leak audit passed: no blocked host in bundle and no API route leak.");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
