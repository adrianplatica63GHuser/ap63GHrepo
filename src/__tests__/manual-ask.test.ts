/**
 * @jest-environment node
 */

/**
 * „Întreabă” — the pick, the answer's prompt, the reading of Claude's text, and POST /api/manual/ask.
 *                                                                                    (Slices #39.45, #39.49)
 *
 * Claude is mocked (global fetch): no real AI call is made by a test. What is under test is the header's rule —
 * by meaning, the manual the only source, and never a list of near misses: Claude gets the question and the
 * manual's outline and names the sections that answer it, or none; an id that is not a section is dropped; the
 * answer is written from those sections' text alone; when nothing answers, the page gets „not in the manual” and
 * no list. Every call to the API is recorded as a paid read („ask-manual”).
 */
import { NextRequest } from "next/server";
import { ASK_MODEL } from "@/lib/ai/models";
import {
  askPrompt,
  answerRuns,
  CONTEXT_MAX,
  manualOutline,
  NO_SECTION,
  NOT_IN_MANUAL,
  PICK_MAX,
  pickSystem,
  pickUser,
  readAnswer,
  readPick,
  sectionText,
} from "@/lib/manual/ask";
import { getManual, manualTarget } from "@/lib/manual/manual";
import { MANUAL_OUTLINE } from "@/lib/manual/outline";

jest.mock("@/lib/auth/current-user", () => ({
  __esModule: true,
  getCurrentUser: jest.fn().mockResolvedValue({ id: "u1", email: "adrian@example.com" }),
}));

jest.mock("@/lib/ai/paid-reads", () => ({
  __esModule: true,
  recordPaidRead: jest.fn().mockResolvedValue(undefined),
}));

import { getCurrentUser } from "@/lib/auth/current-user";
import { recordPaidRead } from "@/lib/ai/paid-reads";
import { POST } from "@/app/api/manual/ask/route";

const sections = [
  { id: "persons-add", number: "3.2", title: "O persoană adăugată de mână", text: "§3.2 …\nPe lista persoanelor fizice, apăsați „Adaugă persoană”." },
  { id: "start-sign-in", number: "2.1", title: "Conectarea", text: "§2.1 …" },
];

describe("the pick", () => {
  const ro = getManual("ro-RO");
  const outline = manualOutline(ro, MANUAL_OUTLINE["ro-RO"]);

  it("hands Claude every section of the manual, each with its number, id, title and line, and the rule for none", () => {
    const sys = pickSystem("ro", outline);
    expect(outline.length).toBe([...ro.targets.values()].filter((t) => t.kind === "section").length);
    expect(outline.every((e) => e.summary.length > 0)).toBe(true);
    const add = outline.find((e) => e.id === "persons-add")!;
    expect(sys).toContain(`${add.number} | persons-add | ${add.title} — ${add.summary}`);
    expect(sys).toContain(NO_SECTION);
    expect(sys).toMatch(/what it MEANS/);
    expect(pickUser("  cum adaug o persoană? ")).toBe("Question: cum adaug o persoană?");
  });

  it("keeps the ids that are sections, once each, at most five, and nothing for NONE", () => {
    const known = new Set(outline.map((e) => e.id));
    expect(readPick("persons-add\nnu-exista\npersons-add\nstart-sign-in", known)).toEqual(["persons-add", "start-sign-in"]);
    expect(readPick(NO_SECTION, known)).toEqual([]);
    expect(readPick("", known)).toEqual([]);
    expect(readPick("`persons-add`, start-sign-in.", known)).toEqual(["persons-add", "start-sign-in"]);
    const many = outline.slice(0, 9).map((e) => e.id).join("\n");
    expect(readPick(many, known)).toHaveLength(PICK_MAX);
  });

  it("gives a section's whole text, its subsections' too, and nothing for an id that is not one", () => {
    const text = sectionText(ro, "persons-add")!;
    expect(text.startsWith(`§${manualTarget("ro-RO", "persons-add")!.number} `)).toBe(true);
    const sub = ro.chapters.flatMap((c) => c.blocks).find((b) => b.kind === "heading" && b.level === 3 && b.id.startsWith("persons-add-"));
    if (sub && sub.kind === "heading") expect(text).toContain(`§${sub.number} ${sub.title}`);
    expect(sectionText(ro, "nu-exista")).toBeNull();
  });
});

