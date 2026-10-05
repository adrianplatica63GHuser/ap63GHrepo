# TC-PROP-10 — Un singur „Proprietăți" în bara laterală; „Hartă completă" din lista proprietăților

| | |
|---|---|
| **Area** | property |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-05 |

## What this proves

Since Slice #37.92 the sidebar has one property item, „Proprietăți", with the map's icon;
„Proprietăți — Listă" and „Proprietăți — Hartă" are gone. The whole-properties map opens from the
Properties list's „Hartă completă" (the map icon, its words shown), which stands at the left of
„Adaugă proprietate" in the list's right-hand group. While the map is open „Proprietăți" is the
sidebar's active item, the breadcrumb reads „Proprietăți › Hartă completă", and its „Proprietăți"
leads back to the list. A second property item in the sidebar, or a map page that lights up nothing,
is the defect.

## Before you start

- TC-AUTH-01 is green, and `.env` has a Google Maps key.
- Nothing to create: the case reads the sidebar, the list's toolbar and the map page.

## What Adrian is asked for

Nothing.

## Steps

„Active" is the sidebar link's `aria-current="page"`. „On one line" is the buttons' vertical centres
within 2 px.

| # | A person does | And sees |
|---|---|---|
| 1 | The window 1920 × 1080; presses „Proprietăți" in the sidebar | The list „Proprietăți" (`/properties`). In the sidebar one property item, „Proprietăți" (the map icon), active; no „Proprietăți — Listă", no „Proprietăți — Hartă" |
| 2 | Looks at the list's toolbar | „Hartă completă" (the map icon, its words shown) and „Adaugă proprietate" on one line, „Hartă completă" to its left |
| 3 | The window 1366 × 900 | The same: one „Proprietăți" in the sidebar; „Hartă completă" left of „Adaugă proprietate" on one line |
| 4 | Presses „Hartă completă" | The address is `/properties/map` and the map draws; „Proprietăți" in the sidebar is active; the breadcrumb reads „Acasă", „Proprietăți", „Hartă completă" |
| 5 | Presses „Proprietăți" in the breadcrumb | The list „Proprietăți" (`/properties`) again |

## At the end — leaving things as they were found

Nothing was written.

## Notes from the runs

**2026-10-05 — run 1, `driven` (Slice #37.92).** Driven in the desktop app's browser pane against
`npm run dev` on 3000, its viewport emulated at 1920 × 1080 and 1366 × 900; a script pressed the
links and buttons (the emulated viewport drops real clicks, FU-290), starting from „Acte".
- Step 1: `/properties`, headed „Proprietăți"; the sidebar's one property link „Proprietăți"
  (lucide-map), `aria-current="page"`.
- Step 2 (1920): „Hartă completă" (lucide-map) at x 1144–1297, „Adaugă proprietate" 1305–1482,
  both centred at y 153.
- Step 3 (1366): one „Proprietăți"; 989–1142 and 1150–1327 at y 153.
- Step 4: `/properties/map`, the map's box present (the pane was hidden, so the map's zoom was not
  read — the spec reads it); „Proprietăți" active; the visible breadcrumb „Acasă", „Proprietăți",
  „Hartă completă". (The DOM also held a hidden breadcrumb of the page before — the router keeps
  it — so a run reads the visible one.)
- Step 5: the breadcrumb's „Proprietăți" (`/properties`) — the list again.

**2026-10-05 — run 2, `confirmed` (Slice #37.92).** The same way, against the file above unchanged:
step 1 one „Proprietăți", active; step 2 1144–1297 / 1305–1482 at y 153; step 3 989–1142 /
1150–1327 at y 153; step 4 `/properties/map`, „Proprietăți" active, „Acasă › Proprietăți › Hartă
completă"; step 5 `/properties`. Nothing was written. Nothing in the file changed, so the case is
confirmed, and `e2e/property/properties-nav.spec.ts` translates it.

**2026-10-05 — `automated`.** `e2e/property/properties-nav.spec.ts` translates the case; green on the runner,
`20261005T070356Z-19469` on `7a65f19` with the slice's tree (with TC-AUTH-01's, TC-PROP-01's, TC-PROP-03's, TC-VER's, TC-ICON-07's and TC-PROP-06's specs).
