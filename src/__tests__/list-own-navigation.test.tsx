/**
 * #39.96 — Acte's „Tip document:" stays open while types are ticked and unticked.
 *
 * Adrian, 2026-10-19: unticking „Toate tipurile" made the checklist disappear; „I want it to stay so I can select one or
 * more types and when I click outside of the filter it can disappear". The cause was not the empty list's message: every
 * tick closed it. Each tick goes to a new address with the router, and `ListAddressScope` (#39.26) started the whole list
 * over on any address it had not written itself — the open checklist with it. The type filter's address is the list's own
 * now (`ownListAddress`), so the list keeps its place; a link from outside still starts it over.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { useEffect } from "react";
import { render } from "@testing-library/react";
import { ListAddressScope, ownListAddress } from "@/components/list/use-list-address";

jest.mock("next/navigation", () => ({ usePathname: () => "/documents", useSearchParams: () => new URLSearchParams(window.location.search) }));

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

let mounts = 0;
function Probe() {
  useEffect(() => {
    mounts += 1;
  }, []);
  return null;
}
const tree = () => (
  <ListAddressScope>
    <Probe />
  </ListAddressScope>
);

describe("ListAddressScope and the list's own navigation (#39.96)", () => {
  beforeEach(() => {
    mounts = 0;
    window.history.replaceState(null, "", "/documents");
  });

  it("keeps the list in place on an address the list went to itself", () => {
    const { rerender } = render(tree());
    expect(mounts).toBe(1);
    window.history.pushState(null, "", ownListAddress("/documents?documentTypeIds=a%2Cb"));
    rerender(tree());
    window.history.pushState(null, "", ownListAddress("/documents?documentTypeIds="));
    rerender(tree());
    window.history.pushState(null, "", ownListAddress("/documents"));
    rerender(tree());
    expect(mounts).toBe(1);
  });

  it("still starts it over on an address from outside — a link, or Back to an earlier choice", () => {
    const { rerender } = render(tree());
    window.history.pushState(null, "", "/documents?documentTypeIds=c");
    rerender(tree());
    expect(mounts).toBe(2);
  });

  it("returns the address unchanged", () => {
    expect(ownListAddress("/documents?q=Ion&documentTypeIds=a")).toBe("/documents?q=Ion&documentTypeIds=a");
    expect(ownListAddress("/documents")).toBe("/documents");
  });

  it("„Tip document:” goes through it, and carries an open preview along with the search and the filters", () => {
    const view = read("src", "app", "documents", "list-view.tsx");
    expect(view).toContain('return ownListAddress(qs ? `/documents?${qs}` : "/documents");');
    expect(view).toContain("for (const k of [LIST_PARAM.row, LIST_PARAM.tiles]) {");
    // The page still starts over on a new set of types — the list's own render-phase reset.
    expect(view).toMatch(/if \(prevTypeFiltersKey !== typeFiltersKey\) \{\s*setPrevTypeFiltersKey\(typeFiltersKey\);\s*setCurrentPage\(0\);/);
  });
});
