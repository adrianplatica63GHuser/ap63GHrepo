# TC-VL-03 — Un rol într-un singur panou: un tip de act cu „Deține cotă”, apoi rolul ales pe acel tip, cu cotă

| | |
|---|---|
| **Area** | reference-data |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-08 |

## What this proves

Since Slice #38.36 a role is edited in one place. Its panel in „Date de referință → Roluri” holds its
name and converse, the chips saying where it applies (Act, Proprietate, Persoană) and, under Act, the
document types it is offered on, each with its own „Deține cotă”. A type added there, with „Deține
cotă”, makes the role available on documents of that type, with a share. A role that cannot then be
chosen, a share box missing from its row, or a tick that does not stick is the defect this case
exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API**: the role `TC-VL-03 Rol`, with no type and no chip; later, a person
  „Ion TC-VL-03” and a Plan de Amplasament și Delimitare `TC-VL-03 PAD`.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Date de referință” → „Roluri Persoane”, „Editează” on `TC-VL-03 Rol` | The role's panel: the fields, then „Se aplică la” with „Act”, „Proprietate”, „Persoană”, none pressed |
| 2 | Presses „Act”; picks „Plan de Amplasament și Delimitare” in „Adaugă un tip de act”, „Adaugă tipul” | „Rolul nu este oferit încă pe niciun tip de act. Adăugați unul mai jos.”, then the type listed, „Deține cotă” unticked, „nicio legătură” |
| 3 | Ticks „Deține cotă”; opens the role again | The tick stays; „Act” is pressed |
| 4 | Opens `TC-VL-03 PAD`, „Legături” → „Asociază persoană”; types `TC-VL-03`, picks `TC-VL-03 Rol` in „Rol”, ticks Ion, „Asociază selecția” | The row `Ion TC-VL-03 (TC-VL-03 Rol)` with an orange „Cotă” |
| 5 | Opens the role again | „1 legătură” beside „Plan de Amplasament și Delimitare” |

## At the end — leaving things as they were found

Delete the document and the person, then the role (`DELETE` on their routes); the role's document
types go with it.

## Notes from the runs

**2026-10-08 — Slice #38.36, `automated` the same day.** Written with the change and translated into
`e2e/admin/role-panel.spec.ts`, with `TC-E2E-VL-03` names. The runner's run is in #38.36's handover.
