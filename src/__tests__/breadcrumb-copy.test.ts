/**
 * The breadcrumb says what the screen it names says.          (Slice #37.07)
 *
 * FU-070: the Romanian crumb for the documents list said „Documente" while the
 * list's own title, the sidebar and the help all say „Acte".
 */
import ro from "../../messages/ro-RO.json";

// breadcrumb-bar.tsx is a client component; only its pure `buildSegments` is
// under test, so what it imports for rendering is stood in for.
jest.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
jest.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
jest.mock("@/components/providers/navigation-history-provider", () => ({ useNavigationHistory: () => ({}) }));
jest.mock("@/components/help/screen-help-button", () => ({ ScreenHelpButton: () => null }));

describe("the breadcrumb's words", () => {
  it("FU-070: calls the documents list „Acte”, as its title does", () => {
    expect(ro.navigation.breadcrumb.documents).toBe(ro.document.listTitle);
    expect(ro.navigation.breadcrumb.documents).toBe("Acte");
  });
});

describe("the breadcrumb's segments", () => {
  it("FU-064: names /account/change-password, and skips the bare /account", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { buildSegments } = require("@/components/breadcrumb-bar") as typeof import("@/components/breadcrumb-bar");
    const segs = buildSegments("/account/change-password", (k: string) => `‹${k}›`, {});
    expect(segs.map((s) => s.label)).toEqual(["‹home›", "‹changePassword›"]);
    expect(segs[1].href).toBe("/account/change-password");
    expect(ro.navigation.breadcrumb.changePassword).toBe("Schimbă parola");
  });
});
