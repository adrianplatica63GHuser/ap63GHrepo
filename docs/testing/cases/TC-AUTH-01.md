# TC-AUTH-01 — Conectare și tabloul de bord

| | |
|---|---|
| **Area** | auth |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-09-23 |

## ⚠️ Claude cannot drive steps 2–4, and that is permanent

**Typing a password into a field is outside what Claude is allowed to do**, whatever
the account and whoever asks. So a Claude-driven run of this case starts at step 5, with
a session somebody else established.

**Slice #36.06 took the second way below**: `e2e/auth/login-dashboard.spec.ts` runs steps
5–8 on the session `e2e/auth.setup.ts` logs in, and this is the one case in the catalogue
promoted without being driven — recorded as such in `TEST-CATALOGUE.md` and in
`PROMOTED_WITHOUT_DRIVING` (`src/lib/testing/catalogue-map.ts`). It moved straight from
`draft` to `automated` on its first green `npm run e2e`, 2026-09-23.

The two honest ways to run it:

- **Adrian logs in himself**, and Claude reads back steps 5–8. That is a fourth thing to
  ask of him beyond the three he offered, which is why it is written here rather than
  assumed.
- **Promotion to Playwright**, which is the real answer. `e2e/auth.setup.ts` already
  does exactly this login, reading `E2E_EMAIL` and `E2E_PASSWORD` from `.env` — a spec
  has no such restriction. This case is therefore a good early candidate for `automated`
  even though it may never reach `driven`.

**Steps 5–8 were verified on 2026-09-21** against a session already live in the browser,
and the corrections from that reading are below.

## What this proves

A real account can log in through the real form and reach the application. Everything
else in this catalogue starts here, so when this fails, nothing else is worth running.

## Before you start

- The dev server is running: `npm run dev`, answering on `http://localhost:3000`.
- The local Docker database `ga40prj-postgres` / `ga40db` is up.
- `.env` holds `E2E_EMAIL` and `E2E_PASSWORD` for an **already-approved** account. The
  application does not sign up from here; it logs in.
- The browser has no live session. If one screen already shows the application, use
  „Ieșire" in the sidebar footer first.

## What Adrian is asked for

Nothing, unless the dev server is not running — then: **run `npm run dev` in its own
PowerShell window.**

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `http://localhost:3000/login` | The heading „Conectare", above two fields labelled „Utilizator sau Email" and „Parolă", and a button „Conectare" |
| 2 | Types the account's user name into „Utilizator sau Email" | The value appears in the field |
| 3 | Types the password into „Parolă" | Dots, not letters |
| 4 | Presses „Conectare" | The button reads „Se conectează…" while it works |
| 5 | Waits | The address becomes `http://localhost:3000/` and the login form is gone |
| 6 | Looks at the page | „Tablou de bord", and under it „Ce necesită atenția dumneavoastră azi" |
| 7 | Looks at the left sidebar | The sections „Persoane Fizice", „Persoane Juridice", „Proprietăți — Listă", „Proprietăți — Hartă", „Acte", then „Admin-Operațiuni" and „Admin-Configurare" — and below them, **once anything has been opened in this browser**, a „RECENTE" list of recently-opened records. A browser that has opened nothing shows no „RECENTE" at all (the list lives in the browser's own storage) |
| 8 | Looks at the **top** of the sidebar, above the „Nume, cod…" quick-search box | „Autentificat ca", and the account's name |

**Nothing is written by this case.** A failed login shows „Utilizator sau parolă
incorectă" under the form and stays on `/login`.

## At the end — leaving things as they were found

Nothing to clean up. The session cookie is the only thing created and every later case
wants it.

## Notes from the runs

**2026-09-23 — `automated` (Slice #36.06).** Green in `npm run e2e` with the whole suite,
12 passed; the spec is named in the catalogue's `Spec` column.

**2026-09-22 — promoted (Slice #36.06), without a hand run, by the stated exception.**
Writing the spec corrected step 7: the „RECENTE" list is not always there. It renders only
once something has been opened in that browser (`recently-viewed-panel.tsx` returns
nothing for an empty history, kept in the browser's localStorage), and the session a spec
starts from has opened nothing — so the spec does not assert it, and step 7 now says when
it appears. Also noticed while writing it: the sidebar's `<nav>` is labelled „Main
navigation", in English, for a screen reader (`components/sidebar/sidebar-nav.tsx`) — in
the 36.06 handover.

**2026-09-21 — steps 5–8 read against a live session. Three corrections:**

1. **„Autentificat ca <name>" is at the TOP of the sidebar**, directly above the
   „Nume, cod…" quick-search box — not in the footer, as this file first said. The
   footer holds „Schimbă parola" and „Ieșire".
2. **The sidebar has more in it than the case listed**: „Admin-Operațiuni" and
   „Admin-Configurare" below the five entity sections, and a „RECENTE" list of
   recently-opened documents below those. Step 7 now says so.
3. Steps 1–4 cannot be driven by Claude at all. See the block at the top of this file.

**One finding, not a step, recorded because it is a Romanian-primacy issue and this is
where it was noticed.** The browser tab title is **„Sign in — GA40"** on `/login` and
**„ga40prj"** on every other screen. Both are English, in `ro-RO`, which is the shipping
locale. The page bodies are correctly Romanian throughout; it is the `<title>` that was
never translated. Not fixed here — this slice adds one guard suite and touches nothing
else — and it is in the handover.
