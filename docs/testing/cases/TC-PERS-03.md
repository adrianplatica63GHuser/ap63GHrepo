# TC-PERS-03 — CNP-ul salvat: nota despre blocare într-un balon, iar o schimbare salvată e refuzată în română

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-02 |

## What this proves

Since Slice #37.50 the sentence „CNP-ul nu poate fi modificat odată setat — ștergeți și creați din
nou pentru a-l schimba" is no longer printed under a saved CNP. It is the field's description at
all times, and it shows in a bubble while the mouse is over the CNP or the keyboard focus is in
it; the mouse leaving and Escape put it away. The field stays editable, and a changed CNP is
still refused on save — now in Romanian, with the same sentence, where the database's English
sentence used to reach the screen.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a Natural
  Person, „Nume" `TC-PERS-03`, „Prenume" `Persoană`, „CNP" `1800101420010` (synthetic; its
  check digit is valid) — shown as `Persoană TC-PERS-03`.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900. „The sentence" is `CNP-ul nu poate fi modificat odată setat — ștergeți
și creați din nou pentru a-l schimba`. „The bubble" is the element with role `tooltip`; it is
„shown" when it is painted, „gone" when it is visually hidden — it stays in the document as the
field's description either way.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the person | „CNP" holds `1800101420010`, editable. Under it nothing — no sentence and no ⓘ. The box is named `CNP` and described by the sentence. The bubble is gone |
| 2 | Moves the mouse over the CNP box | The bubble, under the box, reading the sentence |
| 3 | Moves the mouse away | The bubble is gone |
| 4 | Puts the keyboard focus in the CNP (Tab from the field before, or Shift+Tab from the one after) | The bubble, reading the sentence |
| 5 | Presses Escape | The bubble is gone; the focus stays in the CNP |
| 6 | Changes the CNP to `1800101420029` and presses the floppy disk („Salvează") | Under the form, in red, the sentence — in Romanian; „Modificări nesalvate" stays; the person's stored CNP is still `1800101420010` |

## At the end — leaving things as they were found

Leave the person without saving (navigate away, discarding the change), then delete it
(`DELETE /api/people/<id>`). Căutare globală for `TC-PERS-03` finds nothing.

## Notes from the runs

**2026-10-02 — before the change (Slice #37.50).** Step 6 on the code before #37.50 showed the
database's sentence, „CNP cannot be changed once set; delete and recreate the person instead", in
English under the Romanian form. The same for a Judicial Person's CUI („CUI cannot be changed
once set; …").

**2026-10-02 — run 1, `driven` (Slice #37.50).** Driven in the Claude desktop app's browser pane
against `npm run dev` on 3000; this file was written from it. The pane was hidden, so the hover
was a dispatched `pointerover` / `pointerout` with `pointerType: "mouse"`; the keyboard steps
were real key presses (Tab, Shift+Tab, Escape, Ctrl+A and typing); „Salvează" a scripted `click()`.
- Step 1: the value `1800101420010`; the only visible text in the field's label is `CNP`; no
  button in it; `aria-labelledby` → `CNP`, `aria-describedby` → the sentence; the bubble `sr-only`.
- Steps 2–3: painted on the hover, the sentence; gone on leaving.
- Steps 4–5: a programmatic `focus()` is not `:focus-visible` in this pane and did not open it —
  correctly, it is not a keyboard focus; Shift+Tab from „Data nașterii" did (`:focus-visible`
  true, painted); Escape put it away with the focus still in the CNP.
- Step 6: the red line under the form read the sentence in Romanian; „Modificări nesalvate"
  stayed; the stored CNP was still `1800101420010`.
- The person deleted at the end (204); nothing left for `TC-PERS-03`.

**2026-10-02 — run 2, `confirmed` (Slice #37.50).** Same pane, a new person, against the file above
unchanged.
- Step 1: `1800101420010`, editable; only `CNP` visible in the label, no button; named `CNP`,
  described by the sentence; the bubble gone.
- Steps 2–3: shown on the hover, the sentence; gone on leaving.
- Steps 4–5: Shift+Tab from „Data nașterii" into the CNP showed it; Escape put it away, the focus
  still in the CNP.
- Step 6: the red line read the sentence in Romanian; „Modificări nesalvate" stayed; the stored
  CNP still `1800101420010`.
- The person deleted at the end (204); nothing left. Nothing changed between the runs, so the
  case is confirmed, and `e2e/person/cnp-lock-bubble.spec.ts` translates it.
