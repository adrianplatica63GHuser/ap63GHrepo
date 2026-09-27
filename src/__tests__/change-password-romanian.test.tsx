/**
 * FU-246 — „Schimbă parola" is Romanian, all of it.          (Slice #37.07)
 *
 * Found while fixing FU-064/FU-072 on the same route: the page's heading, its
 * sentence, both labels, the hint, the two buttons, every error and the success
 * message were hard-coded English, and a refusal from the auth service showed
 * its own English sentence verbatim. Rendered here with a `useTranslations`
 * that answers from ro-RO.json, so a string that bypasses the messages shows
 * up as English on the screen and fails.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import ro from "../../messages/ro-RO.json";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const messages = require("../../messages/ro-RO.json") as Record<string, unknown>;
    const v = `${ns}.${key}`.split(".").reduce<unknown>((n, k) => (n as Record<string, unknown>)?.[k], messages);
    if (typeof v !== "string") throw new Error(`no message ${ns}.${key}`);
    return v;
  },
}));
const mockUpdateUser = jest.fn();
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { updateUser: (...a: unknown[]) => mockUpdateUser(...a) } }),
}));

import { ChangePasswordForm } from "@/app/account/change-password/change-password-form";

const c = ro.auth.changePassword;
// Whole words: „Confirmă" begins with „Confirm", and `\b` does not see „ă" as a
// letter (.claude/rules/i18n-and-romanian.md), hence the Unicode lookahead.
const ENGLISH = /(?<![\p{L}])(Password|Confirm|Cancel|Update|Redirecting)(?![\p{L}])|Minimum 8 characters|Something went wrong/u;

describe("FU-246: the change-password form speaks Romanian", () => {
  it("labels, hint and buttons come from the messages", () => {
    const { container } = render(<ChangePasswordForm />);
    expect(screen.getByLabelText(c.labelNew)).toBeInTheDocument();
    expect(screen.getByLabelText(c.labelConfirm)).toBeInTheDocument();
    expect(screen.getByText(c.hintMin)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: c.buttonSave })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: c.buttonCancel })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(ENGLISH);
  });

  it("says the checks in Romanian", () => {
    render(<ChangePasswordForm />);
    fireEvent.change(screen.getByLabelText(c.labelNew), { target: { value: "scurt" } });
    fireEvent.change(screen.getByLabelText(c.labelConfirm), { target: { value: "scurt" } });
    fireEvent.submit(screen.getByRole("button", { name: c.buttonSave }).closest("form")!);
    expect(screen.getByText(c.errorTooShort)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(c.labelNew), { target: { value: "parola-lunga-1" } });
    fireEvent.change(screen.getByLabelText(c.labelConfirm), { target: { value: "parola-lunga-2" } });
    fireEvent.submit(screen.getByRole("button", { name: c.buttonSave }).closest("form")!);
    expect(screen.getByText(c.errorMismatch)).toBeInTheDocument();
  });

  it("shows a Romanian sentence, not the auth service's English one, when the change is refused", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockUpdateUser.mockResolvedValue({ error: { message: "New password should be different from the old password." } });
    render(<ChangePasswordForm />);
    fireEvent.change(screen.getByLabelText(c.labelNew), { target: { value: "parola-lunga-1" } });
    fireEvent.change(screen.getByLabelText(c.labelConfirm), { target: { value: "parola-lunga-1" } });
    fireEvent.submit(screen.getByRole("button", { name: c.buttonSave }).closest("form")!);
    expect(await screen.findByText(c.errorRejected)).toBeInTheDocument();
    expect(screen.queryByText(/should be different/)).toBeNull();
    warn.mockRestore();
  });
});
