# TC-ICON-02 — Creionul, Salvarea și Coșul pe o proprietate: modificată, păstrată, ștearsă

| | |
|---|---|
| **Area** | ui |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-01 |

## What this proves

Since Slice #37.43 „Modifică", „Salvează", „Șterge" and „Anulează" on the entity forms are icon
buttons — a pencil, a floppy disk, a bin and an X — whose words are their accessible names and
their tooltips. They still do what they did: „Modifică" unlocks a read-only record, „Salvează"
keeps the edit, „Șterge" asks first. The question it asks is a confirmation, so its answers
„Nu" / „Da" keep their words (A110).

## Before you start

- TC-AUTH-01 is green.
- **One Property, created through the API** as `e2e/helpers/records.ts` creates prerequisites:
  `POST /api/properties` with `{"nickname": "TC-ICON-02 Teren de probă", "provenance": "MANUAL"}`.

## What Adrian is asked for

Nothing.

## Steps

A button is read by its name; its icon is the Lucide one IconButton draws (a pencil, a floppy
disk, a bin, an X). A tooltip is the element with role `tooltip`, shown while the mouse is over
the button.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the property read-only (`/properties/<id>?readonly=true`) | Under the form: ← „Înapoi la listă" and a pencil, „Modifică"; both 38 px tall |
| 2 | Moves the mouse over the pencil | A tooltip `Modifică` |
| 3 | Presses the pencil | The form opens for editing; under it ←, a floppy disk „Salvează" (inactive — nothing changed yet) and a bin „Șterge" |
| 4 | Changes „Poreclă" to `TC-ICON-02 Teren modificat` and moves the mouse over the floppy disk | It is active, and its tooltip reads `Salvează` |
| 5 | Presses it | The form is read-only again (← and the pencil); the property's „Poreclă" is `TC-ICON-02 Teren modificat` |
| 6 | Opens the property as usual (`/properties/<id>`) | Under the form: a floppy disk „Salvează", a bin „Șterge", an X „Anulează" |
| 7 | Moves the mouse over the bin, then presses it | A tooltip `Șterge`; then the question „Ștergeți proprietatea?" with **„Nu"** and **„Da"** — words, no icons |
| 8 | Presses „Da" | „Proprietăți — Listă"; the property is gone (its address answers 404) |

## At the end — leaving things as they were found

Step 8 deletes the property. If a run stops before it, delete `TC-ICON-02 …` by hand.

## Notes from the runs

**2026-10-01 — run 1, `driven` (Slice #37.43).** Driven in the Claude desktop app's browser pane
against `npm run dev` on 3000; this file was written from it. The pane was hidden, so the hovers
were dispatched `pointerover` events and the presses `click()`.
- **The first attempt at deleting found that a read-only record opened from an association list
  cannot be deleted from that screen** („Nu se poate șterge de aici", with „OK") — by design. So
  step 6 opens the property the ordinary way first.
- Steps 1–8 as written: both buttons 38 px; tooltips `Modifică`, `Salvează`, `Șterge`;
  „Poreclă" stored as `TC-ICON-02 Teren modificat`; the question's „Nu" and „Da" carry no icon;
  after „Da", `/properties`, and `GET /api/properties/<id>` 404.

**2026-10-01 — run 2, `confirmed` (Slice #37.43).** Same pane, a new property, against the file
above unchanged.
- Steps 1–5: ← and the pencil, 38 px; `Modifică`; the floppy disk inactive, then active with
  `Salvează`; stored `TC-ICON-02 Teren modificat`; read-only again.
- Steps 6–8: floppy disk, bin, X; `Șterge`; „Ștergeți proprietatea?" with „Nu" and „Da", no icon
  on either; `/properties`, and the property's GET 404.
- Nothing changed between the runs, so the case is confirmed, and `e2e/ui/icon-actions.spec.ts`
  translates it.

**2026-10-01 — `automated`.** `e2e/ui/icon-actions.spec.ts` translates the case with Playwright's
real mouse, and takes #37.43's pictures. Green on its first runner run, `20261001T172458Z-22140`.
