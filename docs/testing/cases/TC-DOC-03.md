# TC-DOC-03 — Un PAD: „Detalii act" fără panou de emitere; emitentul, numărul și data în „Identificarea actului", „Data" pe un rând

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-07 |

## What this proves

Since Slice #37.52 a Document whose type has no pages of its own names its type-fields tile „Detalii
act" / „Document details" (it was „Câmpuri specifice" / „Type fields"), and the type's ungrouped
fields have no heading. **Since Slice #38.32** the issuer, the number and the date are on
„Identificarea actului" / „Document identification", under „Tip document", on every type. A type
with no fees group has no fees panel at all (until #38.32 it drew one, „Date de emitere", around
those three). A type with no labels of its own reads the generic set — „Emitent", „Nr. document",
„Data" / „Issuer", „Document No.", „Date" — and the date's label reads on one line. A contract de
vânzare reads the notarial set („Notariat", „Nr. act autentic", „Data autentificării"), and its
„[Taxe și onorarii]" panel holds only the fees.

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
| 1 | Opens `TC-DOC-03 PAD` | A tile „Detalii act" (and its tick in „Părți afișate"), with no „[Date de emitere]" and no date box in it; nowhere „Câmpuri specifice" nor „Taxe și onorarii". On „Identificarea actului": „Emitent", „Nr. document", „Data", the last on one line |
| 2 | Switches the interface to English and opens it again | „Document details", with no „[Issue details]"; nowhere „Type fields", „Document-type-specific fields" nor „Fees"; on „Document identification" „Issuer", „Document No.", „Date" on one line |
| 3 | Opens `TC-DOC-03 CVC`, in English, „All" tiles | On „Document identification": „Notary Office", „Authentic Deed No.", „Authentication date". The „[Taxe și onorarii]" panel — the CVC's own fees group, labelled as the type writes it — holds no date box |
| 4 | Switches back to Romanian and opens it again | „Notariat", „Nr. act autentic", „Data autentificării" on one line, on „Identificarea actului"; „[Taxe și onorarii]" holds the four fees and no date box |

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

**2026-10-07 — Slice #38.32, rewritten.** The issuer, number and date moved to „Identificarea
actului", so the PAD's „[Date de emitere]" panel no longer exists. Steps 1–4 rewritten to read
them where they are now; the spec was changed with them and its run is in #38.32's handover.
