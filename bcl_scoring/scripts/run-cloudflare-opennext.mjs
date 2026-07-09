import { spawnSync } from "node:child_process";

const command = process.argv[2];
const allowedCommands = new Set(["preview", "deploy", "upload"]);

if (!allowedCommands.has(command)) {
  console.error("Usage: node scripts/run-cloudflare-opennext.mjs <preview|deploy|upload>");
  process.exit(1);
}

function run(bin, args) {
  const result = spawnSync(bin, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      APP_ENV: process.env.APP_ENV || "production",
      NEXT_PUBLIC_APP_ENV: "production",
      NEXT_PUBLIC_BIM_SCORING_API_BASE_URL_PRODUCTION:
        process.env.NEXT_PUBLIC_BIM_SCORING_API_BASE_URL_PRODUCTION ||
        "https://bcl-api-gateway.asadara83.workers.dev",
      NEXT_PUBLIC_API_BASE_URL_PRODUCTION:
        process.env.NEXT_PUBLIC_API_BASE_URL_PRODUCTION ||
        "https://bcl-api-gateway.asadara83.workers.dev",
      NEXT_PUBLIC_FEATURE_REAL_BACKEND_WRITE: "true",
      NEXT_PUBLIC_ALLOW_PROTOTYPE_FALLBACK: "false",
      NEXT_PUBLIC_SUPABASE_AUTH_REDIRECT_URL:
        process.env.NEXT_PUBLIC_SUPABASE_AUTH_REDIRECT_URL ||
        "https://bcl-scoring.asadara83.workers.dev/auth/sign-in",
    },
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run("node", ["scripts/patch-opennext-windows.mjs"]);
run("npx", ["opennextjs-cloudflare", "build"]);
run("npx", ["opennextjs-cloudflare", command]);
