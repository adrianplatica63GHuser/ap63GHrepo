/**
 * @jest-environment node
 */

/**
 * Slice #36.23 — the AI extraction moved out of the ai-interpret route into
 * `src/lib/documents/ai-extract.ts`, behaviour-preserving, so the AI score
 * harness can call the same code over pages on disk.
 *
 * Pinned here: what the model is sent (one block per readable page, in order;
 * PDFs as documents with the PDF beta header; everything else skipped with the
 * route's reasons; the exact closing instruction and token ceilings), how an
 * HTTP error is mapped to the codes the wizard reads, and how an answer is
 * split into generic fields, template fields, notes and parties.
 */

import {
  EXTRACT_MODEL,
  buildExtractRequestBody,
  buildPageBlocks,
  callAnthropic,
  interpretExtractText,
  typeHintTextFor,
} from "@/lib/documents/ai-extract";
import type { DocumentTemplateField } from "@/lib/documents/template-fields";

const read = async (p: { fileName: string }): Promise<Buffer> => Buffer.from(`bytes of ${p.fileName}`);

describe("pages → content blocks", () => {
  it("sends images and PDFs in page order and skips the rest with a reason", async () => {
    const pages = [
      { fileName: "1.jpg", mimeType: null },
      { fileName: "coord.txt", mimeType: "text/plain" },
      { fileName: "act.pdf", mimeType: "application/octet-stream" },
      { fileName: "note.docx", mimeType: null },
      { fileName: "2.PNG", mimeType: null },
    ];
    const r = await buildPageBlocks(pages, read);
    expect(r.fileBlocks.map((b) => (b.type === "text" ? "text" : `${b.type}:${b.source.media_type}`))).toEqual([
      "image:image/jpeg",
      "document:application/pdf",
      "image:image/png",
    ]);
    expect(r.fileBlocks[0]).toMatchObject({ source: { data: Buffer.from("bytes of 1.jpg").toString("base64") } });
    expect(r.sawPdf).toBe(true);
    expect(r.extraHeaders).toEqual({ "anthropic-beta": "pdfs-2024-09-25" });
    expect(r.skippedPages.map((s) => s.fileName)).toEqual(["coord.txt", "note.docx"]);
    expect(r.skippedPages[0].reason).toMatch(/^plain-text file/);
  });

  it("asks for no beta header when there is no PDF", async () => {
    const r = await buildPageBlocks([{ fileName: "1.jpg", mimeType: null }], read);
    expect(r.extraHeaders).toEqual({});
  });

  it("lets a failed read propagate, for the route to answer", async () => {
    await expect(
      buildPageBlocks([{ fileName: "1.jpg", mimeType: null }], async () => {
        throw new Error("gone");
      }),
    ).rejects.toThrow("gone");
  });
});

describe("the request body", () => {
  const fileBlocks = [{ type: "text" as const, text: "page" }];

  it("extract: the route's model, 8192 tokens, and the closing instruction with the type hint", () => {
    const hint = typeHintTextFor({ name: "Contract de Vânzare", key: "contract_vanzare" });
    expect(hint).toBe(" Known document type: Contract de Vânzare (contract_vanzare).");
    const body = buildExtractRequestBody({ isDiscover: false, systemPrompt: "SYS", fileBlocks, typeHintText: hint }) as {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: string; content: { type: string; text?: string }[] }[];
    };
    expect(body.model).toBe(EXTRACT_MODEL);
    expect(body.max_tokens).toBe(8192);
    expect(body.system).toBe("SYS");
    const last = body.messages[0].content.at(-1);
    expect(last?.text).toBe(
      "Extract fields from this Romanian document (1 page(s), in order — treat them as one document; the closing/authentication block is often on the last page). Known document type: Contract de Vânzare (contract_vanzare).",
    );
  });

  it("discover: 16384 tokens and no type hint", () => {
    const body = buildExtractRequestBody({ isDiscover: true, systemPrompt: "S", fileBlocks, typeHintText: " ignored" }) as {
      max_tokens: number;
      messages: { content: { text?: string }[] }[];
    };
    expect(body.max_tokens).toBe(16384);
    expect(body.messages[0].content.at(-1)?.text).not.toContain("ignored");
  });

  it("no registered type, no hint", () => {
    expect(typeHintTextFor(null)).toBe("");
  });
});

