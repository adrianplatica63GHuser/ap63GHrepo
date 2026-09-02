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
import { AsyncSelect, optionsWithUnlistedValues } from "@/components/forms/async-select";

type Values = { field: string };

const NONE = { value: "", label: "— niciunul —" };

/** A free-text list: tarla stores the indicativ itself, not an id. */
const TARLA = [NONE, { value: "47/2", label: "47/2" }, { value: "40", label: "40" }];
/** An id list: the four other selects store a uuid whose label is in the row. */
const UUID_A = "63877b7f-dcd6-4509-a3c7-e0ba7c00dbea";
const UUID_B = "f57ad7a3-8487-4a32-be98-93e2bd892b45";
const TYPES = [NONE, { value: UUID_A, label: "Garaj" }, { value: UUID_B, label: "Teren Arabil" }];

function Harness({
  options,
  stored,
  legacy = false,
  allowUnlistedValue = false,
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
          allowUnlistedValue={allowUnlistedValue}
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
  allowUnlistedValue?: boolean;
  resetTo?: string;
};

/** Mount with a cold query cache, then let the options query resolve. */
function openThenLoad(stored: string, opts: OpenOpts = {}) {
  const { loaded = TARLA, legacy = false, allowUnlistedValue = false, resetTo } = opts;
  const onSubmit = jest.fn();
  const props = { stored, legacy, allowUnlistedValue, onSubmit, resetTo };
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

describe("optionsWithUnlistedValues", () => {
  it("leaves the list alone when every value is already in it", () => {
    expect(optionsWithUnlistedValues(TARLA, ["47/2"])).toEqual(TARLA);
  });

  it("never keeps an empty value", () => {
    // Empty is legal on all of these columns and must stay empty.
    expect(optionsWithUnlistedValues(TARLA, ["", ""])).toEqual(TARLA);
  });

  it("appends an unlisted value, after the caller's own entries", () => {
    expect(optionsWithUnlistedValues(TARLA, ["99/9"])).toEqual([
      ...TARLA,
      { value: "99/9", label: "99/9" },
    ]);
  });

  it("appends each unlisted value once", () => {
    expect(optionsWithUnlistedValues(TARLA, ["99/9", "99/9", "98/1"])).toEqual([
      ...TARLA,
      { value: "99/9", label: "99/9" },
      { value: "98/1", label: "98/1" },
    ]);
  });
});

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

  it("shows a stored free-text value from mount, before the list arrives", async () => {
    const { atMount, onSubmit } = openThenLoad("47/2", { allowUnlistedValue: true });
    expect(atMount).toEqual({ value: "47/2", text: "47/2" });
    expect(shown()).toEqual({ value: "47/2", text: "47/2" });

    await save();
    expect(onSubmit).toHaveBeenCalledWith({ field: "47/2" }, expect.anything());
  });

  it("shows a free-text value the list never contains, and it survives a save", async () => {
    // The tarlaSola round trip: `updateProperty` does not seed lookup_tarla, so
    // a property can hold an indicativ the list has never had. Displayed rather
    // than blanked, and a save that did not touch the field leaves it alone.
    const { atMount, onSubmit } = openThenLoad("99/9", { allowUnlistedValue: true });
    expect(atMount).toEqual({ value: "99/9", text: "99/9" });
    expect(shown()).toEqual({ value: "99/9", text: "99/9" });
    expect(select().options).toHaveLength(TARLA.length + 1);

    await save();
    expect(onSubmit).toHaveBeenCalledWith({ field: "99/9" }, expect.anything());
  });

  it("keeps an unlisted value reachable after the user picks another", async () => {
    // A stray click on a native select must not put the stored value out of
    // reach: it is not in the list, so nothing else could ever bring it back.
    openThenLoad("99/9", { allowUnlistedValue: true });

    await act(async () => {
      fireEvent.change(select(), { target: { value: "40" } });
    });
    expect(shown()).toEqual({ value: "40", text: "40" });
    expect(select().options).toHaveLength(TARLA.length + 1);

    await act(async () => {
      fireEvent.change(select(), { target: { value: "99/9" } });
    });
    expect(shown()).toEqual({ value: "99/9", text: "99/9" });
  });

  it("leaves an empty stored value empty", async () => {
    const { onSubmit } = openThenLoad("", { allowUnlistedValue: true });
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
    openThenLoad("47/2", { allowUnlistedValue: true, resetTo: "40" });
    expect(shown()).toEqual({ value: "47/2", text: "47/2" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "version" }));
    });
    expect(shown()).toEqual({ value: "40", text: "40" });
  });

  it("follows a form.reset() to a value the list does not contain", async () => {
    openThenLoad("47/2", { allowUnlistedValue: true, resetTo: "98/1" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "version" }));
    });
    expect(shown()).toEqual({ value: "98/1", text: "98/1" });
  });

  it("passes the caller's presentation props through to the element", () => {
    openThenLoad("47/2", { allowUnlistedValue: true });
    expect(select()).toHaveClass("cls");
    expect(select()).toHaveAttribute("aria-describedby", "field-label");
  });
});
