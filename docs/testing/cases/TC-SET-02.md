# TC-SET-02 — „Setări” în patru secțiuni; exemplul unui prag se schimbă odată cu valoarea

| | |
|---|---|
| **Area** | settings |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-08 |

## What this proves

Since Slice #38.40, „Setări” has four sections.
- **„Praguri de timp”**: the ten thresholds in four groups (Tablou de bord, Acte, Persoane, Insigna
  „Nou!”), each with a worked example that follows the value being typed.
- **„Copii de siguranță”**: read-only, the last backup and the last restore drill with its result,
  or a sentence saying they cannot be read from this installation.
- **„AI”**: the model each paid read uses.
- **„Despre”**: version, commit, environment and database, with no credential.

The defects this case exists to catch:
- an example that does not change with the value;
- a section that fails instead of saying it cannot read;
- a password on screen.

## Before you start

- TC-AUTH-01 is green.
- Nothing is created, and no setting is saved.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Setări” | Four sections: „Praguri de timp”, „Copii de siguranță”, „AI”, „Despre” |
| 2 | Reads „Praguri de timp” | Four groups: „Tablou de bord”, „Acte”, „Persoane”, „Insigna „Nou!”” |
| 3 | Reads „Fereastră filtru expiră curând” | Its value, and „Exemplu: Un act apare «expiră curând» cu 30 de zile înainte.” for the value 30 |
| 4 | Types `45` (nothing saved), then „Anulează” | The example reads „… cu 45 de zile înainte.” at once; after „Anulează” the value and the example are back |
| 5 | Reads „Copii de siguranță” | „Ultima copie” and „Ultima probă de restaurare”, with the result — or „Copiile de siguranță nu pot fi citite de aici…” on an installation without them; no button |
| 6 | Reads „AI” and „Despre” | Four uses, each with a `claude-…` model; „Versiune”, „Commit”, „Mediu”, „Bază de date” (a host and a name) |

## At the end — leaving things as they were found

Nothing to put back: step 4 saves nothing.

## Notes from the runs

**2026-10-08 — Slice #38.40, `automated` the same day.** Written with the change and translated into
`e2e/settings/settings-sections.spec.ts`. The runner's run is in #38.40's handover.
