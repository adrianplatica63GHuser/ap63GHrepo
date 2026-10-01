/**
 * IconButton — one icon button for the whole app.               (Slice #37.42)
 *
 * What the header asks of it, one block each: the accessible name is the label;
 * the tooltip opens on a mouse hover and on a keyboard focus, not on a touch or
 * a mouse focus, and closes on Escape; a disabled button still opens it on
 * hover; busy shows the spinner and the busy name; the badge shows the count
 * and hides at zero; the link form renders an <a>. Plus the geometry the rows
 * depend on: an icon-only square exactly as tall as a text button of its size.
 *
 * ⚠️ jsdom has no PointerEvent, so a fired `pointerOver` arrives without a
 * `pointerType` and React's `onPointerEnter` reads `undefined`. `pointer()`
 * below builds the event and defines the property, which is what a browser
 * hands React. And jsdom decides `:focus-visible` its own way, so the keyboard
 * and mouse focus cases pin `matches(":focus-visible")` to the answer a browser
 * gives for each — that call is the hook's whole decision.
 */
import { createRef } from "react";
import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { ArrowLeft, ExternalLink, LogIn, Trash2 } from "lucide-react";

import { buttonClass, linkClass, BUTTON_SIZES } from "@/lib/ui/button-styles";
import { IconButton, ICON_PX, LeadingIcon, TrailingIcon } from "@/lib/ui/icon-button";

function pointer(el: Element, type: "pointerOver" | "pointerOut", pointerType: string) {
  const ev = createEvent[type](el);
  Object.defineProperty(ev, "pointerType", { value: pointerType });
  fireEvent(el, ev);
}

function tooltip() {
  return screen.queryByRole("tooltip");
}

/** Make `matches(":focus-visible")` answer as a browser would for this focus. */
function focusVisible(answer: boolean) {
  const real = Element.prototype.matches;
  const spy = jest.spyOn(Element.prototype, "matches").mockImplementation(function (this: Element, sel: string) {
    if (sel === ":focus-visible") return answer;
    return real.call(this, sel);
  });
  return spy;
}

describe("IconButton — the name", () => {
  it("is the label, and only the icon is drawn", () => {
    render(<IconButton icon={ArrowLeft} label="Înapoi la listă" variant="secondary" size="lg" />);
    const button = screen.getByRole("button", { name: "Înapoi la listă" });
    expect(button).toHaveAttribute("aria-label", "Înapoi la listă");
    expect(button.textContent).toBe("");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(button.querySelector("svg")).toHaveAttribute("width", String(ICON_PX.lg));
  });

  it("icon + label with iconEnd: the words first, the icon after them (#37.47)", () => {
    render(<IconButton icon={ArrowLeft} label="Continuă" variant="primary" showLabel iconEnd />);
    const button = screen.getByRole("button", { name: "Continuă" });
    expect(button.firstElementChild?.tagName.toLowerCase()).toBe("span");
    expect(button.lastElementChild?.tagName.toLowerCase()).toBe("svg");
    expect(button.querySelectorAll("svg")).toHaveLength(1);
  });

  it("iconEnd changes nothing on an icon-only button", () => {
    render(<IconButton icon={ArrowLeft} label="Înapoi" variant="secondary" iconEnd />);
    const button = screen.getByRole("button", { name: "Înapoi" });
    expect(button.firstElementChild?.tagName.toLowerCase()).toBe("svg");
  });

  it("icon + label: the icon before the words, the words the name, and no tooltip", () => {
    render(<IconButton icon={Trash2} label="Adaugă persoană" variant="primary" size="lg" showLabel />);
    const button = screen.getByRole("button", { name: "Adaugă persoană" });
    expect(button).not.toHaveAttribute("aria-label");
    expect(button.firstElementChild?.tagName.toLowerCase()).toBe("svg");
    pointer(button, "pointerOver", "mouse");
    expect(tooltip()).toBeNull();
  });
});

