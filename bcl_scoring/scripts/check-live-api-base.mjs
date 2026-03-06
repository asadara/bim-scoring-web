const webBase = (process.env.WEB_BASE_URL || "https://bcl-scoring.asadara83.workers.dev").replace(/\/+$/, "");
const expectedApiHost = (process.env.EXPECTED_API_HOST || "").trim().toLowerCase();
const disallowHosts = (process.env.DISALLOW_HOSTS || "onrender.com")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 20_000);

function ok(message) {
  console.log(`[OK] ${message}`);
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
}

function info(message) {
  console.log(`[INFO] ${message}`);
}

function hasHostSuffix(hostname, suffix) {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
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

function extractScriptUrls(html) {
  const urls = new Set();
  const scriptRegex = /<script[^>]+src="([^"]+)"/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = (match[1] || "").trim();
    if (!raw) continue;
    try {
      const absolute = new URL(raw, `${webBase}/`).toString();
      urls.add(absolute);
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

async function main() {
  info(`WEB_BASE_URL=${webBase}`);
  if (expectedApiHost) {
    info(`EXPECTED_API_HOST=${expectedApiHost}`);
  }
  info(`DISALLOW_HOSTS=${disallowHosts.join(",")}`);

  const rootRes = await fetchWithTimeout(`${webBase}/`);
  if (!rootRes.ok) {
    fail(`Failed to load root page: HTTP ${rootRes.status}`);
    process.exit(1);
  }
  const rootHtml = await rootRes.text();
  const scriptUrls = extractScriptUrls(rootHtml);
  if (scriptUrls.length === 0) {
    fail("No script URLs found in root HTML.");
    process.exit(1);
  }
  info(`Detected ${scriptUrls.length} script URL(s) from root HTML.`);

  const foundHosts = new Set();
  const hostEvidence = new Map();

  for (const scriptUrl of scriptUrls) {
    try {
      const res = await fetchWithTimeout(scriptUrl);
      if (!res.ok) continue;
      const text = await res.text();
      const hosts = extractHosts(text);
      for (const host of hosts) {
        if (!foundHosts.has(host)) {
          foundHosts.add(host);
          hostEvidence.set(host, scriptUrl);
        }
      }
    } catch {
      // Keep checking other assets.
    }
  }

  if (foundHosts.size === 0) {
    fail("No absolute URL host found in loaded script assets.");
    process.exit(1);
  }

  const matchedDisallow = [...foundHosts].filter((host) =>
    disallowHosts.some((suffix) => hasHostSuffix(host, suffix))
  );
  if (matchedDisallow.length > 0) {
    for (const host of matchedDisallow) {
      const evidence = hostEvidence.get(host) || "(unknown script)";
      fail(`Found disallowed host in live bundle: ${host} (asset: ${evidence})`);
    }
    process.exit(1);
  }

  if (expectedApiHost && ![...foundHosts].includes(expectedApiHost)) {
    fail(`Expected API host not found in bundle: ${expectedApiHost}`);
    process.exit(1);
  }

  ok(`Live bundle host check passed. Hosts found: ${[...foundHosts].sort().join(", ")}`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

