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
- Steps 8–14 (#39.52) work on **„Ajutor și învățare — Harta competențelor"** and **„Ajutor și
  învățare — Chestionarul unei competențe"**, whose proposals were written against no text: each is
  emptied, so its proposal is offered again, accepted, and its four fields put back the same way.

Restoring the text leaves one trace: the row's `updated_at` moves to the day of the run. The
text itself is identical.

**If a run is abandoned:** the spec puts the text back in a `finally`, so an abandoned spec run
has already done it. An abandoned run by hand: note the four fields before step 4, and paste them
back through the screen.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Ajutor și învățare" → „Informații de ajutor" (#39.37: was under „Administrare") | The heading „Informații de ajutor", two tabs „Ecrane" and „Sfaturi rapide", and the list of screens, each with „Complet" — none „Lipsă" since #39.52 accepted every proposal |
| 2 | Presses „Administrare — Etichete" | Four fields — „Context (Engleză)", „Context (Română)", „Cum se folosește (Engleză)", „Cum se folosește (Română)" — „Salvează", and „Previzualizare", which shows each field under its own heading |
| 3 | Notes the text in „Cum se folosește (Română)" | The stored text |
| 4 | Replaces it with `TC-HELP-01 — text de ajutor scris de cazul de test.` | „Previzualizare" follows as it is typed |
| 5 | Presses „Salvează" | „Salvat" |
| 6 | Opens „Administrare" → „Etichete" and presses „?" at the right of the breadcrumb bar | A panel „Ajutor" with „×": „Context" — the Romanian context, unchanged — and „Cum se folosește" — **`TC-HELP-01 — text de ajutor scris de cazul de test.`** |

| 7 | Under the panel's text, presses „Vezi în manual: §12.3.3 Etichetele" (#39.40; the number is the manual's current one) | The manual opens at „Etichetele", and the address reads `/manual?s=admin-groups-tags` |

Step 6 is the other end: what is written on the help screen is what the screen's „?" says.

### A proposal accepted, then put back (#39.40; seeded since #39.52)

Since #39.52 every proposal is accepted, so none waits. These steps seed their own: before step 8
the four fields of „Ajutor și învățare — Harta competențelor" are emptied (the PUT „Salvează"
sends), and its proposal — written against no text — is offered again.

| # | A person does | And sees |
|---|---|---|
| 8 | Opens „Informații de ajutor" | „Ajutor și învățare — Harta competențelor" carries „Propunere", and above the list „1 ecran are un text propus din manual — îl găsiți marcat „Propunere"." |
| 9 | Presses „Ajutor și învățare — Harta competențelor" | „Un text propus pentru acest ecran": „Textul de acum" and „Propunerea" side by side, field by field — the current text „—"; „Acceptă", „Editează", „Nu acum" |
| 10 | Presses „Acceptă" | „Propunerea a fost salvată ca text al ecranului."; the proposal and the mark „Propunere" are gone, and the four boxes hold the proposal |
| 11 | Opens „Harta competențelor" and presses „?" | The panel shows the proposal's „Context" |

At the end of steps 8–11: the four fields put back as they were read.

### „Acceptă toate" (#39.52)

Runs only when no proposal waits on the database — the case never accepts a proposal it did not
seed. Before step 12 both „Ajutor și învățare — Harta competențelor" and „Ajutor și învățare —
Chestionarul unei competențe" are emptied.

| # | A person does | And sees |
|---|---|---|
| 12 | Opens „Informații de ajutor" and presses „Acceptă toate (2)" | A confirmation „Acceptați toate propunerile?": „Propunerile se salvează ca texte ale celor 2 ecrane de mai jos. Un ecran al cărui text s-a schimbat între timp este sărit, nu suprascris.", the two screens by name, „Acceptă toate" and „Anulează" |
| 13 | Presses „Anulează" | The confirmation closes; both screens still carry „Propunere", and nothing was saved |
| 14 | Presses „Acceptă toate (2)", then „Acceptă toate" | „2 texte propuse au fost salvate."; the button, the count line and both marks „Propunere" are gone; each screen's four fields are its proposal's |

At the end of steps 12–14: both screens' four fields put back as they were read.

## At the end — leaving things as they were found

Back on „Informații de ajutor" → „Administrare — Etichete", put the text above back into „Cum se
folosește (Română)", empty line included, and press „Salvează". On „Etichete", „?" shows the
original sentence again.

## Notes from the runs

**2026-10-15 — Slice #39.52.** Every proposal was accepted with the new „Acceptă toate", so none waits and steps 8–11, written against „Administrare — Etichete", would only ever skip. They now seed their own proposal on „Harta competențelor" and put its text back; steps 12–14 add „Acceptă toate", seeded the same way on two screens. Step 1 reads „Complet" on every screen. Written into the spec in the same slice and run by the test runner, not by hand, as #39.40's steps were: the case stays `automated`, and the #39.52 handover says so.

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
