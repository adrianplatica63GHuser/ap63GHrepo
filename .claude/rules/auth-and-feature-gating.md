---
paths:
  - "src/lib/auth/**"
  - "src/lib/features/**"
  - "src/proxy.ts"
  - "middleware.ts"
  - "src/app/api/**"
  - "src/app/admin/**"
---

# Auth, UAT_NO_AUTH & (retired) dev-only surfaces

<!-- Extracted verbatim from CLAUDE.md (Slice 24.01.optimization). Original line numbers in brackets. -->

- **Never call `supabase.auth.getUser()` directly — use `getCurrentUser()` from `src/lib/auth/current-user.ts`.** A direct call has no idea about `UAT_NO_AUTH`, so it returns no user on Ciprian's box and any route that 401s there surfaces as "session expired" on a build with no login link (Slice #21.11.uat.auth). Same applies to reading `process.env.UAT_NO_AUTH` inside `src/` — import `isUatNoAuth()` instead. `middleware.ts` is the one legitimate exception, since it must decide whether to run the session refresh before any route code executes. `src/__tests__/auth-single-source.test.ts` enforces both rules. **The general lesson: when a bypass rule gets copy-pasted into a third place, stop and centralise it — the fourth site is the one that will be missed.**

- **There are no dev-only features any more (Slice #38.22).** `NEXT_PUBLIC_DEV_TOOLS`, `src/lib/features/dev-tools.ts` and `<DevOnly>` are gone: the language toggle is on every build, the developer-notes panel on none (its note is `docs/claude/DEVELOPER-NOTES.md`), and `src/__tests__/same-in-all-environments.test.tsx` fails the build if anything in `src/`, `e2e/`, `middleware.ts`, `next.config.ts`, the Dockerfile or `build-ciprian-image.ps1` reads the flag again. A difference between DEV, UAT and Vercel is either something a machine does not have — listed, with its reason, in #38.22's handover — or a defect. If a build flag is ever wanted again, the three lessons it taught still hold:

  1. **`NEXT_PUBLIC_*` is baked at BUILD time, not read at run time.** `next build` substitutes the value into the bundle, so setting the variable in a compose file, with `docker run -e`, or in Ciprian's shell does **nothing at all** — the value baked when the image was built is the value he gets. Treat that as true on both sides of the client/server line and never design a runtime override. It follows that an image must be BUILT with the value it should ship (the retired flag was passed as a literal `--build-arg`, never harvested from Adrian's `.env`).

  2. **Docker Compose cannot inject it either** — see the `--env-file` gotcha in `.claude/rules/docker-and-deployment.md`. For an ordinary runtime variable the fix is to list it in the service's own `environment:` block; for a `NEXT_PUBLIC_*` one there is no fix at that layer, because the value was already frozen at build. Note also that the repo's only compose file (`docker/postgres/docker-compose.yml`) runs **Postgres and pgAdmin, not the app** — local dev is `npm run dev` reading `.env` — and Ciprian's app compose lives outside the repo in `C:\dev\ga40prj.Ciprian\`. "Add it to both compose files" is the right instinct for the wrong variable class.

  3. **Vercel needs it set in the project's own environment variables**, or `https://ga40prj.vercel.app` silently differs on the next deploy.
