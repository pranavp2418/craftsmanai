# Security

This document describes the security posture of the frontend codebase as
delivered, and what still needs to be done before going live.

---

## Audit findings (May 2026)

A security audit was performed before handoff. Items below were either fixed
in this codebase or are documented for the developer to address.

### Fixed

| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| 1 | Next.js 15.3.6 — 4 known CVEs (middleware/proxy bypass via segment-prefetch, i18n bypass, cache poisoning, incomplete-fix follow-up) | **High** | Upgraded to `next@^15.5.18` (and `eslint-config-next` to match). |
| 2 | `@react-google-maps/api` declared as a dependency but never imported anywhere in the app | Low (attack-surface) | Removed from `package.json`. |
| 3 | `lucide-react` declared as a dependency but never imported anywhere in the app | Low (attack-surface) | Removed from `package.json`. |
| 4 | Original `.env.local` shipped with what looked like a Supabase publishable key pointing at a non-Supabase domain | Low (publishable keys are designed to be client-exposed, but unknown provenance) | Replaced with a blank template. **Rotate the key in your Supabase dashboard if it was real.** |
| 5 | 7 `any` types in application code (e.g. SpeechRecognition handlers, Recharts tooltips, localStorage parses) | Low (type-safety) | All replaced with proper types. ESLint rule `@typescript-eslint/no-explicit-any` is now set to `error`. |
| 6 | `localStorage` reads called `JSON.parse` without guards — corrupt data would crash the page | Low (DoS) | Wrapped in `lib/storage.ts` with try/catch and an SSR guard. |
| 7 | No security headers configured | Medium | Full set added in `next.config.ts` (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy). `x-powered-by` disabled. |
| 8 | No production env-var validation | Low | `lib/env.ts` added — required vars fail loudly at module load. |
| 9 | No error boundaries — uncaught errors would show stack traces in production | Medium | Added `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`. |
| 10 | Package-install scripts ran without an allowlist (any new transitive dep could execute arbitrary code at install time) | Medium (supply-chain) | Migrated to pnpm with an explicit `allowBuilds:` whitelist in `pnpm-workspace.yaml`. Only `sharp` and `unrs-resolver` can run install scripts; anything else is blocked. Add new entries via `pnpm approve-builds <pkg>` only after vetting. |

### Verified clean

- **No hardcoded secrets, API keys, or tokens** in source (regex-scanned for `api_key`, `secret`, `token`, `password`, `bearer`, `authorization`).
- **No `dangerouslySetInnerHTML`** anywhere in app code.
- **No `eval` or `new Function`** anywhere in app code.
- **No `target="_blank"` without `rel="noopener noreferrer"`**.
- **No user-controlled values** flowing into `href`, `src`, or `window.location` assignments.
- **No env variables leak into the built JS bundles** (verified by grepping `.next/static/` and `.next/server/app/*.html` after a production build).
- **TypeScript compiles cleanly** (`npx tsc --noEmit`, 0 errors).
- **ESLint passes cleanly** (`npx next lint`, 0 errors; 76 warnings, all pre-existing and intentional — mostly `<img>` → `next/image` migration suggestions).
- **Production build succeeds** for all 12 routes.

### Outstanding (the developer must address)

