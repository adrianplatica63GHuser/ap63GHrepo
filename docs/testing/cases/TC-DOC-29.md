# TC-DOC-29 — Notariatul ales pe „Identificarea actului” apare în „Legături”, ca „Notar”; schimbat sau golit, îl urmează

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | TC-E2E-DOC-29 (two notary offices and a Contract de Vânzare, created, then removed) |
| **State** | `automated` |
| **Last green** | 2026-11-02 |

## What this proves

Slice 41.53, Adrian (2026-11-02): „On the document identification tile of a document If the user updates the notary
office this update should reflect on the links tile under juridical persons". The office chosen as „Notariat" is a
link in „Legături", role „Notar"; another office replaces it; an empty „Notariat" removes it; the link cannot be
dissociated in „Legături". An office missing from „Legături", two offices after a change, or a link left after
clearing is the defect.

## Before you start

- TC-AUTH-01 is green.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | On an invented Contract de Vânzare, „Editează" on „Identificarea actului", „Notariat" `TC-E2E-DOC-29 Birou A`, „Salvează" | „Legături" → „Persoane juridice": `TC-E2E-DOC-29 Birou A (Notar)` |
| 2 | The same with `TC-E2E-DOC-29 Birou B` | Only `… Birou B (Notar)` |
| 3 | „Dezasociază" on it | Refused: „Biroul notarial se schimbă din „Identificarea actului”." |
| 4 | „Notariat" emptied, „Salvează" | No juridical person in „Legături" |

## At the end — leaving things as they were found

The document and both offices are removed.

## Notes from the runs

**2026-11-02 — Slice 41.53.** Written from the slice's own change with its spec, `e2e/document/notary-in-links.spec.ts`;
step 3 through the route the button calls. Not driven by hand first (`PROMOTED_WITHOUT_DRIVING`).
