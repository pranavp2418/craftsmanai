import type { NextConfig } from "next";
 
/**
 * Security headers applied to every response.
 *
 * NOTES FOR DEVELOPERS:
 * - The Content-Security-Policy below is intentionally permissive for fonts/images
 *   used by the current UI (Google Fonts, Fontshare, RemixIcon CDN, demo images).
 *   When you replace mock images with real ones, tighten the `img-src` directive.
 * - `'unsafe-inline'` for styles is still required by Next.js / Tailwind runtime
 *   (it injects per-page `<style>` blocks). With every `style={{...}}` prop now
 *   removed in favour of Tailwind classes, you can revisit this with nonces or
 *   a hashed CSP for further hardening.
 * - `'unsafe-eval'` is included only for development; it is stripped in production.
 */
const isProd = process.env.NODE_ENV === "production";
 
const cspDirectives = [
  "default-src 'self'",
  // Scripts: Next.js needs 'self' and inline for its runtime; eval only in dev.
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  // Styles: inline required by Tailwind/Next.js runtime; allow Google Fonts CSS.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com https://cdnjs.cloudflare.com",
  // Fonts: Google Fonts + Fontshare + RemixIcon (cdnjs).
  "font-src 'self' data: https://fonts.gstatic.com https://api.fontshare.com https://fonts.fontshare.com https://cdn.fontshare.com https://cdnjs.cloudflare.com",
  // Images: any HTTPS source for now (mock images live on third-party CDNs).
  // In development also allow plain HTTP — the local backend serves generated images over
  // http://localhost:8000/uploads/... when a Supabase upload fails and falls back to local storage;
  // without `http:` the CSP silently blocks them inside the page (direct tab open still works).
  // TODO(production): tighten to your actual image CDN(s) before going live.
  `img-src 'self' data: blob: https:${isProd ? "" : " http:"}`,
  // XHR/fetch: same-origin by default. Add your API domain when wiring the backend.
  // Allow HTTP in development for local APIs, HTTPS in production.
  "connect-src 'self' https: http: wss: ws:",
  // Frames / framing
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Force HTTPS on any subresource (only in production for security).
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");
 
const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Camera + microphone are allowed on self for photo capture (PromptBox) and
    // voice input (Web Speech API). Geolocation and FLoC remain disabled.
    value: "camera=(self), microphone=(self), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];
 
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
 
  // Images: keep `unoptimized` so existing <img> tags keep rendering identically.
  // The `remotePatterns` block is here so the developer can switch to <Image />
  // from `next/image` without re-configuring.
  images: {
    // unoptimized: false — using next/image for optimization
    remotePatterns: [
      { protocol: "https", hostname: "api.fontshare.com" },
      { protocol: "https", hostname: "fonts.gstatic.com" },
      { protocol: "https", hostname: "cdnjs.cloudflare.com" },
      { protocol: "https", hostname: "agfgngkpvckrobfecdkr.storage.supabase.co" },
      { protocol: "https", hostname: "jglnpfucsinmgnrzlzqj.supabase.co" },
      { protocol: "https", hostname: "*.supabase.co" },
      // Local dev: the backend serves generated images from /uploads when the
      // Supabase upload fails and it falls back to local storage.
      { protocol: "http", hostname: "localhost", port: "8000" },
      { protocol: "http", hostname: "127.0.0.1", port: "8000" },
    ],
  },
 
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};
 
export default nextConfig;