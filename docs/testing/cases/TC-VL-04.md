# TC-VL-04 — Un tip de act pe pagina lui: General, Formular, Roluri; un rol bifat aici apare în panoul rolului

| | |
|---|---|
| **Area** | reference-data |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-08 |

## What this proves

Since Slice #38.39 a document type opens on a page of its own,
`/admin/value-lists/document-types/<code>`, with three tabs:
- **General**: the name, the short name, and the code, read-only.
- **Formular**: the form.
- **Roluri**: the roles the type accepts, each with „Deține cotă”.

The roles are the same pairs the role's panel edits (TC-VL-03), so a role added here, with its tick,
is on that role's panel. The defects this case exists to catch:
- a type that cannot be opened from the list;
- an editable code;
- a role that does not appear on the other side;
- a tick that does not stick.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API**: a document type `TC-VL-04 Tip` (its code is generated from the name)
  and a role `TC-VL-04 Rol`, with no type.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Date de referință” → „Tipuri de Document”, „Deschide” on `TC-VL-04 Tip` | The type's page, its name as the heading |
| 2 | Looks at the tabs | „General”, „Formular”, „Roluri”; „General” open: „Denumire” `TC-VL-04 Tip`, „Denumire scurtă”, „Cod” read-only with „Codul nu se schimbă…” under it, „Stare” |
| 3 | Opens „Formular” | „Acest tip nu are încă formular.” and „Creează formularul” |
| 4 | Opens „Roluri”; picks `TC-VL-04 Rol` in „Adaugă un rol”, „Adaugă rolul”; ticks „Deține cotă”; reloads | „Acest tip nu oferă încă niciun rol. Adăugați unul mai jos.”, then the role listed, unticked; after the tick and the reload it is still ticked |
| 5 | Opens „Roluri Persoane” in „Date de referință”, „Editează” on `TC-VL-04 Rol` | Under „Tipuri de act”, `TC-VL-04 Tip` with „Deține cotă” ticked |

## At the end — leaving things as they were found

Delete the type, then the role (`DELETE` on their routes); the pair goes with them.

## Notes from the runs

**2026-10-08 — Slice #38.39, `automated` the same day.** Written with the change and translated into
`e2e/admin/document-type-page.spec.ts`, with `TC-E2E-VL-04` names. The runner's run is in #38.39's
handover.
