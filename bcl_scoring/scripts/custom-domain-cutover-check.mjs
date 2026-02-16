import dns from "node:dns/promises";
import tls from "node:tls";

const customDomain = (process.env.CUSTOM_DOMAIN || "").trim().toLowerCase();
const apiBase = (process.env.API_BASE_URL || "https://bim-scoring-api.onrender.com").replace(/\/+$/, "");
const minTlsDays = Number(process.env.MIN_TLS_DAYS || 14);
const allowHttp200 = String(process.env.ALLOW_HTTP_200 || "false").toLowerCase() === "true";

if (!customDomain) {
  console.error("[FAIL] CUSTOM_DOMAIN is required. Example: CUSTOM_DOMAIN=app.example.com");
  process.exit(1);
}

const webBase = `https://${customDomain}`;

function ok(message) {
  console.log(`[OK] ${message}`);
}

function warn(message) {
  console.warn(`[WARN] ${message}`);
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
}

async function checkDnsRecords(hostname) {
  let cname = [];
  let lookupRows = [];

  try {
    cname = await dns.resolveCname(hostname);
  } catch {
    cname = [];
  }

  try {
    lookupRows = await dns.lookup(hostname, { all: true });
  } catch {
    lookupRows = [];
  }

  if (cname.length === 0 && lookupRows.length === 0) {
    return { ok: false, message: `DNS not resolved for ${hostname} (lookup failed).` };
  }

  const parts = [];
  if (cname.length > 0) parts.push(`CNAME=${cname.join(", ")}`);
  if (lookupRows.length > 0) {
    const addresses = lookupRows.map((row) => `${row.address}(${row.family === 6 ? "AAAA" : "A"})`);
    parts.push(`LOOKUP=${addresses.join(", ")}`);
  }
  return { ok: true, message: `DNS resolved for ${hostname}: ${parts.join(" | ")}` };
}

function parseTlsDate(raw) {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function sanMatchesHostname(sanRaw, hostname) {
  const hostnameValue = hostname.toLowerCase();
  const entries = String(sanRaw || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  for (const entry of entries) {
    if (!entry.startsWith("dns:")) continue;
    const value = entry.slice(4);
    if (value === hostnameValue) return true;
    if (value.startsWith("*.")) {
      const suffix = value.slice(1);
      if (hostnameValue.endsWith(suffix)) return true;
    }
  }
  return false;
}

async function checkTls(hostname) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: hostname,
        port: 443,
        servername: hostname,
        rejectUnauthorized: true,
      },
      () => {
        const cert = socket.getPeerCertificate();
        if (!cert || !cert.valid_to) {
          socket.end();
          resolve({ ok: false, message: `TLS certificate not available for ${hostname}.` });
          return;
        }

        const validTo = parseTlsDate(cert.valid_to);
        if (!validTo) {
          socket.end();
          resolve({ ok: false, message: `TLS certificate valid_to parsing failed for ${hostname}.` });
          return;
        }

        const millisLeft = validTo.getTime() - Date.now();
        const daysLeft = Math.floor(millisLeft / 86_400_000);
        if (daysLeft < minTlsDays) {
          socket.end();
          resolve({
            ok: false,
            message: `TLS certificate expires too soon (${daysLeft} day(s) left, min=${minTlsDays}).`,
          });
          return;
        }

        const san = String(cert.subjectaltname || "");
        if (!sanMatchesHostname(san, hostname)) {
          warn(`SAN does not explicitly list ${hostname}. SAN=${san || "N/A"}`);
        }

        socket.end();
        resolve({
          ok: true,
          message: `TLS valid for ${hostname}; expires ${validTo.toISOString()} (${daysLeft} day(s) left).`,
        });
      }
    );

    socket.on("error", (error) => {
      resolve({ ok: false, message: `TLS handshake failed for ${hostname}: ${error.message}` });
    });
  });
}

async function checkHttpRedirect(hostname) {
  const url = `http://${hostname}/`;
  const res = await fetch(url, { redirect: "manual" });
  const status = res.status;
  const location = res.headers.get("location");

  if ([301, 302, 307, 308].includes(status) && location && location.startsWith(`https://${hostname}`)) {
    return { ok: true, message: `HTTP->HTTPS redirect valid (${status}) ${url} -> ${location}` };
  }

  if (status === 200 && allowHttp200) {
    return { ok: true, message: `HTTP 200 accepted by ALLOW_HTTP_200=true for ${url}` };
  }

  return {
    ok: false,
    message: `Expected HTTP redirect to https://${hostname}, got status=${status}, location=${location || "N/A"}`,
  };
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
      return { ok: false, message: `${name}: none of markers found (${mustContainAny.join(", ")}) at ${url}` };
    }
  }

  return { ok: true, message: `${name}: 200 ${url}` };
}

async function checkApiHealth(path, expectedFlag) {
  const url = `${apiBase}${path}`;
  const res = await fetch(url);
  if (res.status !== 200) {
    return { ok: false, message: `API ${path}: status ${res.status} at ${url}` };
  }

  const json = await res.json();
  if (json?.[expectedFlag] !== true) {
    return { ok: false, message: `API ${path}: payload ${expectedFlag}=false at ${url}` };
  }

  return { ok: true, message: `API ${path}: 200 ${expectedFlag}=true ${url}` };
}

async function runCheck(run) {
  try {
    const result = await run();
    if (result.ok) ok(result.message);
    else fail(result.message);
    return result.ok ? 0 : 1;
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function main() {
  console.log(`[INFO] Running custom domain cutover checks for ${customDomain}`);
  console.log(`[INFO] Web base: ${webBase}`);
  console.log(`[INFO] API base: ${apiBase}`);

  const checks = [
    () => checkDnsRecords(customDomain),
    () => checkTls(customDomain),
    () => checkHttpRedirect(customDomain),
    () => checkPage({ name: "Web root", path: "/", mustContainAny: ["Desktop", "BCL Dashboard"] }),
    () => checkPage({ name: "Legacy route alias", path: "/bcl/index.html", mustContainAny: ["Desktop", "BCL Dashboard"] }),
    () => checkPage({ name: "Projects route", path: "/projects", mustContainAny: ["Project", "Role 1"] }),
    () => checkPage({ name: "HO review route", path: "/ho/review" }),
    () => checkPage({ name: "Approve route", path: "/approve" }),
    () => checkPage({ name: "Audit route", path: "/audit", mustContainAny: ["Audit", "Snapshot"] }),
    () => checkApiHealth("/health", "ok"),
    () => checkApiHealth("/ready", "ready"),
  ];

  let failed = 0;
  for (const run of checks) {
    failed += await runCheck(run);
  }

  if (failed > 0) {
    fail(`Custom domain cutover check failed (${failed} check(s) failed).`);
    process.exit(1);
  }

  ok("Custom domain cutover check passed (all checks OK).");
}

main();
