---
paths:
  - "src/lib/auth/**"
  - "src/lib/features/**"
  - "src/proxy.ts"
  - "middleware.ts"
  - "src/app/api/**"
  - "src/app/admin/**"
---

# Auth, UAT_NO_AUTH & dev-only surfaces

<!-- Extracted verbatim from CLAUDE.md (Slice 24.01.optimization). Original line numbers in brackets. -->

- **Never call `supabase.auth.getUser()` directly — use `getCurrentUser()` from `src/lib/auth/current-user.ts`.** A direct call has no idea about `UAT_NO_AUTH`, so it returns no user on Ciprian's box and any route that 401s there surfaces as "session expired" on a build with no login link (Slice #21.11.uat.auth). Same applies to reading `process.env.UAT_NO_AUTH` inside `src/` — import `isUatNoAuth()` instead. `middleware.ts` is the one legitimate exception, since it must decide whether to run the session refresh before any route code executes. `src/__tests__/auth-single-source.test.ts` enforces both rules. **The general lesson: when a bypass rule gets copy-pasted into a third place, stop and centralise it — the fourth site is the one that will be missed.**

- **Dev-only features are gated through `src/lib/features/dev-tools.ts` and `<DevOnly>` — never read `NEXT_PUBLIC_DEV_TOOLS` directly.** Same rule, same reason and same enforcement as `UAT_NO_AUTH` above: `src/__tests__/dev-tools-single-source.test.ts` fails the build on any other reader inside `src/`. Use `<DevOnly>` for JSX; call `isDevToolsEnabled()` where the gated thing is an ARRAY entry (a nav item, a tab descriptor, a column-picker row), because a wrapper cannot sit inside an array literal — the guard bans the env read, not the predicate. `middleware.ts` is NOT an exception here the way it is for `UAT_NO_AUTH`: this flag governs UI surfaces and route bodies, and nothing has to be decided before route code runs. Three ways this fails silently, all of them on Ciprian's box rather than yours:

  1. **`NEXT_PUBLIC_*` is baked at BUILD time, not read at run time.** `next build` substitutes the value into the bundle, so setting the variable in a compose file, with `docker run -e`, or in Ciprian's shell does **nothing at all** — the value baked when the image was built is the value he gets. Treat that as true on both sides of the client/server line and never design a runtime override. It follows that the image must be BUILT with the flag off: `build-ciprian-image.ps1` passes `--build-arg "NEXT_PUBLIC_DEV_TOOLS=false"` literally and deliberately does **not** read the key out of `.env` the way it reads the other `NEXT_PUBLIC_*` values, because Adrian's `.env` has dev tools on and harvesting it would ship them to Ciprian by inheritance.

  2. **Docker Compose cannot inject it either** — see the `--env-file` gotcha in `.claude/rules/docker-and-deployment.md`. For an ordinary runtime variable the fix is to list it in the service's own `environment:` block; for a `NEXT_PUBLIC_*` one there is no fix at that layer, because the value was already frozen at build. Note also that the repo's only compose file (`docker/postgres/docker-compose.yml`) runs **Postgres and pgAdmin, not the app** — local dev is `npm run dev` reading `.env` — and Ciprian's app compose lives outside the repo in `C:\dev\ga40prj.Ciprian\`. "Add it to both compose files" is the right instinct for the wrong variable class.

  3. **Vercel needs it set in the project's own environment variables**, or `https://ga40prj.vercel.app` silently loses the dev surfaces on the next deploy. Unset means off, which is the intended default — just not always the intended outcome there.
