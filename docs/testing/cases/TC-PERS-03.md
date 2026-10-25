# TC-PERS-03 — CNP-ul salvat: nota despre blocare într-un balon, iar o schimbare salvată e refuzată în română

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
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
| 7 | Moves the mouse away and looks at „Nume" (Slice 40.56) | „Nume" sits on the tile with no border, no white fill and no shadow. Its label „Nume" is small (12 px) in Roboto Condensed, grey; the value under it is larger (14 px), darker, in the body font |
| 8 | Moves the mouse over „Prenume", then away | Over it, the white box with the grey border; away, the box is gone again |
| 9 | Looks at the empty „Poreclă", then clicks into it | At rest a dashed grey line under it; in focus the whole box in blue with a soft blue ring |
| 10 | Looks at „Contact", „Act de identitate", „Adresă domiciliu" and „Adresă corespondență" (Slice 40.64) | Each is one line: its title, then in grey „necompletat" — „niciun act înregistrat" on „Act de identitate" — and a button „Adaugă" at the right |
| 11 | Presses „Adaugă" on „Contact" | The tile opens to its six boxes; the cursor is in „Telefon Personal 1" |
| 12 | Presses „Adaugă" on „Adresă domiciliu", then ticks „Adresa de corespondență aceeași cu domiciliul" | „Adresă corespondență" is one line reading „aceeași cu domiciliul" |
| 13 | Presses „Adaugă" on „Act de identitate", writes `01.01.2020` in „Până la", then clicks into „Nume" | „Până la" keeps a red border with the mouse away; „EXPIRAT" beside it |

Steps 14–16 (Slice 40.71) are on a second person, **created through the API** the same way: „Nume" `TC-PERS-03-GOALE`,
„Prenume" `Goale`, „Telefon Personal 2" `0700 000 002`, „Email serviciu" `goale@example.invalid`, no CNP (all invented).
Since 40.71 the first person's empty identity fields are behind „Arată 8 câmpuri goale" too; steps 4 and 9 press it
first.

| # | A person does | And sees |
|---|---|---|
| 14 | Opens the second person and looks at „Contact" | Its two values, then „Arată 4 câmpuri goale" followed in grey by „Telefon Personal 1, Telefon serviciu, Email Personal 1, Email Personal 2"; holding the mouse on the link shows the same names; the four boxes are not drawn |
| 15 | Looks at „Identitate" | „CNP", empty, is drawn; „Arată 8 câmpuri goale" under the tile's fields |
| 16 | Presses „Arată 4 câmpuri goale", writes in „Telefon serviciu" and clears it again | All six boxes and no link; „Telefon serviciu" stays; „Identitate" still ends in its own link |

## At the end — leaving things as they were found

Leave the person without saving (navigate away, discarding the change), then delete it
(`DELETE /api/people/<id>`). Căutare globală for `TC-PERS-03` finds nothing.

## Notes from the runs

**2026-10-25 — Slice 40.72.** A saved person reads as text. Steps 1–9 happen with „Identitate" opened by „Editează"
(an open tile shows every field); after step 9 „Renunță" puts it back, so step 11's „Adaugă" opens „Contact"
without „Modificări nesalvate" asking, and „Adrese" is put back the same way before step 13. Steps 14–16 read the
values as text; step 16's box is typed into after „Editează" on „Contact".

**2026-10-25 — steps 14–16 added (Slice 40.71).** A partly filled tile's empty fields behind „Arată N câmpuri goale",
the CNP always shown. Written from the slice's own change and added to the spec; not driven by hand first. Delete the
second person at the end as the first.

**2026-10-25 — steps 10–12 added, step 10 became 13 (Slice 40.64).** Empty tiles as one line, „Adaugă" opening
one with the cursor in its first box, the ticked correspondence box. Written from the slice's own change and added to
the spec; not driven by hand first.

**2026-10-25 — steps 7–10 added (Slice 40.56).** Calm fields, and a label told apart from its value. Written from the
slice's own change and added to the spec, which reads the computed style; not driven by hand first.

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

**2026-10-02 — `automated`.** `e2e/person/cnp-lock-bubble.spec.ts` translates the case with
Playwright's real mouse and keyboard and takes #37.50's pictures. Green on its first runner run,
`20261002T130624Z-14261` on `2a28142` (the spec alone, with lint and tsc; jest
`20261002T130839Z-21933`, 204 suites).
