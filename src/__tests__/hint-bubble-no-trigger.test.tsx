/**
 * HintBubble without its ⓘ, for a text box; and `refusalCode`.   (Slice #37.50)
 *
 * The CNP's and the CUI's lock note left the field for a bubble. A text box's
 * own focus opens it, so there is no ⓘ beside the box: no `triggerLabel`, no
 * button. What must hold either way: the sentence is always in the document as
 * the box's description, it is painted on a mouse hover and on a keyboard
 * focus, and the mouse leaving and Escape put it away.
 *
 * ⚠️ jsdom has no PointerEvent and decides `:focus-visible` its own way — the
 * same two shims `icon-button.test.tsx` uses, for the same reasons.
 */
import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";

import { HintBubble } from "@/lib/ui/hint-bubble";
import { SafeMutateError, refusalCode } from "@/lib/api/safe-mutate";

const TEXT = "CNP-ul nu poate fi modificat odată setat — ștergeți și creați din nou pentru a-l schimba";

function pointer(el: Element, type: "pointerOver" | "pointerOut", pointerType: string) {
  const ev = createEvent[type](el);
  Object.defineProperty(ev, "pointerType", { value: pointerType });
  fireEvent(el, ev);
}

function focusVisible(answer: boolean) {
  const real = Element.prototype.matches;
  return jest.spyOn(Element.prototype, "matches").mockImplementation(function (this: Element, sel: string) {
    if (sel === ":focus-visible") return answer;
    return real.call(this, sel);
  });
}

function box() {
  render(
    <label>
      <span id="lbl">CNP</span>
      <HintBubble id="cnp-hint" text={TEXT}>
        <input aria-labelledby="lbl" aria-describedby="cnp-hint" defaultValue="1800101420010" />
      </HintBubble>
    </label>,
  );
  return screen.getByRole("textbox");
}

const painted = () => !screen.getByRole("tooltip", { hidden: true }).classList.contains("sr-only");

describe("HintBubble with no triggerLabel (#37.50)", () => {
  afterEach(() => jest.restoreAllMocks());

  it("draws no ⓘ, and the sentence describes the box while closed", () => {
    const input = box();
    expect(screen.queryByRole("button")).toBeNull();
    expect(input).toHaveAccessibleName("CNP");
    expect(input).toHaveAccessibleDescription(TEXT);
    expect(painted()).toBe(false);
  });

  it("opens on a mouse hover and closes when the mouse leaves", () => {
    const input = box();
    pointer(input, "pointerOver", "mouse");
    expect(painted()).toBe(true);
    pointer(input, "pointerOut", "mouse");
    expect(painted()).toBe(false);
  });

  it("does not open on a touch", () => {
    const input = box();
    pointer(input, "pointerOver", "touch");
    expect(painted()).toBe(false);
  });

  it("opens on a keyboard focus and closes on Escape", () => {
    const input = box();
    focusVisible(true);
    act(() => input.focus());
    expect(painted()).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(painted()).toBe(false);
  });
});

describe("refusalCode (#37.50)", () => {
  it("reads the code of a refusal safeMutate threw", () => {
    const err = new SafeMutateError("CNP cannot be changed once set; delete and recreate the person instead", 400, {
      error: "CNP cannot be changed once set; delete and recreate the person instead",
      code: "CNP_LOCKED",
    });
    expect(refusalCode(err)).toBe("CNP_LOCKED");
  });

  it("is undefined for anything else", () => {
    expect(refusalCode(new SafeMutateError("x", 400, { error: "x" }))).toBeUndefined();
    expect(refusalCode(new SafeMutateError("x", 400, null))).toBeUndefined();
    expect(refusalCode(new Error("CNP_LOCKED"))).toBeUndefined();
    expect(refusalCode("CNP_LOCKED")).toBeUndefined();
  });
});
