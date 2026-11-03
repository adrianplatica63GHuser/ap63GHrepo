/**
 * Slice 41.42 — two lists and the buttons between them (src/components/screen/two-lists.tsx), the piece a group's
 * members use and 41.43's stamp will: the checked rows move by the buttons, one row by a double-click or by Enter, each
 * list's heading carries its count, the buttons theirs, and a list scrolls after twelve rows.
 */
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Eraser, ListMinus, ListPlus, Stamp } from "lucide-react";
import {
  TWO_LIST_FRAME_REM,
  TWO_LIST_HEAD_REM,
  TWO_LIST_ROWS,
  TWO_LIST_ROW_REM,
  TWO_LIST_TOOLBAR_REM,
  TwoLists,
  type TwoListRow,
} from "@/components/screen/two-lists";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const ROWS: Record<string, string> = { a: "Teren A", b: "Teren B", c: "Teren C", d: "Teren D" };

function Harness({ start, spy }: { start: string[]; spy: { include: string[][]; takeOut: string[][] } }) {
  const [left, setLeft] = useState<string[]>(start);
  const right = Object.keys(ROWS).filter((id) => !left.includes(id));
  const row = (id: string): TwoListRow => ({ id, label: ROWS[id], pending: start.includes(id) !== left.includes(id) });
  return (
    <TwoLists
      left={{ name: "in", title: "Deja în grup", rows: left.map(row), empty: "gol" }}
      right={{ name: "out", title: "Disponibile", rows: right.map(row), empty: "nimic" }}
      includeLabel={(n) => `‹ Include (${n})`}
      takeOutLabel={(n) => `Scoate › (${n})`}
      includeIcon={ListPlus}
      takeOutIcon={ListMinus}
      onInclude={(ids) => { spy.include.push(ids); setLeft((l) => [...l, ...ids]); }}
      onTakeOut={(ids) => { spy.takeOut.push(ids); setLeft((l) => l.filter((x) => !ids.includes(x))); }}
    />
  );
}

function setup(start = ["a"]) {
  const spy = { include: [] as string[][], takeOut: [] as string[][] };
  render(<Harness start={start} spy={spy} />);
  const left = () => screen.getByRole("region", { name: "Deja în grup" });
  const right = () => screen.getByRole("region", { name: "Disponibile" });
  const ids = (list: HTMLElement) => [...list.querySelectorAll<HTMLElement>("[data-two-list-row]")].map((e) => e.dataset.twoListRow);
  const count = (list: HTMLElement) => list.querySelector("[data-two-list-count]")?.textContent;
  return { spy, left, right, ids, count };
}

