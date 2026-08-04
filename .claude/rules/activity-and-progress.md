---
paths:
  - "src/components/**"
  - "src/app/**/_components/**"
---

# Activity cues, progress bars & announced state

<!-- Harvested from the slice log. -->

- **Never use `animate-pulse` for an activity cue.** Tailwind's utility dips opacity to 50% over 2s, which reads as a breath rather than a blink — on a `text-sm text-fade` line it is invisible even at full opacity. Use `.ga-cue-blink` (`@keyframes ga-cue-blink` in `globals.css`, 0.2 opacity at 1s) together with `text-cta font-medium`. Animating a muted grey harder is still a muted grey.

- **`src/__tests__/activity-cue-single-source.test.ts` fails the build on any `animate-pulse` outside its named allowlist.** The allowlist holds the `dashboard-client.tsx` skeleton only — a grey shimmer standing in for content that has not loaded is meant to RECEDE, which is the opposite job from a cue that must be noticed. The test also asserts every allowlist entry is still live, so an exemption cannot outlive its reason.

- **The `animate-pulse` scan greps every `.ts` / `.tsx` INCLUDING comments** — a live component cannot even name the retired utility. Rephrase the comment rather than allowlisting it; an exemption carved for a comment is exactly the kind that outlives its reason.

- **The same test also asserts the reduced-motion fallback exists and freezes at full opacity, and that the indeterminate branch contains no `aria-valuenow`.** The `aria-valuenow` assertion strips comments before matching, because `// No aria-valuenow, deliberately` is precisely what a reader should find at that spot. **The general rule: a guard about a NAME may read comments; a guard about rendered BEHAVIOUR must read only code.**

- **`@media (prefers-reduced-motion: reduce)` sets `animation: none; opacity: 1` — freeze at FULL opacity, never at an average.** The colour and weight stay, so the fallback is a steady high-contrast line. A status cue whose accessibility fallback leaves the user unable to tell whether anything is happening has traded one failure for a worse one.

- **`role="status"`, never `role="alert"`, for "this is taking a while".** `alert` is reserved for a genuine warning — the red "the type may be wrong" case in `scan-confidence-warning.tsx`; amber `role="status"` is the medium-confidence case and high confidence renders nothing at all, because a banner on nearly every row trains the user to ignore banners. Something merely running does not interrupt a screen-reader user mid-sentence.

- **Do not put a live region on every row of a table.** One live region per row announces a whole folder's worth of state changes; announce the pass once at the toolbar instead. Per-row cells and scan pills get the blink only.

- **`ProgressBar` (`src/components/progress-bar.tsx`) has two modes and `indeterminate` / `value` are mutually exclusive in the prop union.** The type is the enforcement: there is no way to pass a number into the indeterminate mode.

- **Never fake a percentage for a call that reports no intermediate progress.** A single opaque call gets the indeterminate sliding sliver, not a number invented to look busy.

- **In indeterminate mode omit `aria-valuenow` entirely.** ARIA reads its absence as "indeterminate", which is both the honest statement and the only one available.

- **`role="progressbar"` goes on the TRACK, not the fill.** The fill slides off the end in indeterminate mode and so cannot host a stable role; the track is what represents the range anyway.

- **`transition-none` is the bar's default and `smooth` is the opt-in.** A fast-cycling count lags behind a 300ms ease; do not quietly smooth a bar to match a neighbour.

- **`ActivityCue` (`src/components/activity-cue.tsx`) pairs the text and the bar in ONE component — it must never be possible to render the bar without the announced text.** Under reduced motion the bar stops sliding, and a motionless bar says nothing about running; the text is what carries the meaning then. The bar is named BY that text via `aria-labelledby`, so it needs no i18n of its own.

- **Extract, don't multiply.** When a second near-identical bar turns up in another file, absorb it into the shared component rather than shipping a third implementation.

- **A sentence a machine writes into a DB column is DATA, not UI.** Hardcode it in Romanian — sourcing it from the active locale would let an `en-GB` session permanently stamp an English sentence into a Romanian record. Dev-authored UI copy still belongs in `messages/*.json`.
