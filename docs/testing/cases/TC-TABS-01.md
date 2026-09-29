# TC-TABS-01 — Același act în două ferestre: cealaltă urmează, salvarea învechită e refuzată

| | |
|---|---|
| **Area** | sync |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-09-28 |

## What this proves

A record open in two windows of one browser is safe (Slice #37.21):
- a save in one window shows in the other by itself, when the other has nothing unsaved;
- a window with unsaved edits is **not** reloaded under the user's hands. It says so instead, and
  offers „Reîncarcă";
- a save from that window is **refused**. Nothing is written, and the typed value stays on screen;
- the version history holds exactly the saves that were accepted.

Its spec is `e2e/sync/two-windows.spec.ts`: two pages of one Playwright context are two windows of
one browser. The header of #37.21 asked for that spec at the same time as the case. It was
translated from this file as it stood after the second hand run below, which confirmed it
unchanged.

## The first run, 2026-09-28 (Slice #37.21)

Driven in two tabs of the desktop app's browser pane, on localhost:3000 in Romanian. Every step held
as written, with no correction:
- step 3's reload came by itself;
- steps 6 and 7 showed the sentences quoted below, word for word;
- step 8's history read v 0 (no subject), v 1 `TC-A1`, v 2 `TC-A2`;
- after „Șterge" in A, B said „Această înregistrare a fost ștearsă în altă fereastră." with a link
  to `/documents`.

## The second run, 2026-09-28 (Slice #37.21) — confirmed

Driven again the same way, on a fresh contract, with the file unchanged. Every step held word for
word, and the history read v 0, v 1 `TC-A1`, v 2 `TC-A2`. So the case is `confirmed`, and with its
spec green in the test runner's `full` it is `automated`.

## Before you start

- TC-DOC-01 is green.
- A Contract de Vânzare „TC-TABS-01 Contract de test" exists, with „Etichetă scurtă" only. It is
  made through `POST /api/documents` and removed at the end.
- Two windows of the same browser, side by side:
  - **A** at `/documents/<id>`;
  - **B** at `/documents/<id>?readonly=true`, which is where „Vizualizare" on an association row
    goes. Ctrl+click on that row opens it in a new tab.

## What Adrian is asked for

Nothing.

## Shared state — what the case writes, and what it cannot give back

The contract and its two extra versions, all removed with „Șterge" → „Da" at the end.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens A and B as above | Both show the contract at „v 0". B is read-only, with „Modifică" |
| 2 | In A: „Subiect" `TC-A1`, „Salvează" | A: „v 1", „2 versiuni" |
| 3 | Looks at B, touching nothing | B has reloaded itself: „Subiect" reads `TC-A1` |
| 4 | In B: „Modifică", „Subiect" `TC-B`, not saved | „Modificări nesalvate" in B |
| 5 | In A: „Subiect" `TC-A2`, „Salvează" | A: „v 2", „3 versiuni" |
| 6 | Looks at B | B was not reloaded; `TC-B` is still in „Subiect". Under the banner, in red: „Această înregistrare a fost salvată în altă fereastră. Modificările de aici nu sunt salvate, iar salvarea lor va fi refuzată." and „Reîncarcă" |
| 7 | In B: „Salvează" | „Nu s-a salvat nimic: înregistrarea a fost salvată între timp în altă fereastră sau de alt utilizator. Valorile introduse au rămas pe ecran." `TC-B` is still there |
| 8 | Opens the version history (◀ in A, or `GET /api/documents/<id>/versions`) | Exactly v 0, v 1, v 2, and v 2 reads `TC-A2`. B's `TC-B` is in none of them |
| 9 | In B: „Reîncarcă" | „Reîncărcați înregistrarea?", with „Valorile introduse și nesalvate se pierd; se încarcă versiunea curentă." Then „Reîncarcă": B shows `TC-A2` |
| — | At the end: „Șterge" → „Da" in A | B, if left open, says „Această înregistrare a fost ștearsă în altă fereastră." with „Înapoi la listă" |
