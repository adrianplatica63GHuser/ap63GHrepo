# Captures from the real archive — what must never reach a figure

> **⚠️ THIS FILE EXISTS TWICE, AND THE COPY YOU ARE READING MAY NOT BE THE ONE TO EDIT.**
> The versioned original is `ga40prj\docs\claude\shared\rules\capture-and-personal-data.md`. The copy Claude
> actually **loads** is `C:\dev\.claude\rules\capture-and-personal-data.md`, deployed above every repo so that
> every project inherits it — which puts it outside git's reach. **Edit the repo copy and
> commit it; deploying is Adrian's** (`ga40prj\scripts\Sync-SharedClaude.ps1`), so it goes in
> the handover next to the push.
>
> Both halves have gone wrong in real sessions. A commit without a deploy is a rule that is
> **not in effect** — Slice #32.14 opened with `sandbox-and-toolchain.md` 33 lines behind its
> source, missing two bullets about failures that session could have hit. An edit made
> directly to the deployed copy is **discarded by the next deploy** — the same slice did that
> too. `src\__tests__\shared-claude-deploy.test.ts` now fails when the two drift, so
> `npx jest` catches both.


Always loaded: every manual, guide, slice document and handover that carries a screenshot is
produced from Adrian's live archive, because there is no other archive to produce it from.

## Why this file exists rather than a marker in the product

Slice #32.11's manuals run opened the identity-card dialog on a **real person's card** — full
name, CNP, series and number, dates and place of birth, address — and the figure that shipped
(`images/ro/03-10-id-card-dialog.jpg`) had to be Gaussian-blurred by hand afterwards. The
unredacted capture was kept out of the image set. That was finding S-09.

Slice #32.12 weighed three answers to it: change nothing in the application; add a visual marker
to screens that show an identity document's fields; or a marker plus a blur-on-screenshot
affordance. **Adrian chose the first**, and the reasoning is worth keeping because it is the
reasoning that makes this file the whole of the fix:

- This is a single-business archive whose PURPOSE is to hold people's documents. A marker on
  every screen that shows personal data would be on most screens most of the time, and a warning
  that is always on is wallpaper, not a warning.
- A blur affordance has to default to OFF, because reading those fields is Ciprian's job — so it
  would be disabled at exactly the moment somebody forgets to enable it.
- The incident was not a business user leaking a card. It was a **documentation run photographing
  a real record**, and the control for that is a rule about capture, not a pixel in the product.

`C:\dev\TEST.DATA\A` holds real people's documents. So does `ga40db`. Neither is test data in
anything but name.

## The rule

**Before any capture from the running application reaches a document, a manual, a slice folder or
a handover, it is checked for identity fields, and any that appear are redacted in the image
itself — not cropped around, not relied upon to be illegible.**

The fields that trigger it, in the shapes this archive stores them:

- a natural person's full name shown together with any identifier
- **CNP**, in any field, list column, dialog, tooltip or AI-extraction preview
- identity-document series and number
- date and place of birth
- home address
- a scanned or photographed identity document, whole or in part, at any zoom

Not triggered by: property codes, PROP/DOC/PPERS codes, cadastral numbers, tarla/parcela,
coordinates, document types, tags, dates that are not birth dates, or a person's name alone in a
list where nothing else identifies them — that last one is a judgement call, and the safe
direction is to blur.

## How, in practice

- **Prefer a record that is not a real person's.** A capture that needs no redaction is always
  better than one that was redacted correctly.
- **Blur in the image, at capture time.** A Gaussian blur wide enough that the glyph shapes are
  gone. Do not paint a black box over text you have not first removed — a box in a lossy JPEG can
  still be lifted at the edges — and do not rely on scaling the image down.
- **Keep the unredacted original out of the image set entirely.** Not renamed, not in a `_raw`
  subfolder beside it: out. It has served its purpose the moment the redacted copy exists.
- **Say what was redacted** in the handover for the run that produced the figure, so the next
  person knows a check happened rather than assuming one did.

## What this rule is NOT

It is not a claim that the application protects anything. It does not, deliberately — see the
reasoning above. Anyone with a login sees every field, which is correct for a one-user archive
and is exactly why the discipline has to live with whoever points a camera at it.

It also does not apply to Adrian's own records or to invented data. It applies to the third
parties whose documents happen to be in the archive because the business holds them.
