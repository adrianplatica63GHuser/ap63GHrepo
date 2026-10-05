# TC-DOC-03 — Un PAD: „Detalii act", „Date de emitere", fără „Câmpuri specifice tipului de document", „Data autentificării" pe un rând

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-02 |

## What this proves

Since Slice #37.52 a Document whose type has no pages of its own names its type-fields tile and
panels for what they hold: the tile is „Detalii act" / „Document details" (it was „Câmpuri
specifice" / „Type fields"); the panel with the institution, number and date is „Date de emitere"
/ „Issue details" when the type has no fees group (it was „Taxe și onorarii" / „Fees", with no fee
in it); the type's ungrouped fields have no heading (it was „Câmpuri specifice tipului de
document"). The date's label — the last field of its row — reads on one line, in Romanian and
in English („Authentication date", it was „Date of Authentication"). A type with a fees group
keeps that group's own label — in English too, since the type's
group is labelled in Romanian (fine for the English screen, the rule in `CLAUDE.md`).

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a Document of
  type „Plan de Amplasament și Delimitare", „Etichetă scurtă" `TC-DOC-03 PAD`, and a Contract de
  Vânzare, `TC-DOC-03 CVC`.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900. „One line" is the label's height equal to its line height (20 px).
English is the interface language set by the `NEXT_LOCALE` cookie (`en-GB`); the case puts it
back at the end.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-DOC-03 PAD` | A tile „Detalii act" (and its tick in „Părți afișate"), inside it one panel, „[Date de emitere]"; nowhere „Câmpuri specifice" nor „Taxe și onorarii"; „Data autentificării" on one line |
| 2 | Switches the interface to English and opens it again | „Document details", „[Issue details]"; nowhere „Type fields", „Document-type-specific fields" nor „Fees"; „Authentication date" on one line |
| 3 | Opens `TC-DOC-03 CVC`, in English, „All" tiles | The panel with „Authentication date" is titled „[Taxe și onorarii]" — the CVC's own fees group, whose label the form keeps as the type writes it |
| 4 | Switches back to Romanian and opens it again | The same panel is „[Taxe și onorarii]", „Data autentificării" on one line |

## At the end — leaving things as they were found

The interface back in Romanian (the cookie removed, as it was). Delete both documents
(`DELETE /api/documents/<id>`). Căutare globală for `TC-DOC-03` finds nothing.

## Notes from the runs

**2026-10-02 — run 1, `driven` (Slice #37.52).** Driven in the Claude desktop app's browser pane
against `npm run dev` on 3000; the records posted from the page with `fetch`, the language
switched with the `NEXT_LOCALE` cookie and a reload (the pane had none before — Romanian is the
default — and it was removed again). This file was written from it.
- Step 1: the region „Detalii act", its tick present; headings „Detalii act", „Date de emitere";
  no „Câmpuri specifice" anywhere on the page, no „Taxe și onorarii" in the tile; „Data
  autentificării" 20 px high (line height 20).
- Step 2: `lang` `en-GB`; „Document details", „Issue details"; none of the old English names;
  „Authentication date" 20 px high, as wide as its 136 px box.
- Step 3's reading was lost to the reload the same script ran; it is read in run 2.
- Step 4: „Taxe și onorarii" over „Data autentificării", 20 px; the tile is the CVC's
  „Instrument".

**2026-10-02 — run 2, corrected (Slice #37.52).** New records; steps 1, 2 and 4 exactly as run 1.
Step 3 read „Taxe și onorarii", not „Fees", over „Authentication date": the CVC's fees group is
labelled in Romanian by the type, and the form keeps the group's own label as it did before this
slice. The file said „Fees", which was wrong; step 3 is corrected, so the case stays `driven`.

**2026-10-02 — run 3, `confirmed` (Slice #37.52).** New records, against the corrected file
unchanged.
- Step 1: „Detalii act" (region and tick), „Date de emitere", no „Câmpuri specifice" on the page,
  no „Taxe și onorarii" in the tile, „Data autentificării" 20 px.
- Step 2: `en-GB`; „Document details", „Issue details", none of the old names, „Authentication
  date" 20 px.
- Step 3: „Taxe și onorarii" over „Authentication date".
- Step 4: Romanian again (the cookie gone), „Taxe și onorarii" over „Data autentificării", 20 px.
- Both documents deleted (204, 204); nothing left for `TC-DOC-03`. Nothing changed during the run,
  so the case is confirmed, and `e2e/document/type-fields-tile.spec.ts` translates it.

**2026-10-02 — `automated`.** `e2e/document/type-fields-tile.spec.ts` translates the case and takes
#37.52's pictures. Green on its first runner run, `20261002T140319Z-4705` on `c86c0f6` (the spec,
lint, tsc; jest `20261002T140544Z-22944`, 206 suites).

**2026-10-05 — Slice #37.90.** Inside a tile a panel's subtitle reads in square brackets, so steps 1–4
name the panel „[Date de emitere]", „[Issue details]" and „[Taxe și onorarii]"; the stored names and
everything else in the steps are unchanged, and the spec reads the bracketed headings.