describe("IconButton — the tooltip", () => {
  afterEach(() => jest.restoreAllMocks());

  it("opens on a mouse hover and closes when the mouse leaves", () => {
    render(<IconButton icon={ArrowLeft} label="Înapoi" variant="secondary" />);
    const button = screen.getByRole("button", { name: "Înapoi" });
    pointer(button, "pointerOver", "mouse");
    expect(tooltip()).toHaveTextContent("Înapoi");
    pointer(button, "pointerOut", "mouse");
    expect(tooltip()).toBeNull();
  });

  it("does not open on a touch", () => {
    render(<IconButton icon={ArrowLeft} label="Înapoi" variant="secondary" />);
    pointer(screen.getByRole("button", { name: "Înapoi" }), "pointerOver", "touch");
    expect(tooltip()).toBeNull();
  });

  it("opens on a keyboard focus", () => {
    focusVisible(true);
    render(<IconButton icon={ArrowLeft} label="Înapoi" variant="secondary" />);
    fireEvent.focus(screen.getByRole("button", { name: "Înapoi" }));
    expect(tooltip()).toHaveTextContent("Înapoi");
  });

  it("does not open on a mouse focus", () => {
    focusVisible(false);
    render(<IconButton icon={ArrowLeft} label="Înapoi" variant="secondary" />);
    fireEvent.focus(screen.getByRole("button", { name: "Înapoi" }));
    expect(tooltip()).toBeNull();
  });

  it("closes on Escape, and leaves Escape to whoever else is listening", () => {
    render(<IconButton icon={ArrowLeft} label="Înapoi" variant="secondary" />);
    pointer(screen.getByRole("button", { name: "Înapoi" }), "pointerOver", "mouse");
    expect(tooltip()).not.toBeNull();
    const dialog = jest.fn();
    document.addEventListener("keydown", dialog);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    document.removeEventListener("keydown", dialog);
    expect(tooltip()).toBeNull();
    expect(dialog).toHaveBeenCalled();
  });

  it("closes when the button is pressed", () => {
    render(<IconButton icon={ArrowLeft} label="Înapoi" variant="secondary" />);
    const button = screen.getByRole("button", { name: "Înapoi" });
    pointer(button, "pointerOver", "mouse");
    fireEvent.pointerDown(button);
    expect(tooltip()).toBeNull();
  });

  it("is drawn in <body>, outside any container that could clip it", () => {
    const { container } = render(
      <div style={{ overflow: "hidden" }}>
        <IconButton icon={ArrowLeft} label="Înapoi" variant="secondary" />
      </div>,
    );
    pointer(screen.getByRole("button", { name: "Înapoi" }), "pointerOver", "mouse");
    expect(container.contains(tooltip())).toBe(false);
    expect(tooltip()?.parentElement).toBe(document.body);
  });
});

describe("IconButton — disabled", () => {
  it("still opens its tooltip on hover — the tooltip is its name", () => {
    render(<IconButton icon={ArrowLeft} label="Următor" variant="secondary" size="xs" disabled />);
    const button = screen.getByRole("button", { name: "Următor" });
    expect(button).toBeDisabled();
    // The pointer reaches the wrapper: a disabled button lets it through.
    expect(button.className).toContain("disabled:pointer-events-none");
    pointer(button.parentElement as Element, "pointerOver", "mouse");
    expect(tooltip()).toHaveTextContent("Următor");
  });

  it("keeps the disabled look buttonClass gives every variant", () => {
    render(<IconButton icon={Trash2} label="Șterge" variant="danger" disabled />);
    const cls = screen.getByRole("button", { name: "Șterge" }).className;
    for (const k of ["disabled:bg-white", "disabled:border-wire", "disabled:text-fade", "bg-danger"]) {
      expect(cls.split(" ")).toContain(k);
    }
  });
});

describe("IconButton — busy", () => {
  it("swaps the icon for a spinner, and the busy text becomes the name and the tooltip", () => {
    render(<IconButton icon={Trash2} label="Șterge" busyLabel="Se șterge…" busy variant="danger" />);
    const button = screen.getByRole("button", { name: "Se șterge…" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector("svg")?.getAttribute("class")).toContain("animate-spin");
    expect(button.querySelector("svg")?.getAttribute("class")).toContain("motion-reduce:animate-none");
    pointer(button, "pointerOver", "mouse");
    expect(tooltip()).toHaveTextContent("Se șterge…");
  });

  it("an icon + label button keeps its words on screen, so its width holds", () => {
    render(<IconButton icon={Trash2} label="Salvează" busyLabel="Se salvează…" busy showLabel variant="primary" />);
    const button = screen.getByRole("button", { name: "Se salvează…" });
    expect(button).toHaveTextContent("Salvează");
    expect(button.querySelector("svg")?.getAttribute("class")).toContain("animate-spin");
  });
});

describe("IconButton — the count badge", () => {
  it("shows the count on the icon's corner, the full text being the name", () => {
    render(<IconButton icon={Trash2} label="Șterge selecția (3)" count={3} variant="danger" />);
    const button = screen.getByRole("button", { name: "Șterge selecția (3)" });
    const badge = button.querySelector("[data-icon-badge]");
    expect(badge).toHaveTextContent("3");
    expect(badge).toHaveAttribute("aria-hidden", "true");
  });

  it("shows no badge at zero", () => {
    render(<IconButton icon={Trash2} label="Șterge selecția (0)" count={0} variant="danger" />);
    expect(screen.getByRole("button").querySelector("[data-icon-badge]")).toBeNull();
  });
});

describe("IconButton — a note (#37.43)", () => {
  it("adds a line under the label in the tooltip, and is the button's description", () => {
    render(<IconButton icon={ArrowLeft} label="Modifică" note="Doar versiunea curentă se poate modifica" variant="secondary" disabled />);
    const button = screen.getByRole("button", { name: "Modifică" });
    expect(button).toHaveAccessibleDescription("Doar versiunea curentă se poate modifica");
    pointer(button.parentElement as Element, "pointerOver", "mouse");
    expect(tooltip()).toHaveTextContent("ModificăDoar versiunea curentă se poate modifica");
  });
});

describe("IconButton — a ref (#37.43)", () => {
  it("reaches the <button> itself, so a dialog can focus its close button", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<IconButton ref={ref} icon={ArrowLeft} label="Închide" variant="bare" />);
    expect(ref.current).toBe(screen.getByRole("button", { name: "Închide" }));
    act(() => ref.current?.focus());
    expect(document.activeElement).toBe(ref.current);
  });
});