describe("the call", () => {
  const fake = (status: number, body: unknown): typeof fetch =>
    (async () =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;

  it("returns the text and whether the output limit was hit", async () => {
    const r = await callAnthropic("k", {}, {}, fake(200, { content: [{ type: "text", text: "{}" }], stop_reason: "max_tokens" }));
    expect(r).toEqual({ ok: true, textBlock: "{}", hitOutputLimit: true });
  });

  it.each([
    [400, { error: { message: "Your credit balance is too low" } }, "insufficient_credits"],
    [401, { error: { type: "authentication_error", message: "bad key" } }, "invalid_api_key"],
    [429, { error: { type: "rate_limit_error" } }, "rate_limited"],
    [529, { error: { type: "overloaded_error" } }, "overloaded"],
    [500, "not json", "unknown"],
  ] as const)("HTTP %s maps to %s", async (status, body, code) => {
    const r = await callAnthropic("k", {}, {}, fake(status, body));
    expect(r.ok === false && r.kind === "http" && r.code).toBe(code);
  });

  it("an answer with no text block is its own outcome", async () => {
    const r = await callAnthropic("k", {}, {}, fake(200, { content: [] }));
    expect(r).toEqual({ ok: false, kind: "no-text" });
  });
});

describe("reading the answer", () => {
  const template = [
    { key: "pretTotal", labelRo: "Preț total", type: "number" },
    { key: "monedaPret", labelRo: "Moneda", type: "select" },
  ] as unknown as DocumentTemplateField[];

  const answer = JSON.stringify({
    fields: { title: "CVC", nrDocument: "1234", dateDocument: "2008-05-16", pretTotal: "10000", monedaPret: "EUR", invented: "x" },
    suggestedTypeKey: "contract_vanzare",
    classifiedLabel: "  Contract de vânzare  ",
    lowConfidenceFields: ["pretTotal"],
    unmappedRaw: { Tarla: "40", Parcela: "212/40" },
    parties: [
      { roleName: " Vânzător ", name: "A B", cotaParte: "50" },
      { roleName: "", name: "no role" },
      { roleName: "Cumpărător", personType: "JUDICIAL", name: "Firma SRL" },
    ],
  });

  it("splits generic and template keys and drops invented ones", () => {
    const r = interpretExtractText("```json\n" + answer + "\n```", template);
    expect(r.fields).toEqual({ title: "CVC", nrDocument: "1234", dateDocument: "2008-05-16" });
    expect(r.customFields).toEqual({ pretTotal: "10000", monedaPret: "EUR" });
    expect(r.classifiedLabel).toBe("Contract de vânzare");
    expect(r.lowConfidenceFields).toEqual(["pretTotal"]);
  });

  it("folds unmapped text into the notes the route appends", () => {
    const r = interpretExtractText(answer, template);
    expect(r.enhancedNotes).toBe("[AI] Text neasociat unui câmp:\nTarla: 40\nParcela: 212/40");
  });

  it("keeps parties with a role, trims the role, defaults the type, fills every field", () => {
    const r = interpretExtractText(answer, template);
    expect(r.parties.map((p) => [p.roleName, p.personType, p.name, p.cotaParte, p.cnp])).toEqual([
      ["Vânzător", "NATURAL", "A B", "50", null],
      ["Cumpărător", "JUDICIAL", "Firma SRL", null, null],
    ]);
  });

  it("throws on an answer that is not JSON — the route's 502", () => {
    expect(() => interpretExtractText("sorry, I cannot", template)).toThrow();
  });
});
