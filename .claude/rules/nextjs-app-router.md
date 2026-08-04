---
paths:
  - "src/app/**"
  - "next.config.*"
  - "src/proxy.ts"
  - "middleware.ts"
---

# Next.js 16 App Router

<!-- Extracted verbatim from CLAUDE.md (Slice 24.01.optimization). Original line numbers in brackets. -->

- **Next.js 16 ≠ training data.** App Router has breaking changes; the old `i18n` config in `next.config.js` is gone (Pages-Router-only). Read `node_modules/next/dist/docs/` before writing routing or middleware code.

- **Dev-server route table can go stale after a long Fast Refresh session — symptom looks exactly like a data bug.** After many hours of hot-reloading (especially after adding several new API route files, as in a slice touching lots of `route.ts` files), `npm run dev` can start 404ing dynamic API routes — e.g. `GET /api/documents/[id]/pages/[pageId]/view` — even when the DB row and the underlying file both genuinely exist and are correct. Hit in Slice #21.10.help.rollout follow-up: verified the `document_page` row and its file on disk were both present and correct, yet every document's page-view request still 404'd — restarting `npm run dev` (Ctrl+C, then `npm run dev` again) fixed it instantly with zero code changes. This is dev-mode-only (Fast Refresh/HMR route-table drift); it cannot happen on Vercel or Ciprian's UAT box, which compile once and serve that build with no live route table to drift. **When a route 404s for a reason the code doesn't explain, restart the dev server before debugging further** — especially if several new route files were added recently in the same session.
