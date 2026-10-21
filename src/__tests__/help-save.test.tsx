/**
 * „Acceptă", „Acceptă toate" and „Salvează" in „Informații de ajutor": they save, and a failure says why.  (Slice 40.15)
 *
 * Adrian, 2026-10-21: „I have tried to accept the new changes inside the help information as I usually do; I get an
 * error cannot save". The three buttons said the same sentence whatever had happened. These tests drive the real hub
 * over a real query cache with `fetch` mocked — success, and each failure the route can answer — and check every entry
 * of HELP_PROPOSALS against what the route accepts, so the six proposals waiting on the database are known to save
 * without pressing them on Adrian's archive (Ask first 4, 5).
 *
 * `useTranslations` returns the key, with its arguments after a „|", so a reason is read by its key.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, args?: Record<string, unknown>) => (args ? `${key}|${JSON.stringify(args)}` : key),
}));

// Two proposals of our own, each written against the text its row holds, so both are offered.
const ROWS = [
  { screenKey: "admin-global-search", backgroundRo: "Vechi A", howToRo: "Cum A", backgroundEn: "Old A", howToEn: "How A" },
  { screenKey: "properties-map", backgroundRo: "Vechi B", howToRo: "Cum B", backgroundEn: "Old B", howToEn: "How B" },
];
jest.mock("@/lib/help/proposals-data", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { helpFingerprint } = require("@/lib/help/proposals") as typeof import("@/lib/help/proposals");
  const rows = [
    { screenKey: "admin-global-search", backgroundRo: "Vechi A", howToRo: "Cum A", backgroundEn: "Old A", howToEn: "How A" },
    { screenKey: "properties-map", backgroundRo: "Vechi B", howToRo: "Cum B", backgroundEn: "Old B", howToEn: "How B" },
  ];
  return {
    HELP_PROPOSALS: Object.fromEntries(
      rows.map((r) => [
        r.screenKey,
        { against: helpFingerprint(r), reason: "test", backgroundRo: `Nou ${r.screenKey}`, howToRo: "Cum nou", backgroundEn: "New", howToEn: "How new" },
      ]),
    ),
  };
});

import { HelpContentHub } from "@/app/admin/help-content/_components/help-content-hub";
import { HELP_PROPOSALS as REAL_PROPOSALS } from "@/lib/help/proposals-data";
import { helpFingerprint, proposalTexts } from "@/lib/help/proposals";
import { HelpSaveError, helpSaveFailure, failureOf } from "@/lib/help/save-failure";
import { saveHelpContent } from "@/lib/help/save-help-content";
import { helpContentUpsertSchema } from "@/lib/help/validation";
import { isHelpScreenKey } from "@/lib/help/registry";

type Answer = { status: number; body?: unknown; type?: string; headers?: Record<string, string> } | "network";
type Call = { url: string; method: string; body: Record<string, unknown> | null };

function response(a: Exclude<Answer, "network">) {
  return {
    ok: a.status >= 200 && a.status < 300,
    status: a.status,
    type: a.type ?? "basic",
    redirected: false,
    url: "",
    headers: { get: (h: string) => a.headers?.[h] ?? null },
    json: async () => a.body ?? null,
  };
}

/** `put` answers each PUT in turn (the last one repeats); GET /api/admin/help-content answers the rows. */
function mockFetch(put: Answer[]): Call[] {
  const calls: Call[] = [];
  let n = 0;
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
    if (method === "PUT") {
      const a = put[Math.min(n++, put.length - 1)];
      if (a === "network") throw new TypeError("Failed to fetch");
      return response(a);
    }
    if (url === "/api/admin/help-content") return response({ status: 200, body: { items: ROWS } });
    if (url === "/api/admin/help-hints") return response({ status: 200, body: { items: [] } });
    return response({ status: 404 });
  }) as unknown as typeof fetch;
  return calls;
}

function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><HelpContentHub /></QueryClientProvider>);
}

