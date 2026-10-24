/**
 * Slice 40.48 — the funnel's two looks, shared with the sort icon (40.47).
 *
 * Adrian, 2026-10-24: „a filtering icon that is not in use will display just like today but without the circle around
 * it - a filtering icon that is in use be solid Navy blue with the circle around it". Both icons in a name cell's
 * corner are `CornerButton`: not in use the glyph alone (`bare`), in use `IN_USE_CORNER` with the glyph solid. The
 * browser half is TC-LAYOUT-10 step 9.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { Funnel } from "lucide-react";
import { CornerButton } from "@/components/list/corner-button";
import { FilterFunnel } from "@/components/list/filter-bar";
import { ColumnSort } from "@/components/list/column-sort";
import { IN_USE_CORNER, buttonClass } from "@/lib/ui/button-styles";
import { DEFAULT_LIST_ORDER } from "@/lib/list/list-order";

jest.mock("next-intl", () => {
  const messages = jest.requireActual("../../messages/ro-RO.json");
  return {
    useTranslations: (ns: string) => (key: string, values?: Record<string, string>) => {
      const raw = `${ns}.${key}`.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], messages);
      return String(raw ?? key).replace(/\{(\w+)\}/g, (_, k: string) => values?.[k] ?? "");
    },
  };
});

const bare = buttonClass({ variant: "bare", size: "xs", iconOnly: true, square: "corner", className: "relative" });

describe("the corner button's two looks", () => {
  it("not in use: the glyph alone — no border, no fill — the corner square", () => {
    render(<CornerButton icon={Funnel} label="f" inUse={false} solid="fill" pressed={false} onPress={jest.fn()} />);
    const b = screen.getByRole("button", { name: "f" });
    expect(b.className).toBe(bare);
    expect(b.className).toContain("border-0 bg-transparent");
    expect(b.className).toContain("h-[13px] w-[13px]");
    for (const c of IN_USE_CORNER.split(" ")) expect(b.className).not.toContain(c);
    expect(b.querySelector("svg")?.getAttribute("fill")).toBe("none");
    expect(b).toHaveAttribute("data-in-use", "false");
  });

  it("in use: navy in a navy circle, the funnel filled, the arrow heavier", () => {
    const { unmount } = render(<CornerButton icon={Funnel} label="f" inUse solid="fill" pressed onPress={jest.fn()} />);
    const b = screen.getByRole("button", { name: "f" });
    for (const c of IN_USE_CORNER.split(" ")) expect(b.className).toContain(c);
    expect(b.className).toContain("h-[13px] w-[13px]");
    expect(b.querySelector("svg")?.getAttribute("fill")).toBe("currentColor");
    expect(b).toHaveAttribute("aria-pressed", "true");
    unmount();
    render(<CornerButton icon={Funnel} label="s" inUse solid="stroke" onPress={jest.fn()} />);
    const s = screen.getByRole("button", { name: "s" });
    expect(s.querySelector("svg")?.getAttribute("stroke-width")).toBe("3.25");
    expect(s.querySelector("svg")?.getAttribute("fill")).toBe("none");
    expect(s.hasAttribute("aria-pressed")).toBe(false);
  });

  it("a press never reaches the cell under it", () => {
    const onPress = jest.fn();
    const onCell = jest.fn();
    render(<div onClick={onCell}><CornerButton icon={Funnel} label="f" inUse={false} onPress={onPress} /></div>);
    fireEvent.click(screen.getByRole("button", { name: "f" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onCell).not.toHaveBeenCalled();
  });
});

describe("the funnel and the sort icon wear them alike (Ask first 3)", () => {
  it("the funnel: not in use bare, in use filled navy; its name and aria-pressed unchanged", () => {
    const { rerender } = render(<FilterFunnel field="gender" label="Gen" active={false} onOpen={jest.fn()} />);
    let f = screen.getByRole("button", { name: "Filtrează după „Gen”" });
    expect(f.className).toBe(bare);
    expect(f).toHaveAttribute("aria-pressed", "false");
    rerender(<FilterFunnel field="gender" label="Gen" active onOpen={jest.fn()} />);
    f = screen.getByRole("button", { name: "Filtrează după „Gen”" });
    expect(f.className).toContain("text-navy!");
    expect(f).toHaveAttribute("aria-pressed", "true");
  });

  it("the sort icon not in use is as bare as the funnel", () => {
    render(<ColumnSort sort="age" label="Vârstă" order={DEFAULT_LIST_ORDER} onChange={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Ordonează după „Vârstă”" }).className).toBe(bare);
  });
});
