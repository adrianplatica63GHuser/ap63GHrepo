# AI reading score — Contract de Vânzare

**How to add a contract:** copy its pages, unrenamed, into a new folder
`C:\dev\TEST.DATA\Test.Claude\ai-corpus\cvc\cvc-NN\pages\`, and write the answer key
`cvc-NN\expected.json` in the shape of the others. Mark it `proposed` until Adrian has checked it
against the paper; then mark it `confirmed`.
**How to add a document type:** make a sibling folder under `ai-corpus\` (for example `ci\`), give
it contracts in the same shape, and add one line to `CORPUS_TYPES` in `scripts/testing/ai-score.ts`
that maps the folder name to the type's key.
**How to run it:** `bash scripts/test-runner/claude.sh request ai-score cvc 10` does ten paid reads.
`… request ai-rescore cvc` scores the saved answers again against today's keys, with no reads.

Nothing on this page comes from a deed. The corpus and its answer keys hold real people's names,
so they live outside git. Each run's values stay in that run's own folder,
`ai-corpus\cvc\_runs\<stamp>\`. The comparison rules are at the top of `src/lib/ai-score/score.ts`.

## What is scored

The corpus is ten contracts, 2–5 page scans each, from `flotante` and `CLINCENI.3`:

| Variety | Contracts |
|---|---|
| Sellers | one seller in 6 contracts, several in 4 |
| What is sold | part of a larger parcel in 4, a whole parcel in 6 |
| Currency | lei after 2005 in 4, old lei before 2005 in 4, euro in 2 |
| Later act | one has a later completion („încheiere de completare"), one a rectification |

**Two gaps.** No born-digital PDF was found, and no contract with a separate act adițional. That
is FU-235.

The fields come from the CVC form (`migration_085`):
- the form's own fields: `nrDocument`, `dateDocument`, `pretTotal`, `monedaPret`, `starePlata`,
  `modalitatePlata`, `marcajCarteFunciara`, `impozitTransfer`, `onorariuNotarial` and
  `taxaTimbruPublicitate`;
- sellers and buyers, scored as a set per role, plus each share the deed states;
- the parcel's tarla, parcelă, land-book number and area. The form has no fields for these, so they
  are scored where the model has to put them: `unmappedRaw` or `subject`.

That comes to 171 items over the ten contracts.

**The one number** is the micro average: correct items divided by all items.

## Noise: how far the score moves when nothing changes

Runs 1–3 share one commit, prompt and answer keys. On the nine contracts all three runs could
parse, the score was **91.6 %, 89.7 % and 90.3 %**.
- Between two such runs, **6 or 7 of 155 items change**. Most of those are the land book and the
  area, which the model sometimes leaves out of `unmappedRaw`.
- **Treat a change of 2 points or less as noise.**

**One answer in the thirty was not JSON.** It had an unescaped quote inside a value, and it was
cvc-01 in run 1. The application answers that with a 502 and gets no fields, so the scorer counts
every item of that contract as missed. That is what put run 1 at 83.0 %.
- At this rate, **a run can drop by up to about 9 points because of one contract**, for a reason
  unrelated to how well the model reads.
- When a run's notes say „the answer was not JSON", compare it on the contracts that did parse.
- FU-234 is the fix.

## History

Each row is one run. „Confirmed" is the number over the keys Adrian has confirmed, and it is the
baseline. „All" also counts the keys that are still only proposed.

| Date | Commit | Prompt | Keys confirmed | Confirmed | All (10) | Reads | Note |
|---|---|---|---:|---:|---:|---:|---|
| 2026-09-26 | `3a5d77c` | `8792170fe289` | 0 | — | 83.0 % | 10 | Run 1, the proving run. Its first scoring was wrong (0 % on both party roles) and was fixed in `46d24a6`; this row is the rescore. cvc-01 was not JSON and counts as zero. |
| 2026-09-26 | `f0a24e2` | `8792170fe289` | 0 | — | **90.1 %** | 10 | Run 2, the provisional baseline |
| 2026-09-26 | `f0a24e2` | `8792170fe289` | 0 | — | 90.1 % | 10 | Run 3, the repeat. It has the same total as run 2, but 6 items differ. |

**The baseline is provisional.** No answer key had been confirmed when these runs were made. Once
Adrian confirms keys, `ai-rescore` re-scores all three runs without new reads. Its numbers go in a
new row, and that row is the baseline.

## Per field, runs 2 and 3

Weakest first. These fields are where the next prompt slice starts.

| Field | Run 2 | Run 3 |
|---|---:|---:|
| `shares` | 11/16 | 11/16 |
| `marcajCarteFunciara` | 6/10 | 7/10 |
| `land.carteFunciara` | 4/5 | 3/5 |
| `starePlata` | 8/10 | 8/10 |
| `taxaTimbruPublicitate` | 9/10 | 8/10 |
| `modalitatePlata` | 9/10 | 9/10 |
| `nrDocument` | 9/10 | 9/10 |
| `onorariuNotarial` | 9/10 | 9/10 |
| `land.suprafataMp` | 9/10 | 10/10 |
| `dateDocument`, `impozitTransfer`, `pretTotal`, `monedaPret`, `land.tarla`, `land.parcela`, `parties.Vânzător`, `parties.Cumpărător` | 10/10 each | 10/10 each |

**Some misses may be wrong keys rather than wrong readings.**
- For `marcajCarteFunciara`, the model says `NEDEFINITIVA` where the key says `FARA_CF`, on deeds
  whose buyer undertakes to register in a temporary land book that does not exist yet.
- For `starePlata`, the model says `ACHITAT_INTEGRAL` where the key says `ACHITAT_ANTECONTRACT`.

Each case is a question in its contract's key. Adrian's answers can move these fields in either
direction.

**The share misses are one pattern.** The model reads who bought, but not a share given in m²
(„2 500 m² din 5 000 m²"). In one contract it also missed a percentage.
