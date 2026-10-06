/**
 * @jest-environment node
 *
 * FU-072 — the browser-tab titles of the auth screens are Romanian.  (Slice #37.07)
 *
 * /login, /signup and /account/change-password carried hard-coded English
 * titles („Sign in — GA40", „Request Access — GA40", „Change Password — GA40")
 * in a Romanian application. Each page now builds its title from
 * messages/*.json; this reads them through a stand-in for next-intl's server
 * `getTranslations` that answers from ro-RO.json.
 */
import ro from "../../messages/ro-RO.json";

jest.mock("next-intl/server", () => ({
  getTranslations: async (ns: string) => (key: string) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const messages = require("../../messages/ro-RO.json") as Record<string, unknown>;
    const v = `${ns}.${key}`.split(".").reduce<unknown>((n, k) => (n as Record<string, unknown>)?.[k], messages);
    if (typeof v !== "string") throw new Error(`no message ${ns}.${key}`);
    return v;
  },
}));
jest.mock("@/app/login/login-form", () => ({ LoginForm: () => null }));
jest.mock("@/app/signup/signup-form", () => ({ SignupForm: () => null }));
jest.mock("@/app/account/change-password/change-password-form", () => ({ ChangePasswordForm: () => null }));
jest.mock("@/components/locale-toggle", () => ({ LocaleToggle: () => null }));

describe("FU-072: the auth screens' tab titles", () => {
  it.each([
    ["/login", "@/app/login/page", ro.auth.login.pageTitle, "Conectare — GA40"],
    ["/signup", "@/app/signup/page", ro.auth.signup.pageTitle, "Solicitare acces — GA40"],
    ["/account/change-password", "@/app/account/change-password/page", ro.auth.changePassword.pageTitle, "Schimbă parola — GA40"],
  ])("%s says its name in Romanian", async (_route, mod, fromMessages, expected) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const page = require(mod) as { generateMetadata: () => Promise<{ title: string }> };
    const meta = await page.generateMetadata();
    expect(meta.title).toBe(fromMessages);
    expect(meta.title).toBe(expected);
  });
});
