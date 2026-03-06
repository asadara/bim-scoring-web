import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LEGACY_RENDER_HOSTS = new Set([
  "bim-scoring-web.onrender.com",
  "bimscoringnke.onrender.com",
]);

const CANONICAL_HOST = "bcl-scoring.asadara83.workers.dev";

export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") || "").toLowerCase().trim();
  if (!LEGACY_RENDER_HOSTS.has(host)) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.protocol = "https";
  redirectUrl.host = CANONICAL_HOST;
  return NextResponse.redirect(redirectUrl, 308);
}

export const config = {
  matcher: "/:path*",
};
