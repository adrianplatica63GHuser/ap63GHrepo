/**
 * <AsyncSelect> — a stored value is on the form when it opens, and a save
 * leaves it where it was  (Slice #32.13).
 *
 * The defect: a `<select>` registered with react-hook-form is uncontrolled, so
 * `register` assigns the DOM element's value exactly once, at ref-attach time.
 * Options arrive from a query afterwards. At the moment of the assignment
 * nothing matches, the browser falls back to the first entry, and appending the
 * real options later does not make it reconsider — the field reads as empty for
 * as long as the page is open.
 *
 * The first test renders the OLD shape and asserts it still shows blank. It is
 * there so the rest cannot pass vacuously: if this timeline ever stopped
 * reproducing the bug, every other assertion here would be green against a
 * component that does nothing.
 *
 * What a save does was measured, not assumed, before any of this was written —
 * on a throwaway property (PROP01612, local `ga40db`) opened, edited in one
 * unrelated field and saved: all three columns came back unchanged.
 * `_formValues` holds the registered value throughout, so the damage was to the
 * display only. These tests assert both halves anyway, because a future fix
 * that reached for the DOM value would quietly turn the display bug into the
 * data-loss bug the finding feared.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { AsyncSelect } from "@/components/forms/async-select";

type Values = { field: string };

const NONE = { value: "", label: "— niciunul —" };

/**
 * A small list whose values happen to READ like labels.
 *
 * ⚠️ Until Slice #34.03 this was the tarla list and the comment said "a
 * free-text list: tarla stores the indicativ itself, not an id" — which was
 * the whole reason `allowUnlistedValue` existed. migration_078 made
 * `property.tarla_id` a foreign key, so every select this component serves
 * stores an id and the synthesised-option path is gone. The constant is kept
 * because several tests below only need "a list with two entries"; nothing
 * about it is free text any more.
 */
const TARLA = [NONE, { value: "47/2", label: "47/2" }, { value: "40", label: "40" }];
/** An id list: the four other selects store a uuid whose label is in the row. */
const UUID_A = "63877b7f-dcd6-4509-a3c7-e0ba7c00dbea";
const UUID_B = "f57ad7a3-8487-4a32-be98-93e2bd892b45";
const TYPES = [NONE, { value: UUID_A, label: "Garaj" }, { value: UUID_B, label: "Teren Arabil" }];

function Harness({
  options,
  stored,
  legacy = false,
  onSubmit,
  resetTo,
}: {
  options: { value: string; label: string }[];
  stored: string;
  legacy?: boolean;
  allowUnlistedValue?: boolean;
  onSubmit: (v: Values) => void;
  /** What the "version" button resets the form to — the version-nav path. */
  resetTo?: string;
}) {
  const form = useForm<Values>({ defaultValues: { field: stored } });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {legacy ? (
        // The shape all seven selects carried before this slice.
        <select {...form.register("field")}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <AsyncSelect<Values>
          name="field"
          control={form.control}
          register={form.register}
          options={options}
          className="cls"
          aria-describedby="field-label"
        />
      )}
      <button type="submit">save</button>
      {resetTo !== undefined && (
        <button type="button" onClick={() => form.reset({ field: resetTo })}>
          version
        </button>
      )}
    </form>
  );
}

type OpenOpts = {
  loaded?: { value: string; label: string }[];
  legacy?: boolean;
  resetTo?: string;
};

/** Mount with a cold query cache, then let the options query resolve. */
function openThenLoad(stored: string, opts: OpenOpts = {}) {
  const { loaded = TARLA, legacy = false, resetTo } = opts;
  const onSubmit = jest.fn();
  const props = { stored, legacy, onSubmit, resetTo };
  const view = render(<Harness {...props} options={[NONE]} />);
  const atMount = shown();
  view.rerender(<Harness {...props} options={loaded} />);
  return { atMount, onSubmit };
}

function select(): HTMLSelectElement {
  return screen.getByRole("combobox") as HTMLSelectElement;
}

/** What the closed select actually reads as, plus its value. */
function shown(): { value: string; text: string | undefined } {
  const el = select();
  return { value: el.value, text: el.options[el.selectedIndex]?.text };
}

async function save() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "save" }));
  });
}

// ⚠️ **A `describe("optionsWithUnlistedValues")` block stood here with four
// cases, and Slice #34.03 deleted the function it tested.** It appended an
// entry for each stored value the option list did not contain, which exactly
// one column could ever need: `property.tarla_sola`, free text until
// migration_078. With that column an FK there is nothing to synthesise, and the
// cases below that depended on it are gone with it - each one named where it
// was, so this file reads as a record of what the component stopped doing
// rather than as a file that quietly got shorter.

describe("the defect this component exists to fix", () => {
  it("a plainly registered select still shows blank after the options arrive", () => {
    const { atMount } = openThenLoad("47/2", { legacy: true });
    expect(atMount.value).toBe("");
    expect(shown()).toEqual({ value: "", text: "— niciunul —" });
  });
});

