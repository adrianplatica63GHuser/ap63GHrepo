# TC-PROP-02 — Editare și salvare: contorul de versiuni avansează

| | |
|---|---|
| **Area** | property |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-21 |

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
  următoare" (▶) — shown while you are NOT on the latest version, and on a property
  that has no history yet;
- a compact chip reading **„N versiuni"**, shown when you are on the latest version and
  it has prior history. The chip shows a **total count, not the current number**.

Both states were seen in the 2026-09-21 run, and the switch between them is exactly
where a naive locator breaks: before the first edit the header reads „◀ v 0 ▶"; after
one save it reads „2 versiuni" — a different string, a larger number, and the version
it is actually showing is `v 1`.

A visually-hidden „v N" span sits beside the chip
(`src/components/version-nav-controls.tsx`) so the number stays discoverable in both
states. If the number is genuinely absent from the page, that span has been removed and
that is a defect, not a step to work around.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Presses „Deschide" on the `TC-PROP-01 Teren de test` row in „Proprietăți — Listă" | The detail screen, headed with the property's own nickname, on the tab „DETALII" |
| 2 | Looks at the **top right of the page header**, beside the heading | „◀ v 0 ▶" and, next to it, a button „Setează ca actuală" |
| 3 | Scrolls to the bottom and looks at „Salvează" | It is **pale** — nothing has changed yet. „Șterge" (red) and „Anulează" sit beside it |
| 4 | Changes „Suprafață oficială (m²)" from `1000.00` to `1100`, then leaves the field | A banner **„✏ Modificări nesalvate"** appears above the buttons, and „Salvează" turns **dark** |
| 5 | Presses „Salvează" | The form saves and stays on this screen |
| 6 | Looks at the page header again | The strip has been **replaced by the chip „↺ 2 versiuni"**. The banner is gone and the field reads `1100` |
| 7 | Presses the chip | „◀ v 0 ▶" again, „Setează ca actuală" now **dark**, the fields greyed and „Suprafață oficială" back to `1000.00` — this is the previous version, read-only |
| 8 | Presses „Versiunea următoare" (▶) | Back to the latest. The accessibility tree reads „v 1" |

Step 3 and step 4 are the bug class from Slice #18.15: a „Salvează" button that does not
track dirty state. The „Modificări nesalvate" banner is the second half of the same cue
and is easier to assert on than a button's colour.

## At the end — leaving things as they were found

**This case leaves the property at one version more than it found it**, and that is
harmless: every assertion here is relative (`N+1`), never absolute — the same decision
`e2e/auth.setup.ts` makes about its own fixed property. Nothing extra to remove; the
property itself is TC-PROP-01's to delete.

## Notes from the runs

**2026-09-21 — driven, green, on `PROP01620`. Every behaviour this case claims held.**

Four corrections, all about **where** things are rather than whether they work:

1. **The version indicator is in the page header, top right, beside the heading** — not
   near „Puncte de contur", as this file first said. That was a guess from the message
   key living under `property.corners.*`, and the key's namespace is not where the
   control renders.
2. **A freshly created property is at „v 0", not „v 1".** The count and the label are
   off by one from each other by design: after one save the chip says „2 versiuni" while
   the version being shown is `v 1`.
3. **Editing raises a banner „✏ Modificări nesalvate"**, which this case did not know
   about. It is a better assertion than the button's colour, because a colour is a
   judgement and a banner is a string.
4. **„Salvează" is pale rather than absent when disabled**, and it sits at the bottom of
   the form beside „Șterge" and „Anulează" — below the map, well under the fold.

**The `sr-only` span is real and was read.** On the latest version the screen shows only
the chip „2 versiuni", and the accessibility tree still exposes „v 1" alongside the
„Versiunea anterioară" button — which is precisely what `e2e/README.md` says Slice
#20.12 added `version-nav-controls.tsx` for. A promoted spec can rely on it.

**Ready for promotion.** This case is the closest of the ten to what
`e2e/versioning/property-versioning.spec.ts` already asserts, and nothing here needs a
fixture the existing `auth.setup.ts` does not provide. One more unchanged run moves it
to `confirmed`.