async function openProposal(key = "admin-global-search") {
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^screens\\.${key}`) }));
  return screen.findByRole("region", { name: "proposal.title" });
}

const puts = (calls: Call[]) => calls.filter((c) => c.method === "PUT");

describe("helpSaveFailure — the reason from the status and the body's code, never its text", () => {
  it.each([
    [{ status: 0, type: "opaqueredirect" }, null, "signedOut"],
    [{ status: 200, redirected: true, url: "http://localhost:3000/login" }, null, "signedOut"],
    [{ status: 401 }, null, "signedOut"],
    [{ status: 403 }, { code: "forbidden" }, "forbidden"],
    [{ status: 400 }, { code: "unknown_screen" }, "unknownScreen"],
    [{ status: 400 }, { code: "invalid_input" }, "invalid"],
    [{ status: 409 }, { code: "text_changed" }, "textChanged"],
    [{ status: 500 }, { code: "database" }, "database"],
    [{ status: 500 }, null, "database"],
    [{ status: 503 }, { code: "role_unavailable" }, "database"],
    [{ status: 418 }, { error: "I'm a teapot" }, "other"],
  ] as const)("%j %j → %s", (res, body, failure) => {
    expect(helpSaveFailure(res, body)).toBe(failure);
  });

  it("anything else a mutation throws is „no answer”", () => {
    expect(failureOf(new TypeError("Failed to fetch"))).toEqual({ failure: "network", status: null });
    expect(failureOf(new HelpSaveError("forbidden", 403))).toEqual({ failure: "forbidden", status: 403 });
  });
});

describe("saveHelpContent — one PUT, its fingerprint, one more try on a 503", () => {
  const TEXTS = { backgroundRo: "a", howToRo: "b", backgroundEn: "c", howToEn: "d" };
  const noWait = jest.fn(async () => undefined);

  it("sends the four texts, and `against` only when given, without following a redirect", async () => {
    const calls = mockFetch([{ status: 200, body: { item: {} } }]);
    await saveHelpContent("admin-tags", TEXTS);
    await saveHelpContent("admin-tags", TEXTS, "0123abcd");
    expect(puts(calls).map((c) => c.body)).toEqual([TEXTS, { ...TEXTS, against: "0123abcd" }]);
    expect((global.fetch as jest.Mock).mock.calls[0][1].redirect).toBe("manual");
  });

  it("tries once more after Retry-After on a 503, and gives up after the second", async () => {
    mockFetch([{ status: 503, body: { code: "role_unavailable" }, headers: { "Retry-After": "5" } }, { status: 200, body: {} }]);
    await expect(saveHelpContent("admin-tags", TEXTS, undefined, noWait)).resolves.toEqual({});
    expect(noWait).toHaveBeenCalledWith(5_000);
    mockFetch([{ status: 503, body: { code: "role_unavailable" } }]);
    await expect(saveHelpContent("admin-tags", TEXTS, undefined, noWait)).rejects.toMatchObject({ failure: "database", status: 503 });
  });

  it("names a redirect to /login, and no answer at all", async () => {
    mockFetch([{ status: 0, type: "opaqueredirect" }]);
    await expect(saveHelpContent("admin-tags", TEXTS)).rejects.toMatchObject({ failure: "signedOut", status: null });
    mockFetch(["network"]);
    await expect(saveHelpContent("admin-tags", TEXTS)).rejects.toMatchObject({ failure: "network", status: null });
  });
});

describe("„Acceptă” on one proposal", () => {
  it("saves the proposal's four texts with the fingerprint it was written against", async () => {
    const calls = mockFetch([{ status: 200, body: { item: {} } }]);
    open();
    const panel = await openProposal();
    fireEvent.click(within(panel).getByRole("button", { name: "proposal.accept" }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    const [put] = puts(calls);
    expect(put.url).toBe("/api/admin/help-content/admin-global-search");
    expect(put.body).toEqual({ backgroundRo: "Nou admin-global-search", howToRo: "Cum nou", backgroundEn: "New", howToEn: "How new", against: helpFingerprint(ROWS[0]) });
    await waitFor(() => expect(within(panel).queryByRole("alert")).toBeNull());
  });

  it.each([
    [{ status: 0, type: "opaqueredirect" }, "signedOut"],
    [{ status: 403, body: { code: "forbidden" } }, "forbidden"],
    [{ status: 400, body: { error: "Unknown screen key", code: "unknown_screen" } }, "unknownScreen"],
    [{ status: 400, body: { error: "Invalid input", code: "invalid_input" } }, "invalid"],
    [{ status: 409, body: { code: "text_changed" } }, "textChanged"],
    [{ status: 500, body: { error: "Failed to save", code: "database" } }, "database"],
    ["network", "network"],
  ] as const)("a PUT answered %j says %s, not the server's text", async (answer, failure) => {
    mockFetch([answer as Answer]);
    open();
    const panel = await openProposal();
    fireEvent.click(within(panel).getByRole("button", { name: "proposal.accept" }));
    const alert = await within(panel).findByRole("alert");
    expect(alert.getAttribute("data-help-save-failed")).toBe(failure);
    expect(alert.textContent).toBe(`proposal.acceptError|${JSON.stringify({ reason: failure })}`);
    expect(alert.textContent).not.toMatch(/Failed to save|Unknown screen key|Invalid input/);
  });

  it("any other status is named with its code", async () => {
    mockFetch([{ status: 418, body: {} }]);
    open();
    const panel = await openProposal();
    fireEvent.click(within(panel).getByRole("button", { name: "proposal.accept" }));
    expect((await within(panel).findByRole("alert")).textContent).toBe(`proposal.acceptError|${JSON.stringify({ reason: `other|${JSON.stringify({ status: 418 })}` })}`);
  });
});

describe("„Acceptă toate”", () => {
  async function acceptAll() {
    fireEvent.click(await screen.findByRole("button", { name: `proposal.acceptAll|${JSON.stringify({ count: 2 })}` }));
    fireEvent.click(await screen.findByRole("button", { name: "proposal.acceptAllConfirm" }));
  }

  it("saves every offered proposal, each with its fingerprint", async () => {
    const calls = mockFetch([{ status: 200, body: {} }]);
    open();
    await acceptAll();
    await waitFor(() => expect(puts(calls)).toHaveLength(2));
    // In the list's order (HELP_SCREENS): the map's screen stands before „Căutare globală”.
    expect(puts(calls).map((c) => [c.url, c.body?.against])).toEqual([
      ["/api/admin/help-content/properties-map", helpFingerprint(ROWS[1])],
      ["/api/admin/help-content/admin-global-search", helpFingerprint(ROWS[0])],
    ]);
    expect(await screen.findByText(`proposal.acceptAllDone|${JSON.stringify({ count: 2 })}`)).toBeTruthy();
  });

  it("lists each screen that failed with its own reason, and counts the rest as saved", async () => {
    // The first PUT (the map's screen) saves; the second („Căutare globală”) finds its text changed.
    mockFetch([{ status: 200, body: {} }, { status: 409, body: { code: "text_changed" } }]);
    open();
    await acceptAll();
    const failed = await screen.findByText(`proposal.acceptAllFailed|${JSON.stringify({ count: 1 })}`);
    const items = within(failed.closest("[data-help-accept-all-failed]") as HTMLElement).getAllByRole("listitem");
    expect(items.map((li) => [li.getAttribute("data-help-save-failed"), li.textContent])).toEqual([
      ["textChanged", `proposal.acceptAllFailedScreen|${JSON.stringify({ screen: "screens.admin-global-search", reason: "textChanged" })}`],
    ]);
    expect(screen.getByText(`proposal.acceptAllDone|${JSON.stringify({ count: 1 })}`)).toBeTruthy();
  });
});

describe("the editor's „Salvează”", () => {
  it("says why it failed, and sends no fingerprint", async () => {
    const calls = mockFetch([{ status: 403, body: { code: "forbidden" } }]);
    open();
    fireEvent.click(await screen.findByRole("button", { name: /^screens\.admin-global-search/ }));
    fireEvent.click(await screen.findByRole("button", { name: "proposal.later" }));
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(await screen.findByText(`saveErrorBecause|${JSON.stringify({ reason: "forbidden" })}`)).toBeTruthy();
    expect(puts(calls)[0].body).not.toHaveProperty("against");
  });
});

describe("every proposal in proposals-data.ts is one the route accepts (Ask first 4)", () => {
  const real = jest.requireActual("@/lib/help/proposals-data") as { HELP_PROPOSALS: typeof REAL_PROPOSALS };
  const entries = Object.entries(real.HELP_PROPOSALS);

  it("there are proposals to check", () => {
    expect(entries.length).toBeGreaterThan(30);
  });

  it.each(entries.map(([k, p]) => [k, p!] as const))("%s: a registered screen, the schema's shape, a fingerprint the rule can match", (key, p) => {
    expect(isHelpScreenKey(key)).toBe(true);
    expect(p.against).toMatch(/^[0-9a-f]{8}$/);
    const parsed = helpContentUpsertSchema.safeParse({ ...proposalTexts(p), against: p.against });
    expect(parsed.success).toBe(true);
    // Accepted, the screen's text is the proposal's own — and the proposal is offered no more.
    expect(helpFingerprint(proposalTexts(p))).not.toBe(p.against);
  });
});
