# TC-DOC-28 — Actul de identitate pe ecranul lui: un tile pe tip, VALABIL / EXPIRAT, CNP-ul verificat, tipul schimbat

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-26 |

## What this proves

A document of any of the four identity types (Slice 40.82) shows, on its own screen, one tile „Act de identitate" with
exactly its kind's fields, in the order the card prints them, and the number, the dates and the issuer once — not in
„Identificarea actului" (Slice 40.83). It says VALABIL or EXPIRAT from „Valabil până la", refuses a CNP without its
control digit and warns, without refusing, when the CNP disagrees with Sex. A change between identity kinds names the
values the new kind has no field for and removes them on save; a change to an ordinary type is refused while a value
is held. A new identity document can be made from „Acte".

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites, with invented values only (never a
  real card — `C:\dev\.claude\rules\capture-and-personal-data.md`): four documents titled `TC-E2E-DOC-28 …` — a
  „Carte de Identitate (model nou)" valid until 21.04.2022 with CNP 1850421400123 and Sex F, a „Carte de Identitate
  (model vechi)", a „Pașaport" valid until 2099, a „Pașaport CRDS" with domicile Spania.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the model nou document | „Act de identitate": Seria și numărul, CNP, Sex, Nume, Prenume, Cetățenia, Locul nașterii, Domiciliu, Emisă de, Data eliberării, Valabil până la, MRZ, Nr. card — no Data nașterii; „Identificarea actului" without the number; EXPIRAT; „CNP-ul nu corespunde sexului de pe act." |
| 2 | „Editează" on „Act de identitate"; CNP 1850421400124 | „CNP-ul trebuie să aibă 13 cifre și o cifră de control corectă." |
| 3 | CNP back, Sex M, Prenume „Ionel"; „Salvează"; reloads | the warning gone; Prenume Ionel, Sex M |
| 4 | Opens the model vechi document | Prenumele tatălui, Prenumele mamei, Starea civilă, Lucrătorul care a eliberat-o; no CNP; no VALABIL / EXPIRAT |
| 5 | Opens the Pașaport, then the Pașaport CRDS | VALABIL and Domiciliu — județul Ilfov; Domiciliu — țara Spania |
| 6 | On the model nou: „Editează" on „Identificarea actului", Tip document „Pașaport" | under it: „La salvare se șterg: Domiciliu, Nr. card — noul tip nu are aceste câmpuri." |
| 7 | „Salvează"; reloads | the passport's fields (Codul țării …); Nume kept; no Domiciliu |
| 8 | „Editează" again, Tip document „Adeverință"; „Salvează" | „Actul are date de identitate completate: goliți-le înainte de a-l trece la un tip de document obișnuit." — nothing saved |
| 9 | Tip document back to „Pașaport"; „Renunță" | the tile closes |
| 10 | „Acte" → „Adaugă act", Tip document „Carte de Identitate (model vechi)", Nume „Testescu", „Salvează" | „Act de identitate" empty before; the new document opens with Nume Testescu |

## At the end — leaving things as they were found

Delete the five documents.

## Notes from the runs

**2026-10-26 — Slice 40.83.** Written with the slice's spec, `e2e/document/identity-document.spec.ts`, which drives it
on invented records; promoted without hand runs (`PROMOTED_WITHOUT_DRIVING`).
