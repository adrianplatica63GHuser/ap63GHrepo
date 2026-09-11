/**
 * src/lib/import/metadata-pass.ts — the T1 pass, which since #26.05 runs for
 * the Constraints stage rather than for the report. (Slice #24.02b)
 *
 * Reads `size` for every file the run will upload, by calling `getFile()` on
 * each handle. The size is what separates three cheap high-value checks from
 * being uncheckable — all three moved to the Constraints stage in #26.05,
 * where they BLOCK rather than advise:
 *
 *   CON-05  a file over 20 MB → HTTP 413, *after* its Document row exists
 *   CON-04  a zero-byte file  → HTTP 400 "file is required", which misleads
 *   CON-06  a real scan named `folder.jpg`, which the walk drops on sight
 *
 * ⚠️ **There was a fourth T1 rule, and it is gone rather than moved.** F-11
 * stayed behind in `checks.ts` as advice about an empty `File.type`, which used
 * to disable automatic extraction for that page FOREVER because the MIME was
 * frozen at upload and never re-sniffed. #34.06 took the type from the file
 * name at upload, at serve and at AI-interpret, leaving a finding with no
 * consequence, and #34.12 deleted it.
 *
 * ⚠️ **`FileMeta.type` WAS WRITTEN HERE AND IS GONE, deleted by #34.22.** It
 * survived #34.12 as a scope decision rather than as evidence of a consumer,
 * and for one slice it sat in the map written by this pass and read by nothing.
 * That is not an inert field, it is an invitation: the next rule author who
 * reached for it would have got the Windows-registry value #34.06 declared
 * untrustworthy, `""` and all, on exactly the archival `.tif` that made F-11
 * worthless — and nothing would have failed. The header that stood here was
 * the whole of the protection, and it said so; it also said what to do when a
 * second rule wanted the field, which was to delete the field instead of
 * reading it. #34.22 did that. **There is now nothing to read, which is a
 * guard rather than a paragraph asking to be believed.**
 *
 * The deletion cost what this header predicted: the type at `checks.ts`'s
 * `FileMeta`, the write below, and five test fixtures that spelled a type out
 * (`import-checks.test.ts`'s `meta`, `import-constraint-check.test.ts`'s `meta`
 * and `one`, `import-constraint-rules.test.ts`'s `m` and `JPEG`). None of the
 * modules that merely pass the map along changed at all.
 *
 * ⚠️ **If you want a rule about the file's type, read the NAME.** That is not a
 * workaround, it is the finding of #34.06 and the admission test in
 * `constraint-rules.ts`: the extension is what the registry was guessing from
 * in the first place, so the name is the same information without the machine
 * dependency. `src/__tests__/import-checks.test.ts` walks `src/` and fails if
 * anything reads a `.type` off this map again.
 *
 * ⚠️ **It therefore runs for the Constraints stage now, not for the report.**
 * `ImportWizard` calls it once the structure check is clean and the user has
 * pressed the Constraints button; the Evaluation report is handed whatever it
 * produced. A pass that read nothing is not "no findings" at that stage — see
 * `checkConstraintsStage`.
 *
 * `getFile()` returns a `File` whose `size` comes from the directory entry — it
 * does not read the contents, so this is metadata, not I/O over the bytes. On
 * Adrian's archive it is ~760 calls and finishes in well under a second; it is
 * still reported through `onProgress` because "well under a second" is a claim
 * about his laptop, not about every machine.
 *
 * ⚠️ It also touches the DROPPED files, which is deliberate and is the whole
 * point of CON-06. `folder.jpg` is removed by NAME, so the only way to tell a
 * Windows thumbnail from someone's scan of a land title is to look at how big
 * it is. Every other consumer must restrict itself to `uploadKeysOf(entries)`
 * for exactly that reason.
 */

import { metadataKeyFor, type FileMeta } from "./checks";
import type { DirectoryObservation, FSEntry, FSFileHandle } from "./folder-utils";

export type MetadataProgress = { done: number; total: number };

/**
 * Every handle the report needs to size, paired with the key `checks.ts` will
 * look it up by. One place decides that mapping — see `metadataKeyFor`.
 */
function collectHandles(
  entries: readonly FSEntry[],
  observations: readonly DirectoryObservation[],
): { key: string; handle: FSFileHandle }[] {
  const out: { key: string; handle: FSFileHandle }[] = [];

  for (const entry of entries) {
    if (entry.kind === "file") {
      out.push({ key: metadataKeyFor(entry.path), handle: entry.handle });
      continue;
    }
    // A page group is one Document but many uploads, and the 20 MB cap is
    // per FILE — so every page has to be sized, not just the group.
    for (const handle of entry.handles) {
      out.push({ key: metadataKeyFor(entry.path, handle.name), handle });
    }
  }

  for (const obs of observations) {
    for (const dropped of obs.dropped) {
      out.push({ key: dropped.path, handle: dropped.handle });
    }
  }

  return out;
}

/**
 * Read metadata for every file, `concurrency` at a time.
 *
 * A file that cannot be read is omitted rather than guessed at. Its rules then
 * simply do not fire for it, which is the honest outcome: reporting a size of
 * 0 for a file we failed to open would manufacture an F-09 finding out of a
 * permissions error.
 */
export async function readFileMetadata(
  entries: readonly FSEntry[],
  observations: readonly DirectoryObservation[],
  options: {
    onProgress?: (progress: MetadataProgress) => void;
    /** Set true to abandon the pass; the caller gets whatever completed. */
    isCancelled?: () => boolean;
    concurrency?: number;
  } = {},
): Promise<Map<string, FileMeta>> {
  const { onProgress, isCancelled, concurrency = 8 } = options;
  // One progress call per file is ~760 React renders on Adrian's archive for a
  // pass that finishes in under a second. The counter exists to prove liveness
  // on a slow machine, and a coarse counter proves that just as well.
  const PROGRESS_EVERY = 25;
  const targets = collectHandles(entries, observations);
  const result = new Map<string, FileMeta>();
  const total = targets.length;
  let done = 0;
  let next = 0;

  onProgress?.({ done: 0, total });

  async function worker(): Promise<void> {
    for (;;) {
      if (isCancelled?.()) return;
      const index = next++;
      if (index >= total) return;
      const { key, handle } = targets[index];
      try {
        const file = await handle.getFile();
        result.set(key, { size: file.size });
      } catch {
        // Unreadable — see the docblock. Omitted, never defaulted.
      }
      done++;
      if (done % PROGRESS_EVERY === 0 || done === total) onProgress?.({ done, total });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(total, 1)) }, () => worker()),
  );

  return result;
}
