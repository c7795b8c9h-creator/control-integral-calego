# CALEGO Control Integral · V7 Lite architecture

## Goal
Keep the operational app fast, predictable and small on desktop and mobile, while preserving Supabase security and the V7 functional behavior.

## Runtime shape
Production target is a static Vercel deployment with same-origin immutable assets:
- `index.html` — app shell, no dynamic GitHub bootstrap.
- `app.v7.min.css` — all application CSS consolidated and minified.
- `app.v7.min.js` — base app + auth hotfix + reviewed V7 behavior consolidated and minified.
- `vendor/supabase.min.js` — exact pinned Supabase browser client.
- `vendor/qrcode.min.js` — exact pinned QR generator.
- `vendor/jsqr.min.js` — QR reader fallback loaded only on browsers without BarcodeDetector.

No service worker is used. This intentionally avoids stale offline bundles and version loops. Vercel should cache hashed/versioned static assets as immutable and serve `index.html` with revalidation/no-cache.

## Removed from the final architecture
- Runtime fetch of `raw.githubusercontent.com`.
- Runtime `@main` references.
- Multiple preview/hotfix HTTP requests.
- CDN version drift.
- Duplicate dashboard filter handlers.
- Duplicate dashboard review/answer fetches.
- Oversized photo uploads and leaked object URLs.

## Data/network choices
- Dashboard loads the 7-day review window once, derives today locally, and fetches matching answers once.
- Dashboard filters are local; changing Area/Responsible/Turn does not refetch reviews.
- Evidence fetch is capped to the 18 photos actually rendered.
- Evidence images use lazy loading and async decoding.
- Config remains parallel and memory-only because it is small and changes administratively; no persistent client cache is used.
- Photos are resized to max 960 px and compressed before upload.

## Device compatibility
- Responsive CSS has no required horizontal page scroll.
- Camera uses `facingMode: environment`.
- QR scanning uses native BarcodeDetector when available and lazy-loads jsQR only as fallback.
- Reduced-motion preference is honored.
- No service-worker/offline writes are attempted because operational records must reach Supabase.

## Backend performance review
Supabase advisor currently reports:
1. Missing covering index for `review_sessions.machine_id` — safe candidate before final publication.
2. Several RLS policies can use `(select auth.uid())` / equivalent init-plan optimizations.
3. Multiple permissive SELECT policies exist on several configuration tables.

The RLS items must be regression-tested before production changes because authorization correctness is more important than micro-optimization. Unused-index notices are not a reason to remove indexes yet; the database has very little historical traffic.

## Final publication rule
Do not publish the layered preview loader. Build `dist/` and deploy those files directly to Vercel on the same origin. Pin the deployment to a tested commit and keep production rollback available.
