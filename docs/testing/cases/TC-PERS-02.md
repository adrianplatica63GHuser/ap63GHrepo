# TC-PERS-02 — Persoană juridică creată și modificată

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-02 |

## What this proves

A company can be created by typing into the form, found in its list by name and by CUI,
opened, and changed — and the change is recorded as a new version. It is the twin of
TC-PERS-01, with a CUI where the natural person has a CNP. The record this creates is the
one TC-ASSOC-06 makes the owner of a property.

## Before you start

- TC-AUTH-01 is green.

## What Adrian is asked for

Nothing.

## The record this case creates

**„Denumire" is `TC-PERS-02 Firmă de test SRL`**, „Tip" is „SRL", and **„Nr. înregistrare
(CUI)" is `0000000002`**.

**The CUI is synthetic and belongs to nobody**: a real CUI never starts with a zero. The form
does not validate the CUI at all — any text is accepted — so nothing about the paperwork had
to be decided. No CUI, name or address is copied out of the archive.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Presses „Persoane Juridice" in the left sidebar | The heading „Persoană juridică", no „Grupuri" filter (#37.71), a search box („caută după cod, nume, poreclă sau ID"), a button „Adaugă persoană juridică", and a table headed DENUMIRE · PORECLĂ. **There is no CUI column** in a browser that has never chosen one, no „Importanță" or „Relevanță", and a button „Câmpuri afișate 0/4" (#37.60, #37.71) |
| 2 | Presses „Adaugă persoană juridică" | **Straight to** „Persoană juridică nouă" at `/judicial-persons/new` — no chooser dialog, as for natural persons. Its sections are „PERSOANĂ JURIDICĂ", „PERSOANE DE CONTACT", „ADRESĂ SEDIU SOCIAL", a checkbox „Aceeași cu adresa sediului social", and „ADRESĂ CORESPONDENȚĂ" |
| 3 | Types `TC-PERS-02 Firmă de test SRL` into „Denumire" | The value appears. „Denumire" is the only required field |
| 4 | Chooses „SRL" in „Tip" | The select offers „—", „Consiliu Local", „Instituție", „SRL", „SA", „SRL-D", „PFA", „II", „IF", „ONG", „Altele" |
| 5 | Types `0000000002` into „Nr. înregistrare (CUI)" | The value appears. Nothing checks its shape |
| 6 | Scrolls to the bottom and presses „Salvează" | **The screen returns to the list**, not to the new company |
| 7 | Looks at the top of the list | A row badged **„Nou!"**, with a code beginning `JPERS`, „DENUMIRE" `TC-PERS-02 Firmă de test SRL`, „PORECLĂ" „—" |
| 8 | Types `0000000002` into the list's search box | The row is still there — the search matches the CUI, which is what the placeholder's „ID" means. `0000000003` empties the list („Nu există persoane juridice") |
| 9 | Replaces the search with `TC-PERS` and presses „Deschide" on the row | The company's own screen, headed `TC-PERS-02 Firmă de test SRL`, with **„v 0"** and the row of tiles (#37.18) — „Identitate" (#37.89; „Persoană juridică" before), „Persoane de contact", „Adrese" and „Interacțiuni" (#37.89) ticked, „Corelate" (#37.67: „Persoane corelate", „Proprietăți" and „Acte" in one), „Clasificări" and „Conexiuni" not, „Toate", „Implicit" — **no „Persoane" tile**, unlike a property. the `JPERS…` code stands in the corner of „Persoană juridică" („ID sistem"), not in a field, and under the CUI the hint „CUI-ul nu poate fi modificat odată setat — ștergeți și creați din nou pentru a-l schimba" |
| 10 | Types `TC-PERS-02 editat` into „Poreclă" and presses „Salvează" at the bottom | **The screen stays on the company**, unlike step 6. The header now reads **„v 1"** with the chip **„2 versiuni"**, and „Poreclă" holds `TC-PERS-02 editat` |

## At the end — leaving things as they were found

**This case leaves one company behind, on purpose** — TC-ASSOC-06 uses it. Remove it after
that: open it from „Persoane Juridice", press „Șterge" at the bottom of the form, and answer
the dialog „Ștergeți persoana juridică?" with **„Da"**. The list comes back „Nu există
persoane juridice". A company still linked to a property must be dissociated first.

## Notes from the runs

**2026-10-03 — Slice #37.67: „Persoane corelate", „Proprietăți" and „Acte" are one tile, „Corelate".** Step 9 reads six tile boxes, not eight. The spec follows.

**2026-09-30 — `automated`, green (Slice #37.29).** Labels above their boxes and every tile on the width unit: the spec checks the unit grid at 1366, 1920 and 2560 px and photographs the new company, the saved one and „Toate". Green in the test runner's `full` `20261001T004412Z-9331` on `f872ab3` (e2e 38 passed). Step 9's „tabs" were the tile row since #37.18; the step now says so.

**2026-09-25 — `automated` (Slice #36.18).** Green in the test runner's whole `npm run e2e`,
result `20260925T201927Z-23319` on `1493c18` (21 tests); the spec is named in the catalogue's `Spec` column.

**2026-09-25 (Slice #36.18) — `confirmed`: the file held line for line.** `JPERS01899`,
„Nu există persoane juridice" → „Se afișează 1 din 1"; `0000000002` found it and `0000000003`
emptied the list; „Deschide" showed „v 0" and the CUI hint; the edit stayed on the company at
„v 1" / „2 versiuni". Left for TC-ASSOC-06, then removed with „Șterge" and „Da". Only this
section was written; the spec is `e2e/person/company-create-edit.spec.ts`.

**2026-09-23 — driven for the first time, green (Slice #36.08). Result `JPERS01716`**, and the
list went from „Nu există persoane juridice" / „Se afișează 0 din 0" to „Se afișează 1 din 1";
the edit took it from „v 0" to „v 1" / „2 versiuni". Removed afterwards with „Șterge" and „Da".

Written from the code before the run, and corrected by it:

1. **The list has no CUI column** — `judicialPerson.table.cui` exists in `messages/ro-RO.json`
   and is not rendered. The search box does match the CUI (step 8), so a CUI is findable but
   not visible in the list.
2. **Create returns to the list; edit stays on the record.** Two saves on one form, two
   destinations, and a spec needs to know which.
3. **The company screen has no „Persoane" tab.** People reach a company through „Persoane de
   contact", or through „Corelate" (#37.67; „Persoane corelate" before, „Asocieri" before #37.29).

**Noticed, not fixed: the CUI lock is only a sentence.** In edit mode the hint says the CUI
cannot be changed once set, but the input is neither `readOnly` nor `disabled` (checked in the
page on this run) and `PATCH /api/judicial-persons/[id]` has no check on it either. The natural
person's CNP carries the same hint on the same kind of field. The case does not change the CUI,
so it does not depend on which way this is decided. In the 36.08 handover.

**2026-10-02 — Slice #37.57 (the system ID in one place).** The record's code (PPERS/JPERS/PROP/DOC…) now stands only in the corner of its first panel (TC-SYSID-01); the lists, the pickers, the association tables, Căutare globală and the relation chips no longer show it — a related record is named by its name or title. The steps above that read a code or a „Cod" column were rewritten to match, the search boxes' placeholders („Cod…", „caută după cod…") unchanged — they still search by code. The spec follows, green in the runner's full `20261002T222558Z-906`.

**2026-10-02 — Slice #37.60 (the two persons' lists).** The Judicial Persons list gained
„Câmpuri afișate", offering Tip, Nr. înregistrare (CUI) and Nr. registru comerțului; step 1 now
reads its button, `0/3` in a browser that has never chosen. The CUI column is still absent until
it is ticked. The spec follows, green in the runner's full `20261003T013901Z-21163`.

**2026-10-02 — Slice #37.63 (META INFO in two).** The „META INFO" tile is two tiles now, „Clasificări" (Importanță, Relevanță, Proveniență) and „Conexiuni" (Etichete / Cuvinte cheie,
Grupuri, Ștampile, Vezi și); each item's explanation is a bubble on its title. Step 9 reads the two, and its spec counts eight boxes. The notes
above keep the old name, as they were run.

**2026-10-03 — Slice #37.71 changed what step 1 reads.** The Judicial Persons list has no „Grupuri"
filter any more, and „Câmpuri afișate" offers four fields („Persoană de contact" the fourth), so it
reads `0/4`. Step 1 now says so and `e2e/person/company-create-edit.spec.ts` follows; TC-PERS-06
drives the list's new shape.

**2026-10-05 — Slice #37.89.** The company's first tile is „Identitate", as the Natural Person's is, and a fourth box, „Interacțiuni", stands at the right of the bar, ticked by default. Step 9 reads seven tile boxes. The spec follows.
