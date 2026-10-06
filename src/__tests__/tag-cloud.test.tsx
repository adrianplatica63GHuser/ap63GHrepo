/**
 * Slice #38.14 — Administrare → Etichete: the cloud alone. A double click
 * selects or deselects a tag; „Redenumește etichetă" (one selected) renames it
 * in the chip itself — Enter saves through the route, Escape cancels;
 * „Fuzionează etichete" (two or more) opens the merge with the selected tags
 * ticked; none selected, both inactive. The table and the rename dialog are gone.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "fs";
import { join } from "path";

import { TagManager, cloudActions } from "@/app/admin/tags/_components/tag-manager";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join("|")}` : key,
}));

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
let tags = [
  { tag: "tc-tag-02-a", count: 1 },
  { tag: "tc-tag-02-b", count: 3 },
  { tag: "tc-tag-02-c", count: 1 },
];
let patches: { from: string; to: string }[] = [];

beforeEach(() => {
  tags = [
    { tag: "tc-tag-02-a", count: 1 },
    { tag: "tc-tag-02-b", count: 3 },
    { tag: "tc-tag-02-c", count: 1 },
  ];
  patches = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      const body = JSON.parse(String(init.body)) as { from: string; to: string };
      patches.push(body);
      tags = tags.filter((t) => t.tag !== body.from).concat(tags.some((t) => t.tag === body.to) ? [] : [{ tag: body.to, count: 1 }]);
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    return { ok: true, status: 200, json: async () => ({ tags }) };
  }) as unknown as typeof fetch;
});

async function renderCloud() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TagManager />
    </QueryClientProvider>,
  );
  await screen.findByText("tc-tag-02-a");
}
const chip = (tag: string) => document.querySelector<HTMLElement>(`[data-tag-chip="${tag}"]`)!;
const rename = () => screen.getByRole("button", { name: "cloud.rename" });
const merge = () => screen.getByRole("button", { name: "merge.open" });

describe("the cloud's buttons (#38.14)", () => {
  it("none: both inactive; one: rename; two or more: merge, rename inactive", () => {
    expect(cloudActions(0)).toEqual({ rename: false, merge: false });
    expect(cloudActions(1)).toEqual({ rename: true, merge: false });
    expect(cloudActions(2)).toEqual({ rename: false, merge: true });
    expect(cloudActions(5)).toEqual({ rename: false, merge: true });
  });

  it("the page is the cloud alone, its two buttons at its top right, a double click toggling a chip", async () => {
    await renderCloud();
    expect(document.querySelector("table")).toBeNull();
    expect(document.querySelectorAll("[data-panel]")).toHaveLength(1);
    expect((rename() as HTMLButtonElement).disabled).toBe(true);
    expect((merge() as HTMLButtonElement).disabled).toBe(true);
    // A single click selects nothing.
    fireEvent.click(chip("tc-tag-02-a"), { detail: 1 });
    expect(chip("tc-tag-02-a").getAttribute("aria-pressed")).toBe("false");
    fireEvent.doubleClick(chip("tc-tag-02-a"));
    expect(chip("tc-tag-02-a").getAttribute("aria-pressed")).toBe("true");
    expect(chip("tc-tag-02-a").className).toContain("ring-2");
    expect((rename() as HTMLButtonElement).disabled).toBe(false);
    expect((merge() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.doubleClick(chip("tc-tag-02-b"));
    expect((rename() as HTMLButtonElement).disabled).toBe(true);
    expect((merge() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.doubleClick(chip("tc-tag-02-b"));
    fireEvent.doubleClick(chip("tc-tag-02-a"));
    expect(chip("tc-tag-02-a").getAttribute("aria-pressed")).toBe("false");
    expect((rename() as HTMLButtonElement).disabled).toBe(true);
    // From the keyboard: Enter or Space on the chip is a click with no pointer (`detail` 0).
    fireEvent.click(chip("tc-tag-02-c"), { detail: 0 });
    expect(chip("tc-tag-02-c").getAttribute("aria-pressed")).toBe("true");
  });
});

describe("rename on the spot (#38.14)", () => {
  it("the chip becomes a box holding its name; Enter renames through the route; the selection clears", async () => {
    await renderCloud();
    fireEvent.doubleClick(chip("tc-tag-02-a"));
    fireEvent.click(rename());
    const box = screen.getByRole("textbox", { name: "cloud.renameBox:tc-tag-02-a" }) as HTMLInputElement;
    expect(box.value).toBe("tc-tag-02-a");
    fireEvent.change(box, { target: { value: "TC-TAG-02-D" } });
    expect(box.value).toBe("tc-tag-02-d");
    await act(async () => {
      fireEvent.keyDown(box, { key: "Enter" });
    });
    await waitFor(() => expect(patches).toEqual([{ from: "tc-tag-02-a", to: "tc-tag-02-d" }]));
    await screen.findByText("tc-tag-02-d");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(document.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
  });

  it("the same name is refused under the cloud; Escape cancels with nothing sent", async () => {
    await renderCloud();
    fireEvent.doubleClick(chip("tc-tag-02-a"));
    fireEvent.click(rename());
    const box = screen.getByRole("textbox");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(screen.getByRole("alert").textContent).toBe("rename.errorSame");
    fireEvent.change(box, { target: { value: "tc-tag-02-x" } });
    fireEvent.keyDown(box, { key: "Escape" });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(patches).toEqual([]);
    expect(chip("tc-tag-02-a").tagName).toBe("BUTTON");
  });
});

describe("„Fuzionează etichete” (#38.14)", () => {
  it("opens the existing merge with the selected tags ticked", async () => {
    await renderCloud();
    fireEvent.doubleClick(chip("tc-tag-02-a"));
    fireEvent.doubleClick(chip("tc-tag-02-c"));
    fireEvent.click(merge());
    const dialog = screen.getByRole("dialog");
    const ticked = within(dialog)
      .getAllByRole("checkbox")
      .filter((c) => (c as HTMLInputElement).checked)
      .map((c) => c.closest("label")!.querySelector("span")!.textContent);
    expect(ticked).toEqual(["tc-tag-02-a", "tc-tag-02-c"]);
  });
});

describe("the words (#38.14)", () => {
  it("the explanation keeps its first sentence and says how the cloud is used; the table's words are gone", () => {
    const ro = JSON.parse(read("messages", "ro-RO.json")).adminTags;
    const en = JSON.parse(read("messages", "en-GB.json")).adminTags;
    expect(ro.cloud.note).toMatch(/^Mărimea fiecărei etichete reflectă numărul de entități etichetate\. Faceți dublu clic/);
    expect(ro.cloud.note).not.toContain("tabel");
    expect(ro.cloud.rename).toBe("Redenumește etichetă");
    expect(ro.merge.open).toBe("Fuzionează etichete");
    expect(en.cloud.rename).toBe("Rename tag");
    expect(ro.list).toBeUndefined();
    expect(en.list).toBeUndefined();
    expect(Object.keys(ro.rename).sort()).toEqual(["errorGeneric", "errorSame", "hint"]);
    expect(read("src", "app", "admin", "tags", "_components", "tag-manager.tsx")).not.toMatch(/RenameModal|scrollToTag|<table/);
  });
});