describe("the prompt", () => {
  it("holds the question and only the sections given, numbered, and the rule for no answer", () => {
    const { system, user } = askPrompt("cum adaug o persoană?", "ro", sections);
    expect(user).toContain("Question: cum adaug o persoană?");
    expect(user).toContain('<section number="3.2">');
    expect(user).toContain('<section number="2.1">');
    expect(system).toContain(NOT_IN_MANUAL);
    expect(system).toContain("Romanian");
    expect(system).toMatch(/ONLY the user-manual sections/);
  });

  it("never hands over more than its limit of text", () => {
    const big = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, number: `${i}.1`, title: "t", text: "x".repeat(5000) }));
    const { user } = askPrompt("q", "en", big);
    expect(user.length).toBeLessThan(CONTEXT_MAX + 1000);
  });
});

describe("reading the answer", () => {
  it("the fixed word is „the manual does not say”", () => {
    expect(readAnswer(NOT_IN_MANUAL, sections)).toEqual({ kind: "not-in-manual" });
    expect(readAnswer("  ", sections)).toEqual({ kind: "not-in-manual" });
  });

  it("keeps the sections it names, once each, and drops a number it was not given", () => {
    const a = readAnswer("Apăsați „Adaugă persoană” [§3.2]. Vedeți și [§9.9] și [§3.2, §2.1].", sections);
    expect(a).toEqual({ kind: "answer", text: "Apăsați „Adaugă persoană” [§3.2]. Vedeți și și [§3.2] [§2.1].", cited: ["persons-add", "start-sign-in"] });
  });

  it("closes a Romanian quote the model closed with a straight one", () => {
    const a = readAnswer('Apăsați „Adaugă persoană" pe „Persoane Fizice” [§3.2].', sections);
    expect(a).toEqual({ kind: "answer", text: "Apăsați „Adaugă persoană” pe „Persoane Fizice” [§3.2].", cited: ["persons-add"] });
  });

  it("turns the marks into links", () => {
    expect(answerRuns("Da [§3.2].", sections)).toEqual([{ text: "Da " }, { id: "persons-add", number: "3.2" }, { text: "." }]);
  });
});

type Reply = { text: string; status?: number };

/** Claude, mocked: one reply per call, in order — the pick first, then the answer. */
function claudeSays(...replies: Reply[]) {
  const fn = jest.fn();
  for (const r of replies) {
    const status = r.status ?? 200;
    const body =
      status === 200
        ? { content: [{ type: "text", text: r.text }], usage: { input_tokens: 1200, output_tokens: 60, cache_read_input_tokens: 9000, cache_creation_input_tokens: 0 } }
        : { error: { type: "rate_limit_error", message: "slow down" } };
    fn.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  }
  return fn;
}

function ask(question: string, lang: "ro" | "en" = "ro") {
  return POST(new NextRequest("http://localhost/api/manual/ask", { method: "POST", body: JSON.stringify({ question, lang }) }));
}

const sent = (call: number) => JSON.parse((global.fetch as jest.Mock).mock.calls[call][1].body);

