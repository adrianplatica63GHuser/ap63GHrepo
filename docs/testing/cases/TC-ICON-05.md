# TC-ICON-05 — O etichetă redenumită cu creionul, două fuzionate, o ștampilă aplicată, cu pictograme

| | |
|---|---|
| **Area** | ui |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-01 |

## What this proves

Since Slice #37.46 the administration screens' buttons are icons. „Redenumește etichetă" is Lucide's
PencilLine before its words (#38.14 — it was the pencil alone on each row of a table that is gone); the domain verbs keep their words beside the
icon — „Fuzionează etichete" and „Fuzionează" with Merge, „Aplică" and „Aplică ștampila (1)"
with Stamp, „Elimină ștampila (0)" with Eraser — the counts staying in the words. They still do
what they did.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites:
  - a Property, „Poreclă" `TC-ICON-05 Teren`, carrying two tags, `tc-icon-05-a` and
    `tc-icon-05-b` (`POST /api/metadata/<principalObjectId>/tags`);
  - a stamp, `TC-ICON-05 Ștampilă` (`POST /api/stamps`).

## What Adrian is asked for

Nothing.

## Steps

An icon is the Lucide one on the button: `pencil-line`, `merge`, `stamp`, `eraser`, `plus`.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Etichete" (`/admin/tags`) | In the cloud, `tc-icon-05-a ×1` and `tc-icon-05-b ×1`; at its top right „Redenumește etichetă" — the pencil-line icon before the words — and „Fuzionează etichete" — the merge icon and the words — both inactive |
| 2 | Double-clicks `tc-icon-05-a` | The chip drawn pressed; „Redenumește etichetă" active, „Fuzionează etichete" still inactive |
| 3 | Presses „Redenumește etichetă", changes the box that replaced the chip to `tc-icon-05-c`, presses Enter | The chips are `tc-icon-05-b` and `tc-icon-05-c`, each used once, neither pressed |
| 4 | Double-clicks `tc-icon-05-b` and `tc-icon-05-c`, presses „Fuzionează etichete", picks „Păstrează aceasta" on `tc-icon-05-c` | Both already ticked in the dialog; „Etichetele „tc-icon-05-b” vor deveni „tc-icon-05-c”."; „Fuzionează" — the merge icon and the word — active |
| 5 | Presses „Fuzionează" | The dialog closes; one chip, `tc-icon-05-c ×1` |
| 6 | Opens „Ștampile" (`/admin/stamps`) | „+ Creare ștampilă" a plus and no words; the stamp's row, „Elemente" 0, „Aplică" — the stamp icon and the word |
| 7 | Presses „Aplică", picks „Tip element": „Proprietate", types `TC-ICON-05` in „Caută în elementele disponibile" | One available element, `TC-ICON-05 Teren`; „Aplică ștampila (0)" (stamp icon and words) and „Elimină ștampila (0)" (eraser and words), both inactive |
| 8 | Ticks `TC-ICON-05 Teren`, presses „Aplică ștampila (1)" | It moves across; „Modificări nesalvate" |
| 9 | Presses the floppy disk („Salvează ștampilele") | „Modificări nesalvate" goes; the stamp's „Elemente" reads 1 |

## At the end — leaving things as they were found

Delete the stamp (`DELETE /api/stamps/<id>`), the tag (`DELETE /api/metadata/<principalObjectId>/tags`
with `tc-icon-05-c`), and the property (`DELETE /api/properties/<id>`).

## Notes from the runs

**2026-10-06 — the cloud alone (Slice #38.14).** „Etichete" has no table: a tag is chosen in the cloud by
a double click, „Redenumește etichetă" renames it in the chip itself, and „Fuzionează etichete" opens
the merge with the chosen tags ticked. Steps 1–5 were rewritten to match (the row pencil and its
tooltip are gone); steps 6–9 are unchanged; the spec follows.

**2026-10-01 — run 1, `driven` (Slice #37.46).** Driven in the Claude desktop app's browser pane
against `npm run dev` on 3000; this file was written from it. The hover was a dispatched
`pointerover`, most presses `click()`, the fields `form_input`; the available element's tick
needed a real click (a scripted `click()` on it left it unticked).
- Steps 1–9 as written: `lucide-pencil-line` with no text, its tooltip `Redenumește`;
  `lucide-merge` on „Fuzionează etichete"; renamed to `tc-icon-05-c`; the merge sentence; one row
  `tc-icon-05-c 1`; `lucide-plus` on „+ Creare ștampilă"; `lucide-stamp` on „Aplică" (a link to
  the stamp's screen); `lucide-stamp` / `lucide-eraser` on the two panel buttons, inactive at
  (0); „Aplică ștampila (1)" moved it, „Modificări nesalvate"; saved; the stamp's
  `memberCount` 1.
- Stamp, tag and property deleted at the end (204, 200, 204); no `tc-icon-05` tag left.

**2026-10-01 — run 2, `confirmed` (Slice #37.46).** Same pane, new records, against the file above
unchanged.
- Steps 1–9 exactly as run 1: the pencil-line with its tooltip `Redenumește`; renamed; the
  merge sentence and one row `tc-icon-05-c 1`; the plus, the stamp on „Aplică"; stamp and eraser
  inactive at (0); „Aplică ștampila (1)", „Modificări nesalvate", saved; `memberCount` 1.
- Stamp, tag and property deleted at the end (204, 200, 204). Nothing changed between the
  runs, so the case is confirmed, and `e2e/ui/icon-admin.spec.ts` translates it.

**2026-10-01 — `automated`.** `e2e/ui/icon-admin.spec.ts` translates the case with Playwright's
real mouse and takes #37.46's pictures. Green on its first runner run, `20261001T193047Z-24594`
(with the stamp, tag, search and group specs), and again on `20261001T193326Z-6186` after the
tag picture learned to paint over every other tag.
