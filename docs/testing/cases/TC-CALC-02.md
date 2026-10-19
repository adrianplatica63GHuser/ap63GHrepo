# TC-CALC-02 — „Calcul drum lateral" de la o proprietate din arhivă: trei proprietari, 99,99%, drum de 4 m, create

| | |
|---|---|
| **Area** | calculation |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-18 |

## What this proves

Slice #39.79: „Calcul drum lateral" starts from a property already in the archive, found by search, and refuses one
that does not have exactly four corners — one with none is not even offered. The owners are persons already in the
archive, natural or juridical, each found by search, each with a badge in its own colour and a share with at most two
decimals. The shares must add up to 100% or 99,99%, and the road must be narrower than 15 m. Every refusal is said
on the screen, and „Împarte proprietatea" stays off until there is none. Then today's screen takes over: the road,
„Creează proprietățile" — each owner's new property linked to its owner as „Proprietar" — and the run, which names
the property and re-runs on the corners it stored. The property divided is left as it was.

## Before you start

- TC-AUTH-01 is green, with full access. The window is 1920 × 1080; the language is Română.
- Three properties: `TC-CALC-02 Teren`, with TC-PROP-03's four corners numbered 16–19; `TC-CALC-02 Cinci colțuri`,
  the same with a fifth corner, 20, on the side 19–16; `TC-CALC-02 Fără colțuri`, with none.
- Three persons: the natural persons `TC-CALC-02 Ana` and `TC-CALC-02 Bogdan`, and the company `TC-CALC-02 Firma SRL`.

## What Adrian is asked for

Nothing. The figures are TC-CALC-01's parcel (611,87 m²), checked there.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Instrumente" → „Calcul drum lateral" | „Calcul drum lateral"; „Împarte proprietatea" is off |
| 2 | In „Caută proprietatea" types `TC-CALC-02`; chooses `TC-CALC-02 Cinci colțuri` | `TC-CALC-02 Fără colțuri` greyed out, saying „fără colțuri", and not choosable; after the choice „Datele nu pot fi folosite:" and „Proprietatea are 5 colțuri; trebuie să aibă exact 4."; the button stays off |
| 3 | Finds and chooses `TC-CALC-02 Teren` | „… TC-CALC-02 Teren — 4 colțuri"; no refusal |
| 4 | In „Caută un proprietar" finds and adds Ana by her code (`PPERS…`), Bogdan by his name's words reversed and in lower case, and the company by its name | Three rows, each with a badge in its own colour — blue, green, amber — and a „Cota-parte" box; still no refusal |
| 5 | Types `33,33`, `33,33`, `31,34`; then `33,333` for the company; then `33,33` | „Cotele-părți însumează 98,00%; trebuie să fie 100% sau 99,99%."; then „Cota-parte a lui TC-CALC-02 Firma SRL („33,333”) nu se poate citi: …"; then nothing — the button still off, there is no width |
| 6 | „Lățime drum" `15`; then `4` | „Lățimea drumului este 15 m; trebuie să fie peste 0 și sub 15 m."; then no refusal, and „Împarte proprietatea" on |
| 7 | Opens „Persoane fizice", then „Instrumente" → „Calcul drum lateral" again | The property, the three owners with their shares and the 4 m road, as they were; „Împarte proprietatea" on |
| 8 | Presses „Resetează", right of „Împarte proprietatea"; opens „Proprietăți" and comes back; then chooses the property, the three owners at `33,33` each and a 4 m road again | The screen empty — no property, no owner, no width, the button off — and still empty after the visit; then „Împarte proprietatea" on |
| 9 | Presses „Împarte proprietatea" | „Pasul 3 — drumul"; above it „PROP… — 3 proprietari, drum de 4 m"; „Suprafața parcelei" **611,87 m²**, „Lățime drum" 4,0 m; three rows; „Cotele însumează 99,99%: ultima felie din ordine …" |
| 10 | „Colțul drumului" 18, „Latura drumului" 18–19 | „Drumul pornește din colțul 18, pe latura 18–19. …" |
| 11 | „Descrierea grupului" reads „Diviz — PROP…"; replaces it with `TC-CALC-02 Grup`, „Poreclă drum" `TC-CALC-02 Drum`; presses „Creează proprietățile" | „S-a creat grupul GRP-… cu următoarele proprietăți:" and four links |
| 12 | Opens each owner's new property | Under its persons, its owner, „Proprietar"; the road's has no one. `TC-CALC-02 Teren` still has its four corners |
| 13 | „Vezi istoricul calculului"; „Re-rulează cu acești parametri" | „Proprietatea împărțită: PROP…"; then „Calcul drum lateral" on the same corners and owners, the road from 18 along 18–19, **611,87 m²** — and no „Modifică datele", because the corners are the run's |

## At the end — leaving things as they were found

„Șterge calculul" on the run; on „Grupuri", „Șterge" on `TC-CALC-02 Grup`; then the four new properties, the three
properties and the three persons, each with „Șterge".

## Notes from the runs

**2026-10-19 — Slice #39.98.** The spec reads the run's id from the commit's answer — the success panel no longer
links to the run — and counts one history button on the screen, the heading's. No step of this case changed.

**2026-10-18 — the owner search and the screen's memory (Adrian, after #39.81).** Step 4 finds owners by code and by
words in any order; steps 7 and 8 are new: the screen keeps what was typed while another screen is open, until
„Resetează". Steps 7–11 became 9–13.

**2026-10-18 — written and automated (Slice #39.79).** `e2e/calculation/side-road-from-property.spec.ts`. It needs
no real maps: the road is laid with the two select boxes, the keyboard's way to the map's two clicks.
