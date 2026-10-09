/**
 * Slice #38.36 — a role is edited in one place, and the app says „Rol" and
 * „Tip legătură".
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import fs from "fs";
import path from "path";
import type { ReactNode } from "react";

import { RoleScope } from "@/app/admin/value-lists/_components/role-scope";
import {
  addPair,
  pairsOfRole,
  pairsOfType,
  removePair,
  setPairHoldsShare,
  type DocTypePersonRolePair,
} from "@/lib/admin/doc-type-person-roles/client";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join("|")}` : key,
}));

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const pair = (over: Partial<DocTypePersonRolePair>): DocTypePersonRolePair => ({
  id: "p", documentTypeId: "t", personRoleId: "r", documentTypeName: "Contract de Vânzare",
  personRoleName: "Vânzător", holdsShare: true, linkCount: 0, ...over,
});

const wrap = (node: ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};

function serve(pairs: DocTypePersonRolePair[]) {
  const calls: { url: string; method: string; body?: string }[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body as string | undefined });
    const json = url.includes("doc-type-person-roles") ? { items: pairs }
      : url.includes("/value-lists/document-types") ? { items: [{ id: "t2", name: "Plan Parcelar" }] }
      : {};
    return { ok: true, status: 200, redirected: false, json: async () => json };
  }) as unknown as typeof fetch;
  return calls;
}

describe("the chips are the existing columns", () => {
  it("Proprietate and Persoană read and write valid_for_property / valid_for_person", () => {
    serve([]);
    const onToggle = jest.fn();
    wrap(<RoleScope roleId="r" roleName="Vânzător" validForProperty validForPerson={false} onToggle={onToggle} />);
    const property = screen.getByRole("button", { name: "chipProperty" });
    const person = screen.getByRole("button", { name: "chipPerson" });
    expect(property.getAttribute("aria-pressed")).toBe("true");
    expect(person.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(person);
    expect(onToggle).toHaveBeenCalledWith("validForPerson", true);
  });

  it("Act is on exactly when the role has a document type, and lists them with „Deține cotă”", async () => {
    serve([pair({ id: "a", documentTypeName: "Contract de Vânzare", holdsShare: true, linkCount: 3 })]);
    wrap(<RoleScope roleId="r" roleName="Vânzător" validForProperty={false} validForPerson={false} onToggle={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "chipAct" }).getAttribute("aria-pressed")).toBe("true"));
    const tick = await screen.findByRole("checkbox", { name: "holdsShareLabel:Contract de Vânzare|Vânzător" });
    expect((tick as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("links:3")).toBeTruthy();
  });

  it("turning Act off while types are listed asks first, naming them", async () => {
    serve([pair({ id: "a", documentTypeName: "Contract de Vânzare" }), pair({ id: "b", documentTypeName: "Act Adițional" })]);
    wrap(<RoleScope roleId="r" roleName="Vânzător" validForProperty={false} validForPerson={false} onToggle={jest.fn()} />);
    const act = screen.getByRole("button", { name: "chipAct" });
    await waitFor(() => expect(act.getAttribute("aria-pressed")).toBe("true"));
    fireEvent.click(act);
    expect(screen.getByRole("alertdialog", { name: "actOffTitle" }).textContent).toContain("actOff:„Act Adițional”, „Contract de Vânzare”");
  });

  it("a role not yet saved chooses its types after the save", () => {
    serve([]);
    wrap(<RoleScope roleId={null} roleName="" validForProperty={false} validForPerson={false} onToggle={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "chipAct" }));
    expect(screen.getByText("saveFirst")).toBeTruthy();
  });

  it("is in the role's form, in place of the two checkboxes", () => {
    const modal = read("src", "app", "admin", "value-lists", "_components", "value-list-modal.tsx");
    expect(modal).toContain('if (isRole && (f.key === "validForProperty" || f.key === "validForPerson")) return null;');
    expect(modal).toMatch(/<RoleScope\s+roleId=\{state\.id\}/);
  });
});

describe("one module of writes for the role ↔ type rows", () => {
  it("adds, ticks and removes through the existing routes", async () => {
    const calls = serve([]);
    await addPair({ documentTypeId: "t", personRoleId: "r" });
    await setPairHoldsShare("p", true);
    await removePair("p");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/admin/doc-type-person-roles",
      "PATCH /api/admin/doc-type-person-roles/p",
      "DELETE /api/admin/doc-type-person-roles/p",
    ]);
    expect(JSON.parse(calls[1].body ?? "{}")).toEqual({ holdsShare: true });
  });

  it("reads a role's types and a type's roles from the same rows", () => {
    const rows = [
      pair({ id: "1", personRoleId: "r", documentTypeId: "t1", documentTypeName: "Plan Parcelar", personRoleName: "Vânzător" }),
      pair({ id: "2", personRoleId: "r", documentTypeId: "t2", documentTypeName: "Act Adițional", personRoleName: "Vânzător" }),
      pair({ id: "3", personRoleId: "q", documentTypeId: "t2", documentTypeName: "Act Adițional", personRoleName: "Cumpărător" }),
    ];
    expect(pairsOfRole(rows, "r").map((p) => p.id)).toEqual(["2", "1"]);
    expect(pairsOfType(rows, "t2").map((p) => p.id)).toEqual(["3", "2"]);
  });

  it("the list counts the links that use each pair (Ask first 1: said before a type is taken off)", () => {
    const q = read("src", "lib", "admin", "doc-type-person-roles", "queries.ts");
    expect(q).toContain("WHERE d.document_type_id = ${lookupDocTypePersonRole.documentTypeId}");
    expect(q).toContain("AND pd.person_role_id = ${lookupDocTypePersonRole.personRoleId}");
    expect(q).toContain("linkCount:        linkCountOfPair,");
  });

  it("the „Roluri pe Document” grid is gone", () => {
    expect(fs.existsSync(path.join(process.cwd(), "src", "app", "admin", "value-lists", "_components", "document-persons-modal.tsx"))).toBe(false);
    expect(read("src", "app", "admin", "value-lists", "_components", "value-list-modal.tsx")).not.toContain("DocumentPersonsModal");
  });
});

describe("one vocabulary", () => {
  type Tree = { [k: string]: string | Tree };
  const ro = JSON.parse(read("messages", "ro-RO.json")) as Tree;
  const values = (t: Tree, at = ""): [string, string][] =>
    Object.entries(t).flatMap(([k, v]) => (typeof v === "string" ? [[`${at}${k}`, v] as [string, string]] : values(v, `${at}${k}.`)));
  const all = values(ro);
  const get = (p: string) => all.find(([k]) => k === p)?.[1];

  it("no label says „Tip relație”, „Rol în act”, „Roluri Persoană” or „Roluri pe Document” any more", () => {
    for (const word of ["Tip relație", "Rol în act", "Roluri Persoană", "Roluri pe Document", "Rol Persoană"]) {
      expect([word, all.filter(([, v]) => v.includes(word)).map(([k]) => k)]).toEqual([word, []]);
    }
  });

  it("a link between two objects is a „Tip legătură”, a person's link a „Rol”", () => {
    for (const p of ["property.references.colRole", "property.associateReference.labelRole", "document.references.colRole", "document.associateReference.labelRole"]) {
      expect([p, get(p)]).toEqual([p, "Tip legătură"]);
    }
    for (const p of ["shared.personReferences.colRole", "shared.associatePersonReference.labelRole"]) {
      expect([p, get(p)]).toEqual([p, "Rol"]);
    }
    expect(get("shared.document.roleInDocument")).toBe("Rol: „{role}”");
  });

  // #38.61 renamed the list „Roluri Persoane" (was „Roluri"), so the path follows it.
  it("the sentences that sent the user to the grid send them to the role's panel", () => {
    for (const p of ["shared.noRolesForType", "shared.roleStranded", "document.aiPartyLinker.roleMissingBody", "document.aiPartyLinker.roleMissingAfterCreate", "valueList.confirm.roleWhitelistPending"]) {
      expect([p, get(p)?.includes("Date de referință → Roluri Persoane → rolul → „Act”")]).toEqual([p, true]);
    }
  });
});
