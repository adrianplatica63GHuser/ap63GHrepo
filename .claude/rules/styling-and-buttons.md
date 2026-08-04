---
paths:
  - "src/components/**"
  - "src/app/**/*.tsx"
  - "src/lib/ui/**"
  - "src/app/**/*.css"
---

# Tailwind v4, buttons & layout

<!-- Extracted verbatim from CLAUDE.md (Slice 24.01.optimization). Original line numbers in brackets. -->

- **Buttons — always `buttonClass()`; never hand-write `disabled:opacity-*` again.** Every `<button>` takes its classes from `buttonClass({ variant, size })` in `src/lib/ui/button-styles.ts` (variants `primary` / `secondary` / `danger` / `ghost` / `bare` / `bare-danger`; sizes `xs` / `sm` / `md` / `lg`). Do not pass a `disabled` boolean — the helper emits both states and CSS picks via `:enabled`/`:disabled`, so the styling can never disagree with the `disabled={...}` prop. Layout-only extras (`ml-4`, `w-full`, `flex-1`, `gap-2`) go in `className`; anything that CONFLICTS with what the helper emits (`text-xs`, `px-4`, `rounded-full`) must come from `size` / `pill` instead — see the Tailwind stylesheet-order gotcha below. `src/__tests__/button-styles-single-source.test.ts` fails the build on a hand-written `disabled:opacity-*`. The helper is for form controls only: `:enabled`/`:disabled` never match an `<a>` or a next/link `<Link>`, so a link styled with it would render with no hover state at all.

- **Tailwind v4 has new syntax.** `@import "tailwindcss";` plus `@theme inline { ... }` instead of `tailwind.config.js`-driven theme keys. Don't reach for v3 patterns.

- **Appending a conflicting Tailwind utility does NOT override the earlier one — stylesheet order decides, not class-attribute order.** `"px-4 py-2 text-sm" + " text-xs"` does not reliably shrink the text: both `text-sm` and `text-xs` are real rules in the generated stylesheet, they have identical specificity, and the winner is whichever Tailwind emitted LAST — which is a function of Tailwind's own internal ordering, not of where you wrote them. The symptom is a class that "sometimes works", or works until an unrelated file starts using the other utility and shifts the emission order. This is why `buttonClass()` takes `size` and `pill` as OPTIONS rather than letting callers append `text-xs` or `rounded-full`, and why its `className` parameter is documented as layout-only (`ml-4`, `w-full`, `flex-1`, `gap-2` — utilities the helper never emits, so nothing can conflict). The same trap applies to any shared class-string helper: whatever the helper decides, the caller cannot un-decide by appending. Where a caller genuinely needs a different value, add it to the helper's option set. (Hit while designing the helper in Slice #23.05.UX; the four button sizes exist precisely so no call site ever needs to fight the helper for a padding or a text size.)

- **A colour set on a child element beats the parent button's hover colour — an inverting hover must force its descendants.** `buttonClass`'s `secondary` variant flips `text-cta` → `text-white` on hover, but a label rendered as `<span className="text-fade">…</span>` keeps its own colour: inheritance only applies where the child sets nothing. The button turned dark slate (#334155) while its label stayed #595F6A — a **1.63:1** contrast, unreadable — and only on hover, so it survived every static review. Found by Adrian on the "Câmpuri afișate" column pickers; seven buttons were affected across the three list views and `add-property-dialog.tsx`, all of them `secondary`. Fixed once in the helper with Tailwind v4's `**:` descendant variant (`enabled:hover:**:text-white`) rather than at the call sites, so the button owns its label colour outright and a future call site cannot reintroduce it by wrapping a label in a coloured span. The override is hover-only — at rest a muted child label is legitimate (`text-fade` on `bg-cta-pale` is 5.8:1) and the design uses it deliberately. **The general rule: any variant that CHANGES text colour on a state needs `**:` on that state; a variant whose text colour is constant does not.** That is why only `secondary` carries it — `primary` and `danger` are white throughout, `ghost` and the `bare` pair never invert.

- **A disabled `<button>` still matches `:hover`.** `disabled` stops clicks and focus, not hover styling — so `hover:bg-cta-d` repaints an inert button when the mouse crosses it, undoing whatever the disabled state was meant to communicate. Write `enabled:hover:` on any button whose hover changes colour. It also removes a variant-ordering question entirely: `:enabled:hover` and `:disabled` are mutually exclusive selectors, so neither can win over the other regardless of what order Tailwind emits them in. Every hover rule in `src/lib/ui/button-styles.ts` is written this way and a test asserts no bare `hover:` slips back in.

- **4-column grid: skip the 3-column step.** For `columns={4}` in the `Section` helper, use `"grid grid-cols-2 gap-4 md:grid-cols-4"` — do not add a `md:grid-cols-3` intermediate. At common "half-width browser" sizes (768–1023 px) the 3-column class strands the layout on 3 columns instead of 4.

## Harvested from the slice log

- **Convert every button in every file a slice touches.** Half-converting a file leaves a converted button beside an unconverted neighbour — a pale-slate `secondary` next to a plain-white one in the same table row. A leftover hand-written `bg-cta` / `border-wire` string is invisible to `src/__tests__/button-styles-single-source.test.ts` when it carries no `disabled:opacity-*`, so the test passing is not evidence a file is done.

- **The disabled visual contract, in one sentence: disabled = a white/neutral surface with a `border-wire` edge and a `text-fade` label and NO colour fill, identical for every variant; enabled = that variant's full strong colour.** Never express disabled as `disabled:opacity-*` layered on top of the enabled style — opacity MULTIPLIES the enabled appearance instead of replacing it, and 50% of "white with a grey border" is still white with a slightly greyer border.

- **Focus rings use `focus-visible:outline-*` with the existing `--color-focus` token — `outline`, not `ring`.** An outline needs no ring-offset background colour, so it renders correctly on canvas, in a white card and on dark alike.

- **Dark mode is `prefers-color-scheme` only — the app has NO dark-mode toggle,** so `dark:` resolves purely off the OS setting. `primary` lightens to `slate-400` in dark mode (the light-mode `bg-cta` #334155 is 1.69:1 on a zinc-900 page, i.e. invisible); `danger` stays red rather than inverting, because an inverted red reads as pink and stops signalling "destructive".
