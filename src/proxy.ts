import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Flux Route Middleware
 *
 * Responsibilities:
 * 1. Block unauthenticated access to /api/admin/* in production
 * 2. Add security headers to all responses
 * 3. Block demo API actions when not in demo mode
 */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const response = NextResponse.next();

  // ── Security headers on every response ──────────────────────────────────
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  // ── CSRF Protection ──────────────────────────────────────────────────────
  // SEC-07: Require valid Origin or Referer for all mutating API requests.
  if (
    path.startsWith("/api/") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)
  ) {
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const host = request.headers.get("host");

    // Allow external webhooks and auth routes to bypass origin checks
    if (!path.startsWith("/api/webhooks/") && !path.startsWith("/api/auth/")) {
      let isSameOrigin = false;

      try {
        if (origin && host && new URL(origin).host === host) isSameOrigin = true;
      } catch {}

      try {
        if (!isSameOrigin && referer && host && new URL(referer).host === host) isSameOrigin = true;
      } catch {}

      if (!isSameOrigin) {
        return NextResponse.json(
          { error: "Invalid Origin or Referer (CSRF protection block)" },
          { status: 403 }
        );
      }
    }
  }

  // ── Admin route protection ───────────────────────────────────────────────
  // /api/admin/* routes require the x-admin-key header (checked in the route
  // handler itself), but we add a blanket 401 for any request that is missing
  // the header entirely, without even hitting the route handler.
  if (path.startsWith("/api/admin")) {
    const adminSecret = process.env.ADMIN_SECRET;
    const providedKey = request.headers.get("x-admin-key");

    if (!adminSecret || providedKey !== adminSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Apply to all API routes and pages, excluding Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
