"use client";

import { useState } from "react";
import { useWatch } from "react-hook-form";
import type {
  Control,
  FieldPath,
  FieldValues,
  UseFormRegister,
} from "react-hook-form";

export type AsyncSelectOption = { value: string; label: string };

/**
 * `options`, plus an entry for each value in `keep` that `options` does not
 * contain — appended, so the caller's own "none" entry stays first, and
 * labelled with the value itself.
 *
 * Only a select whose column stores display text may use this. `tarla_sola`
 * is the one: it stores the *indicativ text* rather than a foreign key (Slice
 * #18.16.VL, deliberately — no FK migration), and only `createProperty` seeds
 * `lookup_tarla`; `updateProperty` does not. So a property can legitimately
 * hold a tarla the list has never heard of, and the right thing is to show it
 * rather than blank it.
 *
 * The other six selects that load asynchronously store a uuid whose label
 * lives in the lookup row, and those *live* columns are `ON DELETE SET NULL`,
 * so they cannot hold an id the list lacks. (The three static ones — `gender`
 * twice and `idDocumentType` — are pg enums whose option lists enumerate them
 * exactly, so the question does not arise for them either.) Synthesising an entry for them would only put a raw uuid on
 * screen while the list is in flight or after a failed fetch, so they do not
 * opt in. One case is outside that guarantee and stays unhandled: a **version
 * snapshot** holds lookup ids in jsonb with no FK, and
 * `src/lib/admin/value-lists/dependents.ts` decides on purpose that snapshots
 * do not count as dependents — so an admin can delete a lookup row that only a
 * snapshot still names, and paging back to that version shows an empty box.
 * Labelling that case ("valoare ștearsă") needs its own slice; opting the uuid
 * selects in here would fix it by printing the uuid, which is worse.
 *
 * An empty value is never kept: empty is legal on all of these columns and
 * must stay empty.
 */
export function optionsWithUnlistedValues(
  options: readonly AsyncSelectOption[],
  keep: readonly string[],
): AsyncSelectOption[] {
  const listed = new Set(options.map((o) => o.value));
  const extra: AsyncSelectOption[] = [];
  for (const value of keep) {
    if (value === "" || listed.has(value)) continue;
    listed.add(value);
    extra.push({ value, label: value });
  }
  return [...options, ...extra];
}

type AsyncSelectProps<T extends FieldValues> = {
  name: FieldPath<T>;
  control: Control<T>;
  register: UseFormRegister<T>;
  options: readonly AsyncSelectOption[];
  className: string;
  /**
   * Render a stored value the option list does not contain. Only for a column
   * that stores display text — see `optionsWithUnlistedValues`.
   */
  allowUnlistedValue?: boolean;
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
 * `allowUnlistedValue` adds the second half, for the one column that stores
 * display text rather than an id: both the value the form opened with and the
 * value it currently holds stay selectable even when the list has never
 * contained them, so a stored tarla is shown rather than blanked, and a
 * mis-click is one click from being undone.
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
 * `openedWith` is captured once per mount and is not refreshed by a `reset`, so
 * on a historical version the tarla dropdown still offers the indicativ the
 * page opened with. Invisible today — a historical version renders inside a
 * `<fieldset disabled>` — and worth fixing the day one becomes editable.
 */
export function AsyncSelect<T extends FieldValues>({
  name,
  control,
  register,
  options,
  className,
  allowUnlistedValue = false,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: AsyncSelectProps<T>) {
  const current: unknown = useWatch({ control, name });
  const stored = typeof current === "string" ? current : "";

  // The value the form opened with, captured once. Keeping it selectable for
  // the life of the mount is what stops a stray click on a free-text select
  // from putting the stored value permanently out of reach.
  const [openedWith] = useState(() => stored);

  const rendered = allowUnlistedValue
    ? optionsWithUnlistedValues(options, [openedWith, stored])
    : [...options];

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
