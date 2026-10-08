/**
 * Slice #38.34 — the act adițional in four tiles: „Identificarea actului",
 * „Actul modificat", „Ce modifică" and „Părți"; „Actul modificat" a real link
 * to the deed it amends, the free-text fields only while there is none, and
 * one deed at most (Ask first 3).
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import fs from "fs";
import path from "path";
import type { ReactNode } from "react";

import { AmendedDeedLink } from "@/app/documents/_components/amended-deed-panel";
import { PARTIES_TILE, RENAMED_TABS, documentTileRegistry, tabTileKey } from "@/app/documents/_components/document-tiles";
import {
  PARENT_SEVERAL_CODE,
  PARENT_TAKEN_CODE,
  isParentDeedLink,
  orderDeedCandidates,
  parentConflictBody,
  parentDeedOf,
} from "@/lib/documents/parent-deed";
import { TEMPLATE_FIELD_GROUPS, isAmendedDeedGroup, templateFieldGroupOf } from "@/lib/documents/template-groups";
import { templateTabsOf } from "@/lib/documents/template-tabs";
import { parseTemplateFields } from "@/lib/documents/template-fields";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join("|")}` : key,
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
type Field = { key: string; tabRo: string | null; groupRo: string | null; groupEn: string | null; order: number };
const ACT = (JSON.parse(read("src", "db", "document-type-forms.json")) as { forms: Record<string, Field[]> }).forms.ACT_ADITIONAL;
const keysOf = (group: string) => ACT.filter((f) => f.groupRo === group).map((f) => f.key);

describe("the act adițional's 20 fields, each placed once", () => {
  it("„Identificarea actului”: the copy's quality, the copies issued and the notary's fee, on no tab (Ask first 2)", () => {
    expect(keysOf("Identificarea actului")).toEqual(["calitateExemplar", "exemplareEmise", "onorariuNotarial"]);
    expect(ACT.filter((f) => f.groupRo === "Identificarea actului").every((f) => f.tabRo === null)).toBe(true);
  });

  it("„Actul modificat”: the deed's four free-text fields, on their own tab", () => {
    expect(keysOf("Actul modificat")).toEqual(["actParinteNumar", "actParinteData", "actParinteNotariat", "actParinteTip"]);
    expect(ACT.filter((f) => f.groupRo === "Actul modificat").every((f) => f.tabRo === "Actul modificat" && f.groupEn === "Amended deed")).toBe(true);
  });

  it("„Ce modifică”: the reason, the basis, the effect, „Preț neschimbat” and the nine clauses", () => {
    expect(keysOf("Motiv și efect")).toEqual(["motivCompletare", "temeiLegalCompletare", "efectUrmarit", "pretNeschimbat"]);
    expect(keysOf("Clauze completate")).toHaveLength(9);
    expect(ACT.filter((f) => ["Motiv și efect", "Clauze completate"].includes(f.groupRo ?? "")).every((f) => f.tabRo === "Ce modifică")).toBe(true);
  });

  it("adds up to the 20, in order, with no fees panel and two tabs", () => {
    expect(ACT).toHaveLength(20);
    expect(new Set(ACT.map((f) => f.key)).size).toBe(20);
    expect(ACT.map((f) => f.order)).toEqual(ACT.map((_, i) => i));
    expect(ACT.filter((f) => !["Identificarea actului", "Actul modificat", "Motiv și efect", "Clauze completate"].includes(f.groupRo ?? ""))).toEqual([]);
    expect(templateTabsOf(parseTemplateFields(ACT))).toEqual(["Actul modificat", "Ce modifică"]);
  });
});

describe("the template group „Actul modificat”", () => {
  it("is the fifth special group, named as its tab, in both languages", () => {
    expect(TEMPLATE_FIELD_GROUPS.map((g) => g.id)).toEqual(["financial", "fees", "certificates", "identification", "amendedDeed"]);
    expect(isAmendedDeedGroup("Actul modificat")).toBe(true);
    expect(isAmendedDeedGroup("Amended deed")).toBe(true);
    expect(templateFieldGroupOf("Actul  modificat")).toBeNull();
  });

  it("is drawn by the form under the link, hidden — never unmounted — while a link stands", () => {
    const form = read("src", "app", "documents", "_components", "document-form.tsx");
    expect(form).toContain("const amendedGroup = customFieldGroups.find((g) => isAmendedDeedGroup(g.label));");
    expect(form).toMatch(/g !== identificationGroup && g !== amendedGroup/);
    expect(form).toMatch(/<AmendedDeedLink documentId=\{documentId\} readOnly=\{effectiveMode === "view"\} \/>\s*<div hidden=\{linked\}/);
  });
});

describe("the tiles", () => {
  const reg = documentTileRegistry({
    typeKey: "ACT_ADITIONAL", tabs: ["Actul modificat", "Ce modifică"], succession: false, pages: true, parties: true,
  });
  const k = tabTileKey;

  it("„Identificarea actului”, „Actul modificat”, „Ce modifică”, then „Părți”", () => {
    expect(reg.all.slice(0, 4)).toEqual(["general", k("Actul modificat"), k("Ce modifică"), PARTIES_TILE]);
    expect(reg.defaults).toEqual(["general", "pages", k("Actul modificat"), PARTIES_TILE]);
  });

  it("keeps a browser's choice of the two old tabs", () => {
    expect(RENAMED_TABS["Act adițional"]).toEqual(["Actul modificat", "Ce modifică"]);
    expect(RENAMED_TABS["Clauze adăugate"]).toBe("Ce modifică");
    expect(reg.renamed?.[k("Act adițional")]).toEqual([k("Actul modificat"), k("Ce modifică")]);
    expect(reg.renamed?.[k("Clauze adăugate")]).toBe(k("Ce modifică"));
  });
});

describe("the deed it amends", () => {
  const ref = (over: Record<string, unknown>) => ({
    id: "d", relationshipRoleName: "Act adițional la", roleReadsFromViewed: true, ...over,
  });

  it("is the link „Act adițional la” read FROM the act adițional, whatever the diacritics", () => {
    expect(isParentDeedLink(ref({}))).toBe(true);
    expect(isParentDeedLink(ref({ relationshipRoleName: "Act aditional la" }))).toBe(true);
    // Read the other way it is a deed with an addendum, not an addendum's deed.
    expect(isParentDeedLink(ref({ roleReadsFromViewed: false }))).toBe(false);
    expect(isParentDeedLink(ref({ relationshipRoleName: "Titlu anterior al" }))).toBe(false);
    expect(isParentDeedLink(ref({ relationshipRoleName: null }))).toBe(false);
    expect(parentDeedOf([ref({ id: "a", relationshipRoleName: null }), ref({ id: "b" })])?.id).toBe("b");
    expect(parentDeedOf(undefined)).toBeNull();
  });

  it("is searched for with the contracts de vânzare first, never the act itself", () => {
    const items = [
      { id: "x", typeKey: "PLAN_PARCELAR" },
      { id: "self", typeKey: "ACT_ADITIONAL" },
      { id: "c1", typeKey: "CONTRACT_VANZARE" },
      { id: "y", typeKey: null },
      { id: "c2", typeKey: "CONTRACT_VANZARE" },
    ];
    expect(orderDeedCandidates(items, "self").map((i) => i.id)).toEqual(["c1", "c2", "x", "y"]);
  });

  it("is one at most: the refusal names the deed the act already has (Ask first 3)", () => {
    const existing = { id: "e", code: "DOC9", title: "TC CVC" };
    expect(parentConflictBody({ reason: "taken", existing })).toMatchObject({ code: PARENT_TAKEN_CODE, existing });
    expect(parentConflictBody({ reason: "several" }).code).toBe(PARENT_SEVERAL_CODE);
    const queries = read("src", "lib", "documents", "queries.ts");
    expect(queries).toMatch(/export async function parentLinkConflict\(/);
    expect(queries).toMatch(/r\.relationshipRoleId === parentRoleId && r\.roleReadsFromViewed && !targets\.includes\(r\.id\)/);
    for (const route of [
      ["src", "app", "api", "documents", "[id]", "references", "route.ts"],
      ["src", "app", "api", "documents", "[id]", "instrument-references", "route.ts"],
    ]) {
      const src = read(...route);
      expect(src).toContain("parentLinkConflict(");
      expect(src.indexOf("parentLinkConflict(")).toBeLessThan(src.indexOf("associateDocumentToDocument(id"));
    }
  });
});

describe("„Actul modificat” on screen", () => {
  const deed = {
    id: "cvc", code: "DOC1", typeName: "Contract de Vânzare", title: "TC CVC", nrDocument: "118", dateDocument: "2020-03-12",
    relationshipRoleId: "r", relationshipRoleName: "Act adițional la", roleReadsFromViewed: true,
  };
  const wrap = (node: ReactNode) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
  };
  const serve = (refs: unknown[]) => {
    global.fetch = jest.fn(async (url: string) => ({
      ok: true, status: 200,
      json: async () => (url.includes("/search") ? { items: [{ id: "c9", code: "DOC9", typeName: "Contract de Vânzare", typeKey: "CONTRACT_VANZARE", title: "TC alt CVC" }] } : { items: refs }),
    })) as unknown as typeof fetch;
  };

  it("with a link: the deed, its type, number and date, „open” and „unlink” — and no „not in the archive” line", async () => {
    serve([deed]);
    const { container } = wrap(<AmendedDeedLink documentId="act" readOnly={false} />);
    await screen.findByText("TC CVC");
    expect(screen.getByText("Contract de Vânzare · number:118 · date:2020-03-12")).toBeTruthy();
    expect(screen.getByRole("link", { name: "open" }).getAttribute("href")).toBe("/documents/cvc");
    expect(screen.getByRole("button", { name: "unlink" })).toBeTruthy();
    expect(container.querySelector("[data-not-in-archive]")).toBeNull();
  });

  it("without one: „link the amended deed”, a search, and the line over the fallback fields", async () => {
    serve([]);
    const { container } = wrap(<AmendedDeedLink documentId="act" readOnly={false} />);
    await waitFor(() => expect(container.querySelector("[data-not-in-archive]")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "link" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "searchLabel" }), { target: { value: "TC" } });
    expect(await screen.findByRole("button", { name: "linkThis:TC alt CVC" })).toBeTruthy();
  });

  it("read-only, or not yet saved: nothing to press", async () => {
    serve([]);
    wrap(<AmendedDeedLink documentId={undefined} readOnly={false} />);
    expect(screen.getByText("saveFirst")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "link" })).toBeNull();
  });
});