describe("POST /api/manual/ask", () => {
  const realFetch = global.fetch;
  const realKey = process.env.ANTHROPIC_API_KEY;
  const add = manualTarget("ro-RO", "persons-add")!;
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    (recordPaidRead as jest.Mock).mockClear();
  });
  afterAll(() => {
    global.fetch = realFetch;
    process.env.ANTHROPIC_API_KEY = realKey;
  });

  it("refuses a visitor who is not signed in", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValueOnce(null);
    expect((await ask("cum adaug o persoană")).status).toBe(401);
  });

  it("when no section answers: one paid call, „not in the manual”, and no list", async () => {
    global.fetch = claudeSays({ text: NO_SECTION });
    const body = await (await ask("ce vreme e mâine la Bragadiru?")).json();
    expect(body.kind).toBe("not-in-manual");
    expect(body.cited).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(recordPaidRead).toHaveBeenCalledTimes(1);
  });

  it("drops ids that are not sections; none left is „not in the manual”", async () => {
    global.fetch = claudeSays({ text: "nu-exista\nnici-asta" });
    expect((await (await ask("cum îmi fac un cont de Facebook?")).json()).kind).toBe("not-in-manual");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("picks from the outline, cached, then answers from the picked sections' text alone, citing them", async () => {
    global.fetch = claudeSays({ text: "persons-add\nnu-exista" }, { text: "Pe lista persoanelor fizice apăsați „Adaugă persoană” [§" + add.number + "]." });
    const res = await ask("vreau să trec în arhivă un om nou");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.kind).toBe("answer");
    expect(body.text).toBe(`Pe lista persoanelor fizice apăsați „Adaugă persoană” [§${add.number}].`);
    expect(body.cited).toEqual([{ id: "persons-add", number: add.number, title: add.title, href: "/manual?s=persons-add" }]);
    expect(body.usage).toEqual({ inputTokens: 2400, outputTokens: 120, cacheReadTokens: 18000, cacheWriteTokens: 0 });

    const pick = sent(0);
    expect(pick.model).toBe(ASK_MODEL);
    expect(pick.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(pick.system[0].text).toContain("| persons-add |");
    expect(pick.messages).toEqual([{ role: "user", content: "Question: vreau să trec în arhivă un om nou" }]);

    const answer = sent(1);
    expect(answer.model).toBe(ASK_MODEL);
    expect(answer.messages[0].content).toContain("Question: vreau să trec în arhivă un om nou");
    expect((answer.messages[0].content.match(/<section /g) ?? []).length).toBe(1);
    expect(answer.messages[0].content).toContain(`<section number="${add.number}">`);
    expect(answer.messages[0].content).not.toContain("Outline:");
    expect(recordPaidRead).toHaveBeenCalledTimes(2);
    expect(recordPaidRead).toHaveBeenCalledWith({ route: "ask-manual", model: ASK_MODEL, success: true });
  });

  it("lists the picked sections when the answer names none", async () => {
    global.fetch = claudeSays({ text: "persons-add" }, { text: "Pe lista persoanelor fizice apăsați „Adaugă persoană”." });
    const body = await (await ask("cum adaug o persoană")).json();
    expect(body.cited.map((c: { id: string }) => c.id)).toEqual(["persons-add"]);
  });

  it("passes on Claude's „not in the manual” from the answer, with no list", async () => {
    global.fetch = claudeSays({ text: "persons-add" }, { text: NOT_IN_MANUAL });
    const body = await (await ask("cum adaug o persoană")).json();
    expect(body.kind).toBe("not-in-manual");
    expect(body.cited).toBeUndefined();
    expect(recordPaidRead).toHaveBeenCalledTimes(2);
  });

  it("reads the English outline for an English question", async () => {
    global.fetch = claudeSays({ text: NO_SECTION });
    await ask("how do I add a person?", "en");
    expect(sent(0).system[0].text).toContain(MANUAL_OUTLINE["en-GB"]["persons-add"]);
  });

  it("maps the API's refusal and records it as a failed read", async () => {
    global.fetch = claudeSays({ text: "", status: 429 });
    const res = await ask("cum adaug o persoană");
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("rate_limited");
    expect(recordPaidRead).toHaveBeenCalledWith({ route: "ask-manual", model: ASK_MODEL, success: false });
  });

  it("says so when no API key is set, without calling", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    global.fetch = jest.fn();
    const res = await ask("cum adaug o persoană");
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("no_api_key");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refuses an empty or overlong question", async () => {
    expect((await ask("   ")).status).toBe(400);
    expect((await ask("x".repeat(501))).status).toBe(400);
  });
});