| # | Finding | Severity | Where / next step |
|---|---------|----------|-------------------|
| A | **No authentication** — every route is publicly accessible | **Critical** for production | Add Supabase auth + Next.js middleware; whitelist only `/design-approval/[id]`. |
| B | **`/design-approval/[id]` accepts any ID and serves the same static content** | **Critical** for production | Implement HMAC-signed link verification using a server-side secret. Reject unsigned requests. |
| C | **`SecurityCard` password form is mock** — `handleSave` only clears the form and shows a toast | Will become critical when wired up | When wiring, submit over HTTPS only, never log/store the plaintext password, hash server-side with argon2/bcrypt. |
| D | **40 fictitious-looking emails and several phone numbers** in `lib/customersData.ts` / `manufacturersData.ts` / `requestsData.ts` | Low (probably stub data, but verify) | Audit `lib/*Data.ts` and remove any real PII before this code goes anywhere except `localhost`. |
| E | **PostCSS `<8.5.10` (transitive via Next.js) — moderate XSS via unescaped `</style>` in CSS Stringify Output (GHSA-qx2v-qp2m-jg93)** | Moderate, build-time only | No safe fix today (Next.js 15.5.18 still bundles it). Re-run `npm audit` periodically; the fix will land in a Next.js patch release. Not exploitable at runtime — it's about CSS being processed during build. |
| F | **CSP allows `script-src 'unsafe-inline'`** — required by Next.js's runtime today, but it weakens XSS defence | Medium | If the threat model demands strict CSP, migrate to nonce-based CSP via Next.js middleware. |
| G | **CSP `img-src` is `'self' data: blob: https:`** — broad because the prototype uses third-party demo image CDNs | Medium | Replace demo images with your own CDN, then tighten `img-src` in `next.config.ts` to that exact host. |
| H | **External CDNs loaded without Subresource Integrity (SRI):** Google Fonts CSS, Fontshare, RemixIcon via cdnjs | Low (these are stylesheets/fonts, lower XSS risk than scripts; CSPs cover this) | Optional: self-host critical assets, or add SRI hashes to `<link>` tags in `app/layout.tsx` and `app/globals.css`. |
| I | **HSTS `preload` directive is set** | Footgun if applied prematurely | Only submit your domain to the HSTS preload list AFTER you're committed to HTTPS-only on the apex and all subdomains. Once preloaded, you cannot serve HTTP for the configured `max-age` (2 years). |
| J | **No rate limiting / WAF / bot protection** | Medium | Vercel includes a basic WAF on Pro plans. Cloudflare or AWS WAF in front is the usual upgrade. Rate-limit auth and AI-generation endpoints especially. |
| K | **No error tracking** | Medium for ops | Wire `app/error.tsx` and `app/global-error.tsx` to Sentry or similar so production errors aren't silently lost. |
| L | **Browser-based Web Speech API sends audio to the browser's speech-recognition service** (in Chrome, this is a Google endpoint) | Low (user privacy, not code vuln) | Mention this in the product's privacy policy if you ship the voice-input feature. |

---

## What's already in place

### HTTP response headers

Configured globally in `next.config.ts` → `headers()`:

| Header                       | Value (summary)                                  | Why |
| ---------------------------- | ------------------------------------------------ | --- |
| `Content-Security-Policy`    | Strict default-src 'self' + minimal allowlists   | Mitigates XSS by restricting where scripts, styles, images, fonts, and network requests can come from. |
| `Strict-Transport-Security`  | `max-age=63072000; includeSubDomains; preload`   | Forces browsers to use HTTPS for two years. **Only enable once your site is fully HTTPS.** |
| `X-Frame-Options`            | `DENY`                                           | Prevents the app from being embedded in an iframe — defends against clickjacking. (CSP `frame-ancestors 'none'` is also set as the modern equivalent.) |
| `X-Content-Type-Options`     | `nosniff`                                        | Prevents MIME-type sniffing. |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`                | Avoids leaking full URLs (which may contain IDs) to third-party origins. |
| `Permissions-Policy`         | `microphone=(self)`, everything else off         | Disables sensitive browser APIs by default. |
| `X-DNS-Prefetch-Control`     | `on`                                             | Slight perf win for cross-origin font/image loads. |

The `x-powered-by: Next.js` header is **disabled** (`poweredByHeader: false`)
so the framework isn't advertised.

### Code-level safeguards

- **No `dangerouslySetInnerHTML`** anywhere in the codebase (audited).
- **No `eval` / `new Function`** anywhere (audited).
- **No `target="_blank"` without `rel="noopener noreferrer"`** (audited; the
  ESLint rule `react/jsx-no-target-blank` enforces this going forward).
- **All `any` types removed** from application code; ESLint's
  `@typescript-eslint/no-explicit-any` is set to `error`.
- **`localStorage` is wrapped** by `lib/storage.ts` to be SSR-safe and
  resilient to JSON parse errors and quota errors. The previous code crashed
  the page if storage was corrupted; the new wrapper falls back gracefully.
- **Environment variables** go through `lib/env.ts`. Required values fail
  loudly at module load instead of failing silently at request time.

### Secrets posture

- `.env.local` is **git-ignored**. The committed `.env.example` only contains
  placeholder values.
- Only variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.
  Everything else stays on the server. **Never** put a service-role key,
  database password, or third-party private key behind that prefix — it ends
  up in the JavaScript bundle.

---

## Known limitations (must address before production)

### No authentication / authorisation

Every route is currently unauthenticated. Before launch:

- Add **Supabase auth** (or your auth provider of choice).
- Add a **Next.js middleware** that redirects unauthenticated users to a
  login page, with `/design-approval/[id]` whitelisted (customer-facing).
- Add **HMAC signature verification** on `/design-approval/[id]` so customers
  can only access designs that were explicitly shared with them. Use a
  server-side secret (never `NEXT_PUBLIC_`) for signing.

### No backend means no real authorisation checks

Today, "data" comes from in-memory arrays in `lib/*Data.ts`. When you wire up
the backend:

- Enable **Row Level Security (RLS)** on every Supabase table.
- Never query Supabase from the client with the service-role key.
- Validate user input server-side (Zod or similar). Don't trust anything from
  the browser.

### Permissive CSP

The `img-src` directive currently allows `https:` (any HTTPS host) because the
prototype uses third-party demo CDNs. Before launch:

- Replace the demo image URLs with your own CDN.
- Tighten `img-src` to your exact CDN host(s) in `next.config.ts`.
- Add your real API host to `connect-src`.

### Inline styles

The CSS-in-JS via `style={{ ... }}` plus Tailwind require `style-src
'unsafe-inline'`. This is a common Next.js trade-off, but if your security
threat model demands stricter CSP:

- Migrate inline `style={{ ... }}` to Tailwind utility classes or CSS Modules.
- Use a CSP nonce strategy (Next.js supports this via middleware).

### No rate limiting / WAF

When the backend lands, put:

- A WAF in front (Vercel includes a basic one; Cloudflare is the usual
  upgrade).
- Rate limiting on auth, AI-generation, and email/SMS endpoints — these are
  the abuse surfaces.

---

## Production checklist

Before going live, work through this list:

- [ ] **Rotate any leaked credentials.** If the original `.env.local`
      committed to source control contained real keys, rotate them.
- [ ] **Auth is wired up** and protects every route except the customer
      approval link.
- [ ] **HMAC verification** enforced on `/design-approval/[id]`.
- [ ] **RLS enabled** on every Supabase table.
- [ ] **CSP tightened**: `img-src` and `connect-src` point at known hosts.
- [ ] **Error tracking** wired up in `app/error.tsx` and
      `app/global-error.tsx` (Sentry, Datadog, etc.).
- [ ] **`npm audit`** is clean (or known issues are documented).
- [ ] **Dependabot / Renovate** is configured for the repo.
- [ ] **HTTPS** is enforced at the edge before turning on HSTS preload.
- [ ] **`robots` metadata** flipped from `index: false` to `index: true` in
      `app/layout.tsx` when you actually want the public to find the site.
- [ ] **Logging** never includes PII (customer email, phone, design
      details) or secrets.

---

## Reporting a vulnerability

If you discover a security issue, please email security@craftsman.ai (or your
chosen security address) rather than opening a public GitHub issue. Include:

- A description of the issue.
- Steps to reproduce.
- The impact you believe it has.

We'll respond within 3 business days.
