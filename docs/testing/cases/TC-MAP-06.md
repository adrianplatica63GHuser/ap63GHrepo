# TC-MAP-06 — Stratul „Tarlale”: conturul unei tarlale din proprietățile ei, codul pe contur, clic spre pagina tarlalei

| | |
|---|---|
| **Area** | map |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-17 |

## What this proves

Since Slice #39.68 the map of all properties has a „Tarlale” layer, off when the map opens. On, it draws each tarla's
outline as a dashed line — the tarla's own corners when drawn, otherwise the shape around its properties — with its
code on it from about 6 km down, and a click on the code opens the tarla's page, whose map shows the same outline. An
outline that does not follow its properties, a layer on by default, or a code that opens nothing is the defect.

## Before you start

- TC-AUTH-01 is green. The window is 1366 × 900.
- **Created through the API:** tarla `TCM6` with „Localitate” `Testeni`; two lots of about 20 m × 20 m on it, about
  200 m apart, near 45.60 N, 24.50 E, where the archive has no property; nicknames `TC-MAP-06 Lot 1` and
  `TC-MAP-06 Lot 2`.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the map on the first lot at zoom 15 („Proprietăți — Hartă” with `?focus=<id>&z=15`) | The two lots; „Tarlale” among the map's buttons, not pressed; no outline |
| 2 | Presses „Tarlale” | „Tarlale” pressed; one dashed outline around both lots, the shape around them (no corners of its own); `TCM6` written on it |
| 3 | Clicks `TCM6` | The tarla's page: „Tarla TCM6 — Testeni”, and under „Contur” a map with the same outline and its code |
| 4 | Goes back to the map, then presses „Tarlale” twice | Back on the map, „Tarlale” not pressed and no outline — the layer is off whenever the map opens; pressed twice, on and then off again, with no outline |

## At the end — leaving things as they were found

Delete the two lots, then the tarla.

## Notes from the runs

**2026-10-17 — written (Slice #39.68)** from the code and the message files.

**2026-10-17 — run 1, `driven` (Slice #39.68).** Claude, in the browser pane on localhost:3000 at 1366 × 900; the
tarla and the two lots created through the API, the buttons and the code pressed by script (FU-290). Step 1: zoom 15
on the first lot, „Tarlale” not pressed, no outline. Step 2: pressed, one outline `TCM6` of the kind „shape around
its properties”, `TCM6` written on it. Step 3: `/tarlale/<id>`, „Tarla TCM6 — Testeni”, the „Contur” map with the
same outline and `TCM6`. Step 4: back on the map, „Tarlale” not pressed, no outline; pressed, the six tarlale of the
archive outlined; pressed again, none. The first draft of step 4 expected the layer still on after going back; the
step was corrected to the layer being off whenever the map opens, before this run.

**2026-10-17 — run 2, `confirmed` (Slice #39.68).** The same pane and rows, the file unchanged: every step the same.
Deleted: the two lots, then the tarla (204 each; the tarla's page then 404). `e2e/map/tarla-layer.spec.ts`
translates it; it loads real maps, so it waits for November's Maps allowance.
