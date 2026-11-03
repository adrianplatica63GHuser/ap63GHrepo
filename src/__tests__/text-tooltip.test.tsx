/**
 * TextTooltip — a hover text in the icon buttons' bubble, at their size.                    (Slice 41.46)
 *
 * The header's Ask firsts: one bubble class for IconTooltip and TextTooltip (1); cut text opens only when it is cut,
 * `always` whatever the width (2); the text in `data-hint`, no `title` (4). And the hook's own behaviour: a keyboard
 * focus opens it, Escape closes it, a press closes it.
 *
 * ⚠️ jsdom has no layout: every `scrollWidth` and `clientWidth` is 0, so „cut" is defined on the element by `cutBy`,
 * and `pointer()` builds the PointerEvent jsdom lacks — the same two helpers as icon-button.test.tsx.
 */
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { ArrowLeft } from "lucide-react";

import { IconButton } from "@/lib/ui/icon-button";
import { TextTooltip, isCut } from "@/lib/ui/text-tooltip";
import { TOOLTIP_BUBBLE_CLASS } from "@/lib/ui/tooltip-bubble";

function pointer(el: Element, type: "pointerOver" | "pointerOut", pointerType = "mouse") {
  const ev = createEvent[type](el);
  Object.defineProperty(ev, "pointerType", { value: pointerType });
  fireEvent(el, ev);
}

function cutBy(el: HTMLElement, scroll: number, client: number) {
  Object.defineProperty(el, "scrollWidth", { configurable: true, value: scroll });
  Object.defineProperty(el, "clientWidth", { configurable: true, value: client });
}

const bubble = () => document.querySelector<HTMLElement>("[data-text-tooltip]");

describe("TextTooltip — when it opens (Ask first 2)", () => {
  it("text that fits opens nothing; cut short, the whole text in the bubble", () => {
    render(<TextTooltip as="div" className="truncate" text="Un subtitlu foarte lung" data-testid="t">Un subtitlu foarte lung</TextTooltip>);
    const el = screen.getByTestId("t");
    cutBy(el, 100, 100);
    pointer(el, "pointerOver");
    expect(bubble()).toBeNull();
    pointer(el, "pointerOut");
    cutBy(el, 240, 100);
    pointer(el, "pointerOver");
    expect(bubble()).toHaveTextContent("Un subtitlu foarte lung");
    expect(screen.getByRole("tooltip")).toBe(bubble());
    pointer(el, "pointerOut");
    expect(bubble()).toBeNull();
  });

  it("`always` opens whatever the width — „Arată N câmpuri goale”, a count, a kind's mark", () => {
    render(<TextTooltip always text="Câmpuri goale: Telefon, Email" data-testid="t">Arată 2 câmpuri goale</TextTooltip>);
    pointer(screen.getByTestId("t"), "pointerOver");
    expect(bubble()).toHaveTextContent("Câmpuri goale: Telefon, Email");
  });

  it("a touch opens nothing; nothing at all without a text", () => {
    render(
      <>
        <TextTooltip always text="A" data-testid="a">a</TextTooltip>
        <TextTooltip always text="  " data-testid="b">b</TextTooltip>
      </>,
    );
    pointer(screen.getByTestId("a"), "pointerOver", "touch");
    pointer(screen.getByTestId("b"), "pointerOver");
    expect(bubble()).toBeNull();
    expect(screen.getByTestId("b")).not.toHaveAttribute("data-hint");
  });

  it("a cut child counts — a line-clamped or ellipsed span inside the element", () => {
    render(<TextTooltip text="x" data-testid="t"><span data-testid="in">x</span></TextTooltip>);
    const inner = screen.getByTestId("in");
    cutBy(inner, 50, 20);
    expect(isCut(screen.getByTestId("t"))).toBe(true);
    cutBy(inner, 20, 20);
    expect(isCut(screen.getByTestId("t"))).toBe(false);
  });
});

describe("TextTooltip — keyboard, Escape, a press", () => {
  it("a keyboard focus opens it; Escape closes it", () => {
    const spy = jest.spyOn(Element.prototype, "matches").mockImplementation(function (this: Element, sel: string) {
      return sel === ":focus-visible";
    });
    try {
      render(<TextTooltip always text="Toate câmpurile" role="button" tabIndex={0} data-testid="t">Arată</TextTooltip>);
      fireEvent.focus(screen.getByTestId("t"));
      expect(bubble()).not.toBeNull();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(bubble()).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("a press closes it, and the element's own handlers still run", () => {
    const onClick = jest.fn();
    const onPointerDown = jest.fn();
    render(<TextTooltip always text="Hint" onClick={onClick} onPointerDown={onPointerDown} data-testid="t">x</TextTooltip>);
    const el = screen.getByTestId("t");
    pointer(el, "pointerOver");
    expect(bubble()).not.toBeNull();
    fireEvent.pointerDown(el);
    fireEvent.click(el);
    expect(bubble()).toBeNull();
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("TextTooltip — the icon buttons' bubble (Ask firsts 1 and 4)", () => {
  it("draws the one bubble class IconTooltip draws: 12 px, medium, wrapping at 20 rem", () => {
    expect(TOOLTIP_BUBBLE_CLASS).toMatch(/\btext-xs\b/);
    expect(TOOLTIP_BUBBLE_CLASS).toMatch(/\bfont-medium\b/);
    expect(TOOLTIP_BUBBLE_CLASS).toMatch(/max-w-\[20rem\]/);
    expect(TOOLTIP_BUBBLE_CLASS).not.toMatch(/whitespace-nowrap|truncate/);
    render(
      <>
        <IconButton icon={ArrowLeft} label="Înapoi" variant="secondary" size="sm" />
        <TextTooltip always text="Hint" data-testid="t">x</TextTooltip>
      </>,
    );
    pointer(screen.getByRole("button", { name: "Înapoi" }), "pointerOver");
    pointer(screen.getByTestId("t"), "pointerOver");
    const icon = document.querySelector<HTMLElement>("[data-icon-tooltip]")!;
    expect(icon.className).toBe(TOOLTIP_BUBBLE_CLASS);
    expect(bubble()!.className).toBe(TOOLTIP_BUBBLE_CLASS);
  });

  it("the text is in `data-hint`, never in `title`", () => {
    render(<TextTooltip text="Întreg" data-testid="t">Întreg</TextTooltip>);
    const el = screen.getByTestId("t");
    expect(el).toHaveAttribute("data-hint", "Întreg");
    expect(el).not.toHaveAttribute("title");
  });
});
