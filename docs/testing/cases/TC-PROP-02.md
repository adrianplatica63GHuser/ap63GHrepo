# TC-PROP-02 — Editare și salvare: contorul de versiuni avansează

| | |
|---|---|
| **Area** | property |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

## What this proves

Editing a saved property and pressing „Salvează" appends exactly **one** version, and the
version label on screen goes up by one. This is the single behaviour the existing
Playwright suite already covers
(`e2e/versioning/property-versioning.spec.ts`), so this case is the bridge between the
catalogue and what is already automated — and the natural first promotion.

## Before you start

- TC-PROP-01 is green and its property `TC-PROP-01 Teren de test` still exists.

## What Adrian is asked for

Nothing.

## Two ways the version indicator appears — both are correct

Since Slice #20.12 the version strip has two states and the case must accept either:

- the full strip — „Versiunea anterioară" (◀), the label **„v N"**, „Versiunea
  următoare" (▶);
- a compact chip reading **„N versiuni"**, shown when you are on the latest version and
  it has prior history. The chip shows a **total count, not the current number**.

A visually-hidden „v N" span sits beside the chip
(`src/components/version-nav-controls.tsx`) so the number stays discoverable in both
states. If the number is genuinely absent from the page, that span has been removed and
that is a defect, not a step to work around.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-PROP-01 Teren de test` from „Proprietăți — Listă" | The detail screen, on the tab „Detalii" |
| 2 | Finds the version indicator near „Puncte de contur" | Either „v N" or „N versiuni" — write the number down |
| 3 | Looks at „Salvează" | It is **disabled** — nothing has changed yet |
| 4 | Changes „Suprafață oficială (m²)" from `1000` to `1100` | „Salvează" becomes **enabled** |
| 5 | Presses „Salvează" | The form saves |
| 6 | Looks at the version indicator again | „v N+1", or a chip whose count has gone up by one |
| 7 | Looks at „Salvează" | It is **disabled** again |
| 8 | Presses „Versiunea anterioară" (◀) | The form goes read-only, and „Setează ca actuală" becomes enabled |
| 9 | Presses „Versiunea următoare" (▶) back to the latest | The form is editable again |

Step 3 and step 7 are the bug class from Slice #18.15: a „Salvează" button that does not
track dirty state.

## At the end — leaving things as they were found

**This case leaves the property at one version more than it found it**, and that is
harmless: every assertion here is relative (`N+1`), never absolute — the same decision
`e2e/auth.setup.ts` makes about its own fixed property. Nothing extra to remove; the
property itself is TC-PROP-01's to delete.

## Notes from the runs

_(filled in by the first run)_
