/**
 * A related record in a Previzualizare tile — read-only, at most two.
 *                                                              (Slice #37.24)
 *
 * A PREVIEW NEVER CHANGES DATA. Rendered here from the same body the screens
 * draw, with a record's main fields: it offers „Deschide" (a link to the
 * record) and „Închide", and NOTHING else — no box to type into, no
 * „Modifică", no „Fă curentă", no „Salvează", no „Șterge", no „Asociază" or
 * „Dezasociază". And its source reaches none of the forms, the version strip or
 * the association tabs, so a later edit cannot quietly bring one in.
 *
 * AT MOST TWO. `nextPreviews` keeps the order they were opened in; a third
 * replaces the oldest, and opening one that is already open changes nothing.
 *
 * Written red first: run 20260929T… failed on the missing module before
 * `preview-tile-body.tsx` and `previews.ts` existed: jest 20260929T035302Z-3999.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen, within } from "@testing-library/react";
import { PreviewTileBody } from "@/components/tiles/preview-tile-body";
import { MAX_PREVIEWS, nextPreviews, previewKey, type PreviewTarget } from "@/lib/ui/previews";

const LABELS = { open: "Deschide", close: "Închide", readonly: "Numai citire", firstPage: "Prima pagină", noPage: "Nicio pagină" };

function renderBody(image?: { url: string; mimeType: string | null } | null) {
  return render(
    <PreviewTileBody
      title="Contract de vânzare"
      code="DOC04388"
      fields={[
        { label: "Tip document", value: "Contract de Vânzare" },
        { label: "Subiect", value: "Teren arabil" },
        { label: "Nr. document", value: null },
      ]}
      openHref="/documents/1"
      labels={LABELS}
      onClose={() => {}}
      image={image}
      width="panel"
    />,
  );
}

describe("a preview never changes data (#37.24)", () => {
  it("offers „Deschide” and „Închide”, and nothing else to press or type into", () => {
    renderBody({ url: "/p.png", mimeType: "image/png" });
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Închide"]);
    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["Deschide"]);
    expect(links[0].getAttribute("href")).toBe("/documents/1");
    for (const role of ["textbox", "combobox", "checkbox", "radio", "spinbutton"] as const) {
      expect(screen.queryAllByRole(role)).toHaveLength(0);
    }
  });

  it("shows none of the words of the controls that write", () => {
    const { container } = renderBody();
    for (const word of ["Modifică", "Fă curentă", "Salvează", "Șterge", "Asociază", "Dezasociază", "Reîncarcă"]) {
      expect(container.textContent).not.toContain(word);
    }
  });

  it("shows each field, an empty one as a dash, and says it is read-only", () => {
    renderBody();
    const region = screen.getByRole("region", { name: /Contract de vânzare/ });
    expect(within(region).getByText("Teren arabil")).toBeTruthy();
    expect(within(region).getByText("Numai citire")).toBeTruthy();
    expect(within(region).getAllByText("—").length).toBeGreaterThan(0);
  });

  it.each(["preview-tiles.tsx", "preview-tile-body.tsx"])("%s reaches no form, no version strip, no association tab and no write", (file) => {
    const src = readFileSync(join(process.cwd(), "src", "components", "tiles", file), "utf8");
    for (const banned of [/-form"/, /version-nav/i, /-tab"/, /entity-metadata-tab/, /method:\s*"(POST|PATCH|PUT|DELETE)"/]) {
      expect(src).not.toMatch(banned);
    }
  });
});

describe("at most two previews (#37.24)", () => {
  const a: PreviewTarget = { kind: "person", id: "a" };
  const b: PreviewTarget = { kind: "company", id: "b" };
  const c: PreviewTarget = { kind: "document", id: "c" };

  it("opens in order, and a third replaces the oldest", () => {
    expect(MAX_PREVIEWS).toBe(2);
    const one = nextPreviews([], a);
    const two = nextPreviews(one, b);
    expect(two.map(previewKey)).toEqual(["person:a", "company:b"]);
    expect(nextPreviews(two, c).map(previewKey)).toEqual(["company:b", "document:c"]);
  });

  it("opening one that is already open changes nothing", () => {
    const two = nextPreviews(nextPreviews([], a), b);
    expect(nextPreviews(two, { kind: "person", id: "a" })).toBe(two);
  });
});