describe("AsyncSelect", () => {
  it("shows a stored id once the options query resolves", async () => {
    // The five selects whose column is a uuid FK. Nothing can render a label
    // for them before the list arrives — what matters is that they correct
    // themselves when it does, instead of staying on "— niciunul —" forever.
    const { atMount, onSubmit } = openThenLoad(UUID_B, { loaded: TYPES });
    // Before the list: `register` assigned an id with no matching <option>, so
    // the browser dropped the selection (selectedIndex −1) and the box reads
    // empty. That is exactly what it did before this slice, and it is the state
    // the old code never left. What is new is the line below it.
    expect(atMount).toEqual({ value: "", text: undefined });
    expect(shown()).toEqual({ value: UUID_B, text: "Teren Arabil" });

    await save();
    expect(onSubmit).toHaveBeenCalledWith({ field: UUID_B }, expect.anything());
  });

  it("never puts a raw stored id on screen as its own label", () => {
    // Without allowUnlistedValue there is no synthetic entry, so an id the
    // list does not carry reads as the "none" entry rather than as a uuid.
    // A value-list fetch that fails leaves the list at just the "none" entry
    // for the life of the page (both person-form hooks swallow the error). The
    // field then stays blank — unchanged from before this slice — and the one
    // thing that must not happen is a raw uuid appearing as its own label.
    openThenLoad(UUID_B, { loaded: [NONE] });
    expect(shown()).toEqual({ value: "", text: undefined });
    expect(screen.queryByText(UUID_B)).toBeNull();
  });

  // ⚠️ **THREE CASES WERE DELETED HERE BY Slice #34.03, and they are named
  // because their absence is the point.** All three drove
  // `allowUnlistedValue`:
  //
  //   "shows a stored free-text value from mount, before the list arrives"
  //   "shows a free-text value the list never contains, and it survives a save"
  //   "keeps an unlisted value reachable after the user picks another"
  //
  // They pinned the behaviour a free-text column needed: a property could hold
  // an indicativ `lookup_tarla` had never had, because `updateProperty` did not
  // seed it, and the value had to be shown rather than blanked and had to stay
  // reachable after a stray click. `property.tarla_id` is a foreign key now, so
  // a value outside the list cannot be stored at all and the case they covered
  // is unreachable rather than untested. The one below is what replaces them.

  it("renders no option for a stored value the list does not contain", () => {
    // The successor to the three above, pointing the other way: with the
    // synthesis gone, an id the list lacks must read as the "none" entry and
    // must NOT appear as its own label. That is the same guarantee the uuid
    // test above makes, now stated for every select rather than for the ones
    // that had opted out of synthesising.
    openThenLoad("99/9");
    // ⚠️ `text: undefined`, not the "none" label. When react-hook-form writes a
    // value no <option> carries, jsdom (and a browser) leave `selectedIndex`
    // at −1 rather than falling back to the first entry — the fallback only
    // fires when the option LIST is mutated, which is what the `legacy` case
    // above is about. So the box reads EMPTY, which is the same thing a user
    // sees, and is what the two uuid cases above already assert.
    expect(shown()).toEqual({ value: "", text: undefined });
    expect(select().options).toHaveLength(TARLA.length);
    expect(screen.queryByText("99/9")).toBeNull();
  });

  it("leaves an empty stored value empty", async () => {
    const { onSubmit } = openThenLoad("");
    expect(shown()).toEqual({ value: "", text: "— niciunul —" });
    expect(select().options).toHaveLength(TARLA.length);

    await save();
    expect(onSubmit).toHaveBeenCalledWith({ field: "" }, expect.anything());
  });

  it("follows a form.reset() to a listed value", async () => {
    // Version navigation: all three entity forms reset the whole form to a
    // snapshot, with the option list long since loaded. This is the only
    // after-mount write any caller makes, and it is the one the docblock says
    // survives only because RHF's `_reset` empties `_fields`.
    openThenLoad("47/2", { resetTo: "40" });
    expect(shown()).toEqual({ value: "47/2", text: "47/2" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "version" }));
    });
    expect(shown()).toEqual({ value: "40", text: "40" });
  });

  it("follows a form.reset() to a value the list does not contain, and shows nothing", async () => {
    // ⚠️ **INVERTED by Slice #34.03, not deleted.** This asserted
    // `{ value: "98/1", text: "98/1" }` - the synthesised option surviving a
    // version navigation. With no synthesis the honest answer is the empty
    // one, and it matters for the case the component's own docblock flags: a
    // **version snapshot** holds lookup ids in jsonb with no FK, and
    // `dependents.ts` decides on purpose that snapshots do not count as
    // dependents - so an admin CAN delete a lookup row that only an old
    // version still names, and paging back to that version showed an empty box.
    // Since #34.03 that was true of the tarla field too.
    //
    // ⚠️ **Slice #34.17 labelled it ("valoare stearsa") and this test stayed
    // GREEN, which an earlier version of this comment said would be the
    // tripwire. It was the wrong tripwire and the miss is the point:** the
    // label went into the CALLER - `SelectField` prints the value instead of
    // rendering this component at all - precisely so that a deleted id never
    // becomes an `<option>` here. What this test pins is unchanged and still
    // worth pinning: handed a value its list does not contain, `<AsyncSelect>`
    // shows nothing and synthesises nothing. The version view's own three
    // states are pinned in `snapshot-lookup.test.tsx`.
    openThenLoad("47/2", { resetTo: "98/1" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "version" }));
    });
    // `text: undefined` for the reason the case above states: the write lands
    // on an unchanged option list, so `selectedIndex` stays −1.
    expect(shown()).toEqual({ value: "", text: undefined });
  });

  it("passes the caller's presentation props through to the element", () => {
    openThenLoad("47/2");
    expect(select()).toHaveClass("cls");
    expect(select()).toHaveAttribute("aria-describedby", "field-label");
  });
});
