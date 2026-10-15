/**
 * @jest-environment node
 */

/**
 * „Răspuns AI” — the prompt, the reading of Claude's answer, and POST /api/manual/ask.        (Slice #39.45)
 *
 * Claude is mocked (global fetch): no real AI call is made by a test. What is under test is the header's rule —
 * the manual is the only source: Claude is given the question and the sections the search found and nothing
 * else; the answer names them; a question the manual does not answer is told so, and when the search finds
 * nothing no call is made at all. Every answer the API gives is recorded as a paid read („ask-manual”).
 */
import { NextRequest } from "next/server";
import { ASK_MODEL } from "@/lib/ai/models";
import { askPrompt, answerRuns, CONTEXT_MAX, NOT_IN_MANUAL, readAnswer } from "@/lib/manual/ask";

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

function claudeSays(text: string, status = 200) {
  const body = status === 200 ? { content: [{ type: "text", text }], usage: { input_tokens: 1200, output_tokens: 60 } } : { error: { type: "rate_limit_error", message: "slow down" } };
  return jest.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

function ask(question: string, lang: "ro" | "en" = "ro") {
  return POST(new NextRequest("http://localhost/api/manual/ask", { method: "POST", body: JSON.stringify({ question, lang }) }));
}

describe("POST /api/manual/ask", () => {
  const realFetch = global.fetch;
  const realKey = process.env.ANTHROPIC_API_KEY;
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

  it("calls nothing when the search finds nothing, and says the manual does not say", async () => {
    global.fetch = jest.fn();
    const res = await ask("xqzvw plmkj");
    expect(await res.json()).toEqual({ kind: "not-in-manual" });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(recordPaidRead).not.toHaveBeenCalled();
  });

  it("asks the small model with the question and the found sections only, and answers citing them", async () => {
    global.fetch = claudeSays("Pe lista persoanelor fizice apăsați „Adaugă persoană” [§3.2].");
    const res = await ask("cum adaug o persoană");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.kind).toBe("answer");
    expect(body.text).toBe("Pe lista persoanelor fizice apăsați „Adaugă persoană” [§3.2].");
    expect(body.cited).toEqual([{ id: "persons-add", number: "3.2", title: "O persoană adăugată de mână", href: "/manual?s=persons-add" }]);
    expect(body.usage).toEqual({ inputTokens: 1200, outputTokens: 60 });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe(ASK_MODEL);
    expect(sent.messages).toHaveLength(1);
    expect(sent.messages[0].content).toContain("Question: cum adaug o persoană");
    expect(sent.messages[0].content).toContain('<section number="3.2">');
    expect((sent.messages[0].content.match(/<section /g) ?? []).length).toBeLessThanOrEqual(5);
    expect(recordPaidRead).toHaveBeenCalledWith({ route: "ask-manual", model: ASK_MODEL, success: true });
  });

  it("passes on Claude's „not in the manual”", async () => {
    global.fetch = claudeSays(NOT_IN_MANUAL);
    expect(await (await ask("cum adaug o persoană")).json()).toEqual({ kind: "not-in-manual" });
    expect(recordPaidRead).toHaveBeenCalledTimes(1);
  });

  it("maps the API's refusal and records it as a failed read", async () => {
    global.fetch = claudeSays("", 429);
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
