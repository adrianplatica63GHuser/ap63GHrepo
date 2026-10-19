# TC-SET-02 — „Setări” în patru secțiuni; exemplul unui prag se schimbă odată cu valoarea

| | |
|---|---|
| **Area** | settings |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-08 |

## What this proves

Since Slice #38.40, „Setări” has four sections, and since #38.41 a fifth, first: **„Contul meu”** — the password and the language.
- **„Praguri de timp”**: the thresholds in five groups (Tablou de bord, Acte, Persoane, Insigna
  „Nou!”, and since Slice 39.92 „Fișe”), each with a worked example that follows the value being typed.
  „Fișe” holds „Timp de ținere peste altă fișă” — how long a dragged tile is held over another before that
  one makes room (TC-TILES-24) — typed in seconds with decimals, a comma or a dot.
- **„Copii de siguranță”**: read-only, the last backup and the last restore drill with its result,
  or a sentence saying they cannot be read from this installation.
- **„AI”**: the model each paid read uses.
- **„Despre”**: version, commit, environment and database, with no credential.

The defects this case exists to catch:
- an example that does not change with the value;
- a section that fails instead of saying it cannot read;
- a password on screen;
- a delay with decimals that is refused, rounded, or lost after a reload (39.92).

## Before you start

- TC-AUTH-01 is green.
- Nothing is created. Step 8 saves „Timp de ținere peste altă fișă” and puts the value back at the end.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Setări” | Five sections: „Contul meu”, „Praguri de timp”, „Copii de siguranță”, „AI”, „Despre” |
| 2 | Reads „Praguri de timp” | Five groups: „Tablou de bord”, „Acte”, „Persoane”, „Insigna „Nou!””, „Fișe” |
| 3 | Reads „Fereastră filtru expiră curând” | Its value, and „Exemplu: Un act apare «expiră curând» cu 30 de zile înainte.” for the value 30 |
| 4 | Types `45` (nothing saved), then „Anulează” | The example reads „… cu 45 de zile înainte.” at once; after „Anulează” the value and the example are back |
| 5 | Reads „Copii de siguranță” | „Ultima copie” and „Ultima probă de restaurare”, with the result — or „Copiile de siguranță nu pot fi citite de aici…” on an installation without them; no button |
| 6 | „Detalii” on „AI”, then reads „AI” and „Despre” | Four uses, each with a `claude-…` model; „Versiune”, „Commit”, „Mediu”, „Bază de date” (a host and a name) |
| 7 | Reads „Contul meu” and the sidebar's footer | „Parola nouă” and „Confirmă parola”; „Limba” with „Română” chosen and „English”; the footer holds „Ieșire” alone |
| 8 | In „Fișe”, types `0,1` in „Timp de ținere peste altă fișă” and „Salvează”; then `1,25` and „Salvează”; reloads | `0,1` is refused: „Timpul de ținere peste altă fișă se scrie în secunde, cu cel mult două zecimale, între 0,2 și 10 — de exemplu 1,5.”. With `1,25` the example reads „Exemplu: O fișă trasă peste alta și ținută acolo 1,25 secunde o face pe aceea să alunece în jos, ca să-i facă loc.” before the save; „Salvat cu succes.”; after the reload the box reads `1,25` |

## At the end — leaving things as they were found

Step 8's value is put back as it was before the case (through `PATCH /api/time-frames`); step 4 saves nothing.

## Notes from the runs

**2026-10-19 — Slice 39.92.** Step 2 reads five groups, and step 8 is new: the make-room delay saved with
decimals, and refused outside 0,2–10 s.

**2026-10-12 — Slice #39.17.** „AI” is now a part of „Costuri” and opens collapsed to its estimated
cost, so step 6 opens it with „Detalii” first (TC-SET-04 covers the rest of „Costuri”).

**2026-10-08 — Slice #38.40, `automated` the same day.** Written with the change and translated into
`e2e/settings/settings-sections.spec.ts`. The runner's run is in #38.40's handover.
