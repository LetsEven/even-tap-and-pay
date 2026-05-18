import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Generate a random nonce for each request
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // Backend URL from environment variable (removes /api suffix if present)
  const backendUrl =
    process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ||
    "https://even-backend-production.up.railway.app";
  const isDev = process.env.NODE_ENV === "development";
  const devUrls = isDev ? " http://localhost:5000 ws://localhost:5000" : "";

  // Build CSP header with nonce (PCI DSS compliant - no unsafe-inline in script-src)
  // Note: style-src uses 'unsafe-inline' because React inline styles don't support nonces
  // This is acceptable for PCI DSS as the security concern is primarily script injection
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: ${backendUrl} https://*.supabase.co;
    font-src 'self';
    connect-src 'self' ${backendUrl} wss://${backendUrl.replace("https://", "")}${devUrls};
    frame-src 'none';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  // Clone the request headers
  const requestHeaders = new Headers(request.headers);
  // Set the nonce in a custom header so layout.tsx can read it
  requestHeaders.set("x-nonce", nonce);

  // Create response with security headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Set all PCI DSS required security headers
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  );
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");

  return response;
}

// Matcher: apply to all routes except static files and images
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, fonts, etc.)
     */
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|otf|ttf)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
