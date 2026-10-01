# TC-ICON-06 — Importul, până la „Restricții": „Verifică din nou" și „Continuă" cu pictogramele lângă cuvinte

| | |
|---|---|
| **Area** | import |
| **Kind** | happy |
| **Data** | a synthetic folder made in the browser (below) |
| **State** | `automated` |
| **Last green** | 2026-10-01 |

## What this proves

Since Slice #37.47 the import wizard's recurring buttons carry an icon beside words that did
not change: „Verifică din nou" RefreshCw before them, „Continuă la pasul …" ArrowRight after
them, „Renunță la import" CircleStop, the rules' show / hide a chevron, „Salvează … ca pagină"
FileDown; the structure step's first press, which picks a folder, FolderOpen. The wizard's
answers („Am înțeles") and the cancel question keep their words without an icon. The run stops
before „Deja în sistem", so nothing is written, read or paid for.

## Before you start

- TC-AUTH-01 is green, on an account that can reach „Admin-Operațiuni".
- „Oprește-te după fiecare pas" and „Începe fiecare pas cu regulile la vedere" ticked (the
  defaults).
- **The folder is made in the browser, not picked.** The folder picker is a native dialog no
  tool can answer (see the catalogue's „A file into a page, without the dialog"). So, on the
  import page, a script makes a folder in the browser's own private storage
  (`navigator.storage.getDirectory()` — a real `FileSystemDirectoryHandle`, not a stand-in)
  and has `window.showDirectoryPicker` answer it:

  ```
  TC-ICON-06\
      40-212per40IE99906-TC-ICON-06 Teren\
          coord TC-ICON-06.txt     ← TC-PROP-03's four synthetic corners
  ```

  It is removed from that storage at the end.

## What Adrian is asked for

Nothing.

## Steps

An icon is the Lucide one on the button: `refresh-cw`, `arrow-right`, `circle-stop`,
`chevron-up`, `file-down`, `folder-open`. „Before" / „after" is the icon's place beside the
words.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Import în sistem" (`/admin/import`) | „Pasul curent: Informare"; „Renunță la import" with the stop circle before it; „Am înțeles" in words only |
| 2 | Presses „Am înțeles" | „Pasul curent: Precondiții"; once every row is green, „Verifică din nou" with the refresh arrows before the words and „Continuă la pasul „Structură”" with the arrow after them |
| 3 | Presses „Continuă la pasul „Structură”" | „Pasul curent: Structură"; „Ascunde regulile" (chevron up), „Salvează regulile ca pagină" (file down), „Alege folderul…" with the open folder, inactive |
| 4 | Ticks „Respect regulile de structură", presses „Alege folderul…" (the script answers it) | „Structura folderului este în regulă."; „Continuă la pasul „Restricții”" with the arrow after the words |
| 5 | Presses it | „Pasul curent: Restricții"; „Verifică fișierele" with the refresh arrows, inactive until its tick |
| 6 | Presses „Renunță la import", then „Da, renunț la import" | The question „Renunțați la import?" and both answers in words only; then „Pasul curent: Informare" again |

## At the end — leaving things as they were found

Nothing was written. Remove the folder from the browser's storage
(`(await navigator.storage.getDirectory()).removeEntry("TC-ICON-06", { recursive: true })`).

## Notes from the runs

**2026-10-01 — run 1, `driven` (Slice #37.47).** Driven in the Claude desktop app's browser pane
against `npm run dev` on 3000; this file was written from it. The presses were `click()` (the
tick a real click), the folder the script above.
- Steps 1–6 as written: `lucide-circle-stop` first in „Renunță la import"; „Am înțeles" no icon;
  on „Precondiții" `lucide-refresh-cw` first in „Verifică din nou", `lucide-arrow-right` LAST in
  „Continuă la pasul „Structură”" (the words' span first); on „Structură" `lucide-chevron-up`,
  `lucide-file-down`, `lucide-folder-open`; the folder in regulă, „Continuă la pasul
  „Restricții”" arrow last; on „Restricții" „Verifică fișierele" `lucide-refresh-cw`; the cancel
  question's two answers with no icon; back on „Informare".
- The step bar's own hints (HintBubble, #32.10) checked unchanged: the „Oprește-te după fiecare
  pas" bubble hidden at rest, open on a mouse hover, closed by Escape, not opened by a touch.
- The folder removed from the browser's storage at the end.

**2026-10-01 — run 2, `confirmed` (Slice #37.47).** Same pane, the folder made again, against the
file above unchanged.
- Steps 1–6 exactly as run 1: the stop circle first, „Am înțeles" with no icon; the refresh
  arrows first and the arrow last on „Precondiții"; chevron, file and open folder on
  „Structură"; in regulă and the arrow last; the refresh arrows on „Verifică fișierele"; the
  question's answers with no icon; „Informare" again.
- The folder removed. Nothing changed between the runs, so the case is confirmed, and
  `e2e/ui/icon-import.spec.ts` translates it.

**2026-10-01 — `automated`.** `e2e/ui/icon-import.spec.ts` translates the case with Playwright's
real mouse and takes #37.47's pictures, the sign-in pages from a second, signed-out test. Its first
runner run, `20261001T200514Z-6710`, failed on the spec's own fault: „Structura folderului este în
regulă." is on the page twice (the panel and its status line). Green on `20261001T200655Z-20674`.
