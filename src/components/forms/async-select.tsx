"use client";

import type {
  Control,
  FieldPath,
  FieldValues,
  UseFormRegister,
} from "react-hook-form";

export type AsyncSelectOption = { value: string; label: string };

/**
 * ⚠️ **`optionsWithUnlistedValues` was here, and Slice #34.03 deleted it
 * outright — the whole function and the `allowUnlistedValue` prop that turned
 * it on.**
 *
 * It appended an entry for each stored value the option list did not contain,
 * labelled with the value itself. Exactly one column could ever use it:
 * `property.tarla_sola`, which stored the *indicativ text* rather than a
 * foreign key (Slice #18.16.VL, on a four-word comment — "no FK migration") and
 * was seeded by `createProperty` and not by `updateProperty`, so a property
 * could legitimately hold a tarla the list had never heard of and the right
 * thing was to show it rather than blank it. migration_078 made that column an
 * FK, so an unlisted value is a 23503 rather than a row: there is nothing left
 * to synthesise, and a function whose only job was inventing the missing entry
 * a free-text column produces has no second caller to inherit it. Checked
 * before deleting — it was exported and general, and `allowUnlistedValue`
 * appeared at exactly one production call site.
 *
 * The rest of that docblock is kept here because it is about the OTHER selects
 * and is still true: the ones that load asynchronously store a uuid whose label
 * lives in the lookup row, and those *live* columns are `ON DELETE SET NULL`,
 * so they cannot hold an id the list lacks. (The static ones — `gender` twice
 * and `idDocumentType` — are pg enums whose option lists enumerate them
 * exactly.)
 *
 * ⚠️ **The one case outside that guarantee is a SNAPSHOT, and since Slice
 * #34.17 it is answered on the version view rather than left open here.** A
 * version snapshot holds lookup ids in jsonb with no FK, and
 * `src/lib/admin/value-lists/dependents.ts` decides on purpose that snapshots
 * do not count as dependents — so an admin can delete a lookup row that only a
 * snapshot still names, and paging back to that version used to show an empty
 * box. `src/lib/versioning/snapshot-lookup.ts` now classifies what the snapshot
 * recorded and the version view PRINTS it — the row's current label, the
 * snapshot's own recorded text, or "valoare ștearsă" — in place of the picker.
 * This component is unchanged by that on purpose: it still renders nothing but
 * options the list holds, and a deleted id never enters the DOM as an
 * `<option>`, which is the difference between #34.17 and the
 * `optionsWithUnlistedValues` deleted above. Printing the raw uuid was
 * considered and is worse than either.
 *
 * ⚠️ **The property form is the only call site wired up.** #34.17 covers its
 * three fields — `propertyTypeId`, `useCategoryId`, and the `tarlaId` that
 * #34.03 put in the same category by moving the snapshot from the code as text
 * to the row's id. The identical snapshot gap is still open on the two person
 * forms (`citizenshipId`, `physicalPersonTypeId`, `judicialPersonTypeId`) and
 * on `document-form.tsx` (`documentTypeId`, `institutionId`): the helper is
 * entity-agnostic, so each of those is a call site rather than a redesign.
 */

type AsyncSelectProps<T extends FieldValues> = {
  name: FieldPath<T>;
  control: Control<T>;
  register: UseFormRegister<T>;
  options: readonly AsyncSelectOption[];
  className: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

/**
 * A `<select>` registered with react-hook-form whose options arrive
 * asynchronously — the one idiom for all of them (Slice #32.13).
 *
 * The select is uncontrolled: `register` assigns the DOM element's value once,
 * at ref-attach time. If no `<option>` matches at that moment the browser drops
 * the selection and falls back to the first entry, and appending the real
 * options later does not make it reconsider. `_formValues` keeps the correct
 * value throughout — which is why a save never lost one, measured on a
 * throwaway property before this was written — but the user is shown a field
 * that looks cleared, on every one of these selects, for as long as the page
 * is open.
 *
 * `key={options.length}` is what closes it: the element remounts whenever the
 * *loaded* list changes, so `register` re-runs its assignment against the real
 * list. This is the idiom `document-form.tsx` has used since Slice #27.04. The
 * property form carried a version of it that could never fire — `noneOption` is
 * prepended unconditionally there, so `options.length` was never 0 and the
 * `loaded`/`loading` ternary was a constant — and the two person forms and the
 * ID-card dialog carried none at all.
 *
 * ⚠️ **`allowUnlistedValue` used to add a second half** — for the one column
 * that stored display text rather than an id, keeping both the value the form
 * opened with and the value it currently holds selectable even when the list
 * had never contained them. Slice #34.03 removed it with
 * `optionsWithUnlistedValues`; see the note at the top of this file.
 *
 * Values written AFTER mount:
 *
 *   - `form.reset(...)` — version navigation on all three entity forms — is
 *     fine, and the test file pins it. It works because react-hook-form's
 *     `_reset` empties `_fields`, which makes the next render's ref-attach
 *     re-assign the DOM value instead of short-circuiting on an unchanged ref.
 *     That is a library internal, and `reset`'s `keepValues`,
 *     `keepDirtyValues` and `keepFieldsRef` options all disable it — so a
 *     future "keep my edits while paging versions" would need this revisited.
 *   - `setValue` into an already-loaded list that does not contain the value is
 *     NOT recovered until the list next changes. No caller does that: the uuid
 *     selects cannot (see above), and nothing calls `setValue` on the tarla.
 *
 * (There was a third paragraph here about `openedWith`, captured once per
 * mount and not refreshed by a `reset`, so a historical version's tarla
 * dropdown still offered the indicativ the page opened with. It went with
 * `allowUnlistedValue` in Slice #34.03 — there is no captured value any more,
 * and a historical version's tarla id is an ordinary option or it is nothing.)
 */
export function AsyncSelect<T extends FieldValues>({
  name,
  // ⚠️ **`control` is accepted and not destructured, since Slice #34.03.** It
  // fed the `useWatch` that `allowUnlistedValue` needed to know the current
  // value; with the synthesis gone there is nothing in here that reads the
  // form. It stays in the prop type on purpose rather than being removed:
  // `async-select-single-source.test.ts` asserts that every call site hands
  // its select a `control`, which is the idiom that keeps all seven selects
  // going through react-hook-form's context instead of each form inventing its
  // own wiring — the thing this component exists to make singular. Removing it
  // is a four-form change for no behaviour, and it is in the handover under
  // "Noticed, not fixed".
  register,
  options,
  className,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: AsyncSelectProps<T>) {
  // Slice #34.03: `useWatch` and the once-captured `openedWith` went with
  // `allowUnlistedValue` - nothing reads the current value any more, because
  // every option this component renders now comes from the list.
  const rendered = [...options];

  return (
    <select
      key={options.length}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      className={className}
      // Last on purpose: `register` can itself return `disabled` (from
      // `useForm({ disabled })` or `register(name, { disabled })`), and nothing
      // this component accepts may quietly override what the form said.
      {...register(name)}
    >
      {rendered.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
