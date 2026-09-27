/**
 * FU-228 — „RECENTE" forgets a record that was deleted.       (Slice #37.07)
 *
 * The sidebar's list of recent visits lives in localStorage and nothing took
 * an entry out when its record was deleted, so it kept offering a link to a
 * record that no longer existed (PROP02161 in TC-PROP-04's run, DOC02375 in
 * TC-ASSOC-12's). Each of the four detail forms' delete now calls
 * `forgetRecentlyViewed(id)`, which drops that record's entries and tells the
 * provider, so the list changes on the same screen.
 */
import fs from "node:fs";
import path from "node:path";
import { act, render, screen } from "@testing-library/react";

import {
  NavigationHistoryProvider,
  forgetRecentlyViewed,
  useNavigationHistory,
} from "@/components/providers/navigation-history-provider";

const KEY = "ga40_recently_viewed";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const entries = [
  { href: `/properties/${A}`, label: "Teren A", code: "PROP00001", entityType: "PROPERTY", visitedAt: 2 },
  { href: `/documents/${B}`, label: "Act B", code: "DOC00002", entityType: "DOCUMENT", visitedAt: 1 },
];

function Codes() {
  const { recentlyViewed } = useNavigationHistory();
  return <p data-testid="codes">{recentlyViewed.map((e) => e.code).join(",")}</p>;
}

beforeEach(() => localStorage.setItem(KEY, JSON.stringify(entries)));
afterEach(() => localStorage.clear());

describe("FU-228: a deleted record leaves „RECENTE”", () => {
  it("drops that record's entries only, by id", () => {
    expect(forgetRecentlyViewed(A)).toBe(1);
    const left = JSON.parse(localStorage.getItem(KEY) ?? "[]") as { code: string }[];
    expect(left.map((e) => e.code)).toEqual(["DOC00002"]);
    expect(forgetRecentlyViewed("33333333-3333-4333-8333-333333333333")).toBe(0);
  });

  it("does not match an id that is only part of a path segment", () => {
    expect(forgetRecentlyViewed(A.slice(0, 8))).toBe(0);
  });

  it("changes the list on the screen at once", () => {
    render(
      <NavigationHistoryProvider>
        <Codes />
      </NavigationHistoryProvider>,
    );
    expect(screen.getByTestId("codes").textContent).toBe("PROP00001,DOC00002");
    act(() => {
      forgetRecentlyViewed(B);
    });
    expect(screen.getByTestId("codes").textContent).toBe("PROP00001");
  });

  it.each([
    ["src/app/documents/_components/document-form.tsx", "documentId"],
    ["src/app/judicial-persons/_components/judicial-person-form.tsx", "personId"],
    ["src/app/natural-persons/_components/natural-person-form.tsx", "personId"],
    ["src/app/properties/_components/property-form.tsx", "propertyId"],
  ])("%s forgets the record in its delete", (file, idVar) => {
    const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const onDelete = code.slice(code.indexOf("const onDelete = async"));
    const body = onDelete.slice(0, onDelete.indexOf("} catch"));
    expect(body).toContain(`forgetRecentlyViewed(${idVar}!)`);
    expect(body.indexOf("if (!res.ok)")).toBeLessThan(body.indexOf("forgetRecentlyViewed("));
  });
});