describe("TwoLists (41.42)", () => {
  it("the left list, the buttons, the right list; each heading with its count; the buttons disabled while nothing is checked", () => {
    const { left, right, ids, count } = setup();
    const grid = document.querySelector("[data-two-lists]")!;
    expect([...grid.children].map((e) => (e as HTMLElement).dataset.twoList ?? "buttons")).toEqual(["in", "buttons", "out"]);
    expect(ids(left())).toEqual(["a"]);
    expect(ids(right())).toEqual(["b", "c", "d"]);
    expect([count(left()), count(right())]).toEqual(["1", "3"]);
    expect(screen.getByRole("button", { name: "‹ Include (0)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Scoate › (0)" })).toBeDisabled();
  });

  it("the right's checked rows go left by „‹ Include”, with their count; the left's go right by „Scoate ›”", () => {
    const { spy, left, right, ids } = setup();
    fireEvent.click(within(right()).getByRole("checkbox", { name: "Teren B" }));
    fireEvent.click(within(right()).getByRole("checkbox", { name: "Teren D" }));
    fireEvent.click(screen.getByRole("button", { name: "‹ Include (2)" }));
    expect(spy.include).toEqual([["b", "d"]]);
    expect(ids(left())).toEqual(["a", "b", "d"]);
    expect(ids(right())).toEqual(["c"]);
    // The ticks went with the rows: nothing is checked on the right now.
    expect(screen.getByRole("button", { name: "‹ Include (0)" })).toBeDisabled();
    fireEvent.click(within(left()).getByRole("checkbox", { name: "Teren A" }));
    fireEvent.click(screen.getByRole("button", { name: "Scoate › (1)" }));
    expect(spy.takeOut).toEqual([["a"]]);
    expect(ids(right())).toEqual(["a", "c"]);
  });

  it("a double-click moves one row, either way; a moved row is marked", () => {
    const { spy, left, right, ids } = setup();
    fireEvent.doubleClick(right().querySelector('[data-two-list-row="c"]')!);
    expect(spy.include).toEqual([["c"]]);
    const c = left().querySelector<HTMLElement>('[data-two-list-row="c"]')!;
    expect(c.hasAttribute("data-pending")).toBe(true);
    expect(c.textContent).toContain("pending");
    fireEvent.doubleClick(left().querySelector('[data-two-list-row="a"]')!);
    expect(spy.takeOut).toEqual([["a"]]);
    expect(ids(right())).toEqual(["a", "b", "d"]);
  });

  it("Enter on a focused row moves it, as the double-click does", () => {
    const { spy, left } = setup();
    const box = within(left()).getByRole("checkbox", { name: "Teren A" });
    box.focus();
    fireEvent.keyDown(box, { key: "Enter" });
    expect(spy.takeOut).toEqual([["a"]]);
    fireEvent.keyDown(screen.getByRole("checkbox", { name: "Teren B" }), { key: " " });
    expect(spy.include).toEqual([]);
  });

  // 41.58 inverted in place — was „each list scrolls after twelve rows", a max-height of 24rem on both lists, so the side
  // with no search box was a toolbar shorter. Adrian: „the list on the left should not be sized to hold only 12 items
  // just like the list on the right". Both frames are one fixed height now; the side without a toolbar gives its band
  // to its rows.
  it("both frames one height, toolbar or not — twelve rows under a toolbar, its band too without one; the empty list says so", () => {
    expect(TWO_LIST_ROWS).toBe(12);
    expect(TWO_LIST_FRAME_REM).toBe(TWO_LIST_HEAD_REM + TWO_LIST_TOOLBAR_REM + TWO_LIST_ROWS * TWO_LIST_ROW_REM);
    render(
      <TwoLists
        left={{ name: "in", title: "Deja în grup", rows: [], empty: "gol" }}
        right={{ name: "out", title: "Disponibile", rows: [], empty: "nimic", toolbar: <input type="search" aria-label="Caută" /> }}
        includeLabel={(n) => `‹ Include (${n})`}
        takeOutLabel={(n) => `Scoate › (${n})`}
        includeIcon={ListPlus}
        takeOutIcon={ListMinus}
        onInclude={() => {}}
        onTakeOut={() => {}}
      />,
    );
    const left = screen.getByRole("region", { name: "Deja în grup" });
    const right = screen.getByRole("region", { name: "Disponibile" });
    for (const list of [left, right]) {
      // A height, not a max-height: equal however few rows each holds.
      // (jsdom's cssstyle writes the calc as „calc(2px + …rem)" — so its two terms, not its order.)
      expect(list.style.height).toMatch(/^calc\(/);
      expect(list.style.height).toContain(`${TWO_LIST_FRAME_REM}rem`);
      expect(list.style.height).toContain("2px");
      expect(list.style.maxHeight).toBe("");
      const rows = list.querySelector<HTMLElement>("[data-two-list-rows]")!;
      expect(rows.style.maxHeight).toBe("");
      expect(rows.className).toContain("flex-1");
      expect(rows.className).toContain("overflow-y-auto");
    }
    expect(right.querySelector<HTMLElement>("input[type=search]")!.parentElement!.style.height).toBe(`${TWO_LIST_TOOLBAR_REM}rem`);
    expect(left.querySelector("input")).toBeNull();
    expect(left.textContent).toContain("gol");
  });

  it("41.43: a head stands over both lists, and the buttons may carry their action's icons", () => {
    render(
      <TwoLists
        head={<label>Tip element<select aria-label="Tip element" /></label>}
        left={{ name: "in", title: "Ștampilate", rows: [], empty: "gol" }}
        right={{ name: "out", title: "Disponibile", rows: [], empty: "nimic" }}
        includeLabel={(n) => `‹ Aplică ștampila (${n})`}
        takeOutLabel={(n) => `Elimină ștampila › (${n})`}
        includeIcon={Stamp}
        takeOutIcon={Eraser}
        onInclude={() => {}}
        onTakeOut={() => {}}
      />,
    );
    const head = document.querySelector<HTMLElement>("[data-two-list-head]")!;
    expect(head.nextElementSibling?.matches("[data-two-lists]")).toBe(true);
    expect(within(head).getByRole("combobox", { name: "Tip element" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "‹ Aplică ștampila (0)" }).querySelector("svg")?.getAttribute("class")).toContain("lucide-stamp");
    expect(screen.getByRole("button", { name: "Elimină ștampila › (0)" }).querySelector("svg")?.getAttribute("class")).toContain("lucide-eraser");
  });

  it("no heading element: inside a tile only TileTitle writes one", () => {
    setup();
    expect(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).toHaveLength(0);
  });
});
