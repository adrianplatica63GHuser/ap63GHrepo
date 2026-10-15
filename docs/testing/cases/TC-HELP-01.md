# TC-HELP-01 — Text de ajutor scris pentru un ecran și citit în spatele „?”

| | |
|---|---|
| **Area** | help |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-09-26 |

## What this proves

Help written on „Informații de ajutor" for a screen is what that screen's „?" shows, as soon as
it is saved — and the text it replaced can be put back exactly. Since #39.40, too: the „?" panel's
„Vezi în manual" opens the manual at the screen's section, and a text proposed from the manual is
offered beside the screen's own, accepted with „Acceptă", and offered again once the text is put back.

## Before you start

- TC-AUTH-01 is green.

## What Adrian is asked for

Nothing.

## Shared state — the text is replaced, then put back byte for byte

Help is seen by every user. The header asked for a screen whose help is empty if one exists; on
2026-09-25 **none does** — all thirty screens have text (`GET /api/admin/help-content`, thirty
rows, none blank). So the case changes **one field of one screen** and restores it:

- Screen: **„Administrare — Etichete"** (screen key `admin-tags`) — an administrator's screen,
  so the fewest people see it while the case runs.
- Field: **„Cum se folosește (Română)"**. The other three are not touched.
- The text it holds is **read at the start and put back at the end**, all four fields, byte for
  byte. Until #39.40 this file quoted it; it no longer does, because the text is Adrian's and the
  screen now offers him a proposal to replace it — the case must pass on whichever text he keeps.
  On 2026-10-15 it was still the August text, which ends „Descriere completă: Manualul
  utilizatorului, capitolul 6.4."
- Steps 8–11 change **all four fields** — „Acceptă" writes the proposal — and put them back the
  same way.

Restoring the text leaves one trace: the row's `updated_at` moves to the day of the run. The
text itself is identical.

**If a run is abandoned:** the spec puts the text back in a `finally`, so an abandoned spec run
has already done it. An abandoned run by hand: note the four fields before step 4, and paste them
back through the screen.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Ajutor și învățare" → „Informații de ajutor" (#39.37: was under „Administrare") | The heading „Informații de ajutor", two tabs „Ecrane" and „Sfaturi rapide", and the list of screens, each with „Complet" — except a screen whose help Adrian has still to write, which may read „Lipsă": today „Interacțiuni — Istoric" (#38.84) |
| 2 | Presses „Administrare — Etichete" | Four fields — „Context (Engleză)", „Context (Română)", „Cum se folosește (Engleză)", „Cum se folosește (Română)" — „Salvează", and „Previzualizare", which shows each field under its own heading |
| 3 | Notes the text in „Cum se folosește (Română)" | The stored text |
| 4 | Replaces it with `TC-HELP-01 — text de ajutor scris de cazul de test.` | „Previzualizare" follows as it is typed |
| 5 | Presses „Salvează" | „Salvat" |
| 6 | Opens „Administrare" → „Etichete" and presses „?" at the right of the breadcrumb bar | A panel „Ajutor" with „×": „Context" — the Romanian context, unchanged — and „Cum se folosește" — **`TC-HELP-01 — text de ajutor scris de cazul de test.`** |

| 7 | Under the panel's text, presses „Vezi în manual: §12.3.3 Etichetele" (#39.40; the number is the manual's current one) | The manual opens at „Etichetele", and the address reads `/manual?s=admin-groups-tags` |

Step 6 is the other end: what is written on the help screen is what the screen's „?" says.

### A proposal accepted, then put back (#39.40)

Runs only while „Administrare — Etichete" is marked „Propunere" — while its text is still the
one the proposal was written against. Once Adrian has accepted or rewritten it, there is nothing
to accept, and the spec skips these steps and says why.

| # | A person does | And sees |
|---|---|---|
| 8 | Opens „Informații de ajutor" | „Administrare — Etichete" carries „Propunere" beside „Complet", and above the list „N de ecrane au un text propus din manual — le găsiți marcate „Propunere"." |
| 9 | Presses „Administrare — Etichete" | „Un text propus pentru acest ecran": „Textul de acum" and „Propunerea" side by side, field by field — the current text the one noted; „Acceptă", „Editează", „Nu acum" |
| 10 | Presses „Acceptă" | „Propunerea a fost salvată ca text al ecranului."; the proposal and the mark „Propunere" are gone, and the four boxes hold the proposal |
| 11 | Opens „Etichete" and presses „?" | The panel shows the proposal's „Context" |

At the end of steps 8–11: the four fields put back as they were read, and „Administrare —
Etichete" is marked „Propunere" again — the text is once more the one the proposal answers.

## At the end — leaving things as they were found

Back on „Informații de ajutor" → „Administrare — Etichete", put the text above back into „Cum se
folosește (Română)", empty line included, and press „Salvează". On „Etichete", „?" shows the
original sentence again.

## Notes from the runs

**2026-10-15 — Slice #39.40.** Step 3 no longer pins the text (see „Shared state"); step 7 and steps 8–11 added with the slice that built them, and written into the spec in the same commit. They were run by the test runner, not by hand: the case stays `automated`, and the #39.40 handover says so.

**2026-09-26 — `automated` (Slice #37.02).** Its spec is named in the catalogue's `Spec` column; green in the test runner's e2e runs of the slice, and in its `full` run (the #37.02 handover quotes the ids).

**2026-09-26 — driven a second time, unchanged, green (Slice #37.02) → `confirmed`.** Every screen „Complet" once loaded, none „Lipsă"; the sentence written, read behind „?" on „Etichete", the text put back through the screen, and all four stored fields compared with the ones read before the run: identical.

**2026-09-25 — driven for the first time, green (Slice #36.21).** The text was restored through
the screen, and all four stored fields were then compared with the ones read before the run:
identical.

**What the run found, and fixed in the same slice (FU-227).** For the first seconds after the
screen opens, every screen in the list read **„Lipsă"** — the badge treated „not loaded yet" as
„missing". Worse, a screen picked in those seconds opened its editor **empty**, and the editor
does not refill when the list arrives, so „Salvează" would have written blanks over the stored
help. The badge now waits for the list, and the editor is re-seeded once the list has loaded
(`help-content-hub.tsx`). Step 1's „Complet" is read after the list has loaded.

**2026-10-14 — Slice #39.37.** „Informații de ajutor" moved to the new section „Ajutor și învățare", its address unchanged; step 1 opens it from there, and the spec follows. The list of screens gains „Ajutor și învățare — Manual de utilizare", whose help #39.37 wrote, so it reads „Complet" like the rest.

**2026-10-06 — Slice #38.20.** The sidebar is nine sections now; the way to this screen reads „Administrare" → „Informații de ajutor" and „Administrare" → „Etichete". The screen and every step on it are unchanged, and the spec follows (`e2e/helpers/sidebar.ts` opens the section that holds an item).
