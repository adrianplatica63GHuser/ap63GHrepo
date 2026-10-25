/**
 * Slice 40.62 — „Acte cu valabilitate limitată": the status first, nothing off-screen.
 *
 * Two columns: Stare (a coloured chip, a fixed width) and Titlu (the title, then the type and the date — dd.mm.yyyy,
 * not monospace — on a small grey line). The table is as wide as its tile (`table-fixed`, `w-full`), never wider. The
 * order is the query's; the words and a row's link are as before.
 */
import fs from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import type { useTranslations } from "next-intl";

import { ExpiringDocumentsSection } from "@/app/_components/dashboard-client";

jest.mock("next-intl", () => ({
  __esModule: true,
  useTranslations: () => (key: string) => key,
  useLocale: () => "ro-RO",
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("react") as typeof import("react")).createElement("a", { href, className }, children),
}));

const t = ((key: string, values?: { days?: number }) => (values?.days !== undefined ? `${key}:${values.days}` : key)) as unknown as ReturnType<typeof useTranslations>;
const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

const iso = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const DATA = [
  { id: "a", code: "DOC1", documentTypeName: "Carte de identitate", title: "Cartea lui Ion", dateValidUntil: iso(-3) },
  { id: "b", code: "DOC2", documentTypeName: "Autorizație", title: "Autorizația de construire, un titlu foarte lung care trebuie să se rupă pe mai multe rânduri", dateValidUntil: iso(5) },
  { id: "c", code: "DOC3", documentTypeName: null, title: "Contract", dateValidUntil: iso(40) },
];

function draw() {
  render(<ExpiringDocumentsSection data={DATA} t={t} amberDays={14} expiringDays={60} />);
  return document.querySelector<HTMLTableElement>("[data-expiring-table]")!;
}

describe("„Acte cu valabilitate limitată” (40.62)", () => {
  it("two columns, the status first", () => {
    const table = draw();
    expect([...table.querySelectorAll("th")].map((th) => th.textContent)).toEqual(["expiringDocuments.colStatus", "expiringDocuments.colTitle"]);
    for (const row of table.querySelectorAll("tbody tr")) expect(row.querySelectorAll("td")).toHaveLength(2);
    expect(table.querySelectorAll("tbody tr td:first-child [data-expiry-status]")).toHaveLength(3);
  });

  it("the chip: red when expired, amber inside the window, neutral beyond it; the words as before", () => {
    const chips = [...draw().querySelectorAll<HTMLElement>("[data-expiry-status]")];
    expect(chips.map((c) => c.textContent)).toEqual(["expiringDocuments.expired", "expiringDocuments.expiresInDays:5", "expiringDocuments.expiresInDays:40"]);
    expect(chips[0].className).toMatch(/\btext-alert\b/); // 40.76: the role token, red in both themes
    expect(chips[1].className).toMatch(/\btext-warning\b/);
    expect(chips[2].className).toMatch(/text-ink/);
    expect(chips[2].className).not.toMatch(/yellow|red|amber|alert|warning/);
  });

  it("the title, a link to its document, with the type and the date dd.mm.yyyy under it, not monospace", () => {
    const table = draw();
    const row = table.querySelectorAll("tbody tr")[0] as HTMLElement;
    expect(within(row).getByRole("link", { name: "Cartea lui Ion" })).toHaveAttribute("href", "/documents/a");
    const meta = row.querySelector("[data-expiry-meta]")!;
    expect(meta.textContent).toMatch(/^Carte de identitate · \d{2}\.\d{2}\.\d{4}$/);
    expect(row.querySelector("[data-expiry-date]")!.textContent).toBe(iso(-3).split("-").reverse().join("."));
    expect(table.innerHTML).not.toMatch(/font-mono/);
    expect((table.querySelectorAll("tbody tr")[2] as HTMLElement).querySelector("[data-expiry-meta]")!.textContent).toMatch(/^— · /);
  });

  it("as wide as its tile and never wider; a long title wraps", () => {
    const table = draw();
    expect(table.className).toMatch(/\bw-full\b/);
    expect(table.className).toMatch(/\btable-fixed\b/);
    expect(table.querySelectorAll("col")[0].getAttribute("style")).toMatch(/width: \d+(\.\d+)?rem/);
    expect(table.querySelectorAll("tbody td")[1].className).toMatch(/break-words/);
    expect(document.querySelector("[data-expiring-frame]")!.className).not.toMatch(/overflow-x|TABLE_FRAME/);
  });

  it("the order is the query's (by expiry date) and the old columns' words are gone", () => {
    expect(screen.queryByText("expiringDocuments.colType")).toBeNull();
    for (const f of ["ro-RO.json", "en-GB.json"]) {
      const ed = JSON.parse(read("messages", f)).dashboard.expiringDocuments;
      expect([ed.colType, ed.colDate, typeof ed.colStatus, typeof ed.colTitle]).toEqual([undefined, undefined, "string", "string"]);
    }
    expect(read("src", "lib", "dashboard", "queries.ts")).toContain(".orderBy(document.dateValidUntil)");
  });
});
