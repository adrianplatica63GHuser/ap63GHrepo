# TC-HELP-01 — Text de ajutor scris pentru un ecran și citit în spatele „?”

| | |
|---|---|
| **Area** | help |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-25 |

## What this proves

Help written on „Informații de ajutor" for a screen is what that screen's „?" shows, as soon as
it is saved — and the text it replaced can be put back exactly.

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
- The text it holds, which the case puts back — two paragraphs with **one empty line** between
  them:

```
Etichetele se adaugă din fila META INFO a unei înregistrări, una câte una.

Descriere completă: Manualul utilizatorului, capitolul 6.4.
```

Restoring the text leaves one trace: the row's `updated_at` moves to the day of the run. The
text itself is identical.

**If a run is abandoned:** open „Informații de ajutor" → „Administrare — Etichete", paste the
text above into „Cum se folosește (Română)" — empty line included — and press „Salvează". If the
text above ever stops being the stored one, the case file is updated first.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Admin-Configurare" → „Informații de ajutor" | The heading „Informații de ajutor", two tabs „Ecrane" and „Sfaturi rapide", and the list of screens, each with „Complet" |
| 2 | Presses „Administrare — Etichete" | Four fields — „Context (Engleză)", „Context (Română)", „Cum se folosește (Engleză)", „Cum se folosește (Română)" — „Salvează", and „Previzualizare", which shows each field under its own heading |
| 3 | Notes the text in „Cum se folosește (Română)" and checks it is the text above | It is |
| 4 | Replaces it with `TC-HELP-01 — text de ajutor scris de cazul de test.` | „Previzualizare" follows as it is typed |
| 5 | Presses „Salvează" | „Salvat" |
| 6 | Opens „Admin-Configurare" → „Etichete" and presses „?" at the right of the breadcrumb bar | A panel „Ajutor" with „×": „Context" — the Romanian context, unchanged — and „Cum se folosește" — **`TC-HELP-01 — text de ajutor scris de cazul de test.`** |

Step 6 is the other end: what is written on the help screen is what the screen's „?" says.

## At the end — leaving things as they were found

Back on „Informații de ajutor" → „Administrare — Etichete", put the text above back into „Cum se
folosește (Română)", empty line included, and press „Salvează". On „Etichete", „?" shows the
original sentence again.

## Notes from the runs

**2026-09-25 — driven for the first time, green (Slice #36.21).** The text was restored through
the screen, and all four stored fields were then compared with the ones read before the run:
identical.

**What the run found, and fixed in the same slice (FU-227).** For the first seconds after the
screen opens, every screen in the list read **„Lipsă"** — the badge treated „not loaded yet" as
„missing". Worse, a screen picked in those seconds opened its editor **empty**, and the editor
does not refill when the list arrives, so „Salvează" would have written blanks over the stored
help. The badge now waits for the list, and the editor is re-seeded once the list has loaded
(`help-content-hub.tsx`). Step 1's „Complet" is read after the list has loaded.
