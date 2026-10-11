/**
 * „Interacțiuni” — the log form's rules.                                  (Slice #38.85)
 *
 * §4's manual entry and §7's validation, as `src/lib/interactions/form.ts` holds them: checked against the route's
 * own schema, so the form and the route cannot disagree; „Salvează și adaugă” keeps channel, direction and person;
 * the description's placeholder follows the channel. And the form needs no account (§8.4): a phone call, a meeting
 * and a letter are each logged with nothing but the form.
 */
import fs from "node:fs";
import path from "node:path";
import {
  DESCRIPTION_PROMPT,
  checkForm,
  emptyForm,
  firstError,
  fromLocalMinute,
  isDirty,
  localMinute,
  nextAfterSave,
  type LogForm,
} from "@/lib/interactions/form";
import { interactionInputSchema } from "@/lib/interactions/validation";
import { INTERACTION_CHANNELS } from "@/lib/interactions/model";

const NOW = new Date(2026, 9, 10, 14, 22, 30);
const PERSON = "0b5c6e0e-1111-4c4c-8888-000000000001";
const filled = (patch: Partial<LogForm> = {}): LogForm => ({ ...emptyForm(PERSON), subject: "Revenire privind contractul", ...patch });

const RO = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", "ro-RO.json"), "utf8")) as {
  interactions: { log: { prompt: Record<string, string>; error: Record<string, string> } };
};

describe("a new record (§4)", () => {
  it("is e-mail, outbound, logged, now — and the scope's person when there is one", () => {
    expect(emptyForm(null)).toMatchObject({ channel: "EMAIL", direction: "OUTBOUND", status: "LOGGED", when: null, personId: null });
    expect(emptyForm(PERSON).personId).toBe(PERSON);
  });

  it("left at „now”, it is sent as the moment of the save", () => {
    const r = checkForm(filled(), NOW);
    expect(r.ok && r.input.occurredAt).toBe(NOW.toISOString());
  });

  it("a minute typed by hand is the browser's own minute", () => {
    expect(localMinute(NOW)).toBe("2026-10-10T14:22");
    expect(fromLocalMinute("2026-10-09T09:05")).toEqual(new Date(2026, 9, 9, 9, 5));
    expect(fromLocalMinute("9 Oct")).toBeNull();
  });
});

describe("validation (§7), with the route's own schema", () => {
  it("an empty person and an empty subject are errors, and the focus goes to the person first", () => {
    const r = checkForm({ ...emptyForm(null), subject: "  " }, NOW);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual({ personId: "personRequired", subject: "subjectRequired" });
    expect(firstError(r.errors)).toBe("personId");
  });

  it("a date in the future is refused unless the status is „Programată”", () => {
    const tomorrow = localMinute(new Date(2026, 9, 11, 10, 0));
    const r = checkForm(filled({ when: tomorrow }), NOW);
    expect(!r.ok && r.errors.when).toBe("futureNotScheduled");
    expect(checkForm(filled({ when: tomorrow, status: "SCHEDULED" }), NOW).ok).toBe(true);
    expect(checkForm(filled({ when: "2026-10-01T09:00" }), NOW).ok).toBe(true);
  });

  it("a follow-up ticked needs its date; unticked, none is sent", () => {
    const r = checkForm(filled({ followUp: true }), NOW);
    expect(!r.ok && r.errors.followUpOn).toBe("followUpRequired");
    const ok = checkForm(filled({ followUp: true, followUpOn: "2026-10-16" }), NOW);
    expect(ok.ok && ok.input.followUpOn).toBe("2026-10-16");
    const off = checkForm(filled({ followUp: false, followUpOn: "2026-10-16" }), NOW);
    expect(off.ok && off.input.followUpOn).toBeNull();
  });

  it("the internal note is sent only while its switch is on, and never mixed into the description", () => {
    const off = checkForm(filled({ description: "Pentru client", internalNote: "Doar echipa" }), NOW);
    expect(off.ok && [off.input.description, off.input.internalNote]).toEqual(["Pentru client", null]);
    const on = checkForm(filled({ description: "Pentru client", internal: true, internalNote: "Doar echipa" }), NOW);
    expect(on.ok && [on.input.description, on.input.internalNote]).toEqual(["Pentru client", "Doar echipa"]);
  });

  it("what it sends is exactly what the route accepts", () => {
    const r = checkForm(filled({ channel: "PHONE", direction: "INBOUND", status: "COMPLETED", description: "S-a convenit vizita." }), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(interactionInputSchema.safeParse(r.input).success).toBe(true);
    expect(r.input).toMatchObject({ channel: "PHONE", direction: "INBOUND", status: "COMPLETED", personId: PERSON, subject: "Revenire privind contractul" });
  });

  it("needs no account: a phone call, a meeting and a letter each pass with the form alone (§8.4)", () => {
    for (const channel of ["PHONE", "MEETING", "PAPER_MAIL"] as const) expect(checkForm(filled({ channel }), NOW).ok).toBe(true);
  });

  it("every error has its words, in Romanian", () => {
    for (const k of ["personRequired", "subjectRequired", "whenRequired", "futureNotScheduled", "followUpRequired"]) {
      expect([k, typeof RO.interactions.log.error[k]]).toEqual([k, "string"]);
    }
  });
});

describe("„Salvează și adaugă” and „Renunță” (§4)", () => {
  it("Save and new keeps channel, direction and person, and clears the rest", () => {
    const before = filled({ channel: "PHONE", direction: "INBOUND", status: "COMPLETED", when: "2026-10-09T09:00", description: "x", followUp: true, followUpOn: "2026-10-12" });
    expect(nextAfterSave(before)).toEqual({ ...emptyForm(PERSON), channel: "PHONE", direction: "INBOUND" });
  });

  it("a form is dirty when anything differs from where it started — what Cancel asks about", () => {
    const base = emptyForm(null);
    expect(isDirty(base, base)).toBe(false);
    expect(isDirty({ ...base, subject: "a" }, base)).toBe(true);
    expect(isDirty({ ...base, channel: "SMS" }, base)).toBe(true);
  });
});

describe("the description's placeholder follows the channel (§4)", () => {
  it("phone: what was agreed; meeting: where, and who attended; paper mail: what was posted and the tracking number", () => {
    const p = RO.interactions.log.prompt;
    expect(p[DESCRIPTION_PROMPT.PHONE]).toBe("Ce s-a convenit?");
    expect(p[DESCRIPTION_PROMPT.MEETING]).toBe("Unde, și cine a participat?");
    expect(p[DESCRIPTION_PROMPT.PAPER_MAIL]).toBe("Ce s-a trimis prin poștă, și numărul de urmărire, dacă există?");
    for (const c of INTERACTION_CHANNELS) expect([c, typeof p[DESCRIPTION_PROMPT[c]]]).toEqual([c, "string"]);
  });
});