describe("IconButton — the link form", () => {
  it("renders an <a> with the name, the href and the link hover", () => {
    render(<IconButton href="/natural-persons/1" icon={ArrowLeft} label="Deschide" variant="secondary" size="xs" />);
    const link = screen.getByRole("link", { name: "Deschide" });
    expect(link.tagName.toLowerCase()).toBe("a");
    expect(link).toHaveAttribute("href", "/natural-persons/1");
    expect(link.className.split(" ")).toContain("hover:bg-cta");
    pointer(link, "pointerOver", "mouse");
    expect(tooltip()).toHaveTextContent("Deschide");
  });

  it("passes the caller's click handler through", () => {
    const clicked = jest.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(<IconButton href="/x" onClick={clicked} icon={ArrowLeft} label="Vizualizare" variant="secondary" />);
    fireEvent.click(screen.getByRole("link", { name: "Vizualizare" }));
    expect(clicked).toHaveBeenCalledTimes(1);
  });
});

describe("buttonClass — the icon-only square (#37.42)", () => {
  const HEIGHT = { xs: "h-6.5", sm: "h-7.5", md: "h-8.5", lg: "h-9.5" } as const;
  it.each(BUTTON_SIZES)("%s is a square as tall as the %s text button, with no padding to fight it", (size) => {
    const keys = buttonClass({ variant: "secondary", size, iconOnly: true }).split(" ");
    expect(keys).toContain(HEIGHT[size]);
    expect(keys).toContain(HEIGHT[size].replace("h-", "w-"));
    expect(keys).toContain("p-0");
    expect(keys.filter((k) => /^p[xy]-/.test(k))).toEqual([]);
  });

  it("changes nothing but the geometry", () => {
    const text = buttonClass({ variant: "danger", size: "sm" }).split(" ").filter((k) => !/^p[xy]?-/.test(k));
    const icon = buttonClass({ variant: "danger", size: "sm", iconOnly: true }).split(" ").filter((k) => !/^(p|h|w)-/.test(k));
    expect(icon.sort()).toEqual(text.sort());
  });
});

describe("linkClass (#37.42)", () => {
  it("adds a hover a link can match, and keeps everything buttonClass gives", () => {
    const button = buttonClass({ variant: "primary", size: "lg" }).split(" ");
    const link = linkClass({ variant: "primary", size: "lg" }).split(" ");
    for (const k of button) expect(link).toContain(k);
    expect(link).toContain("hover:bg-cta-d");
  });
});

describe("TrailingIcon (#37.46)", () => {
  it("draws the icon after the link's words, hidden, and leaves the link's name alone", () => {
    render(
      <a href="/x" target="_blank" rel="noreferrer">
        Deschide Tipuri de Document (se deschide într-o filă nouă)
        <TrailingIcon icon={ExternalLink} />
      </a>,
    );
    const link = screen.getByRole("link", { name: "Deschide Tipuri de Document (se deschide într-o filă nouă)" });
    const svg = link.querySelector("svg[data-trailing-icon]");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg?.getAttribute("class")).toContain("lucide-external-link");
    expect(link.lastElementChild).toBe(svg);
  });
});

describe("LeadingIcon (#37.47)", () => {
  it("draws the icon before the link's words, hidden, and leaves the link's name alone", () => {
    render(
      <a href="/login">
        <LeadingIcon icon={LogIn} />
        Conectare
      </a>,
    );
    const link = screen.getByRole("link", { name: "Conectare" });
    const svg = link.querySelector("svg[data-leading-icon]");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg?.getAttribute("class")).toContain("lucide-log-in");
    expect(link.firstElementChild).toBe(svg);
  });
});
