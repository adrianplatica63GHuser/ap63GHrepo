/**
 * An administrator who signs out and back in keeps both administration
 * sections — and nothing one account's session cached reaches the next.
 *                                                              (Slice #37.01)
 *
 * THE DEFECT
 * ──────────
 * Adrian, 2026-09-26: „when I logged back in as an administrator I no longer
 * had the 2 Admin functions in the left navigation panel". His role had not
 * changed — `/api/auth/me` answered `superuser` and a fresh load of `/` showed
 * both sections. Two things in the client made that possible:
 *
 *   1. `fetchMe()` in `sidebar-nav.tsx` turned ANY non-ok answer — a 401, a 500
 *      — into `{ role: "user" }`, and `useQuery(["auth-me"])` kept that answer
 *      fresh for five minutes. A request that failed once was believed as a
 *      demotion, never retried, and hid both sections until a reload.
 *   2. Neither „Ieșire” (`handleLogout`) nor the login form cleared the query
 *      cache; both only called `router.push` and `router.refresh()`. Signing
 *      out and in within one document therefore handed the next account the
 *      previous account's role, lists and records, fresh for as long as their
 *      `staleTime` said.
 *
 * WHAT IS ASSERTED
 * ────────────────
 * The real `SidebarNav` and the real `LoginForm`, rendered over a real
 * `QueryClient`, with only the edges mocked (router, Supabase, translations,
 * and the sidebar's decorations). Sections are found by their `nav.*` keys
 * because `useTranslations` is mocked to return the key — next-intl is ESM-only
 * and cannot load under Jest (`dashboard-time-frames.test.tsx` says why).
 *
 * RED ON THE CODE BEFORE THIS SLICE: this file was committed on its own, ahead
 * of the fix, and the test runner's `jest` run on that commit is quoted in the
 * slice's handover and in the fix commit's body.
 */

import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SidebarNav } from "@/components/sidebar/sidebar-nav";
import { LoginForm } from "@/app/login/login-form";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  usePathname: () => "/",
}));

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// <Link> needs an App Router context that jsdom has not got. `require` inside
// the factory because a jest.mock factory is hoisted above the imports.
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("react") as typeof import("react")).createElement("a", null, children),
}));

const mockSignOut = jest.fn();
const mockSignIn = jest.fn();
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: mockSignOut, signInWithPassword: mockSignIn },
  }),
}));

jest.mock("@/components/locale-toggle", () => ({ LocaleToggle: () => null }));
jest.mock("@/components/recently-viewed-panel", () => ({ RecentlyViewedPanel: () => null }));
jest.mock("@/components/providers/unsaved-changes-provider", () => ({
  useUnsavedChanges: () => ({
    guardedAction: (action: () => void) => action(),
    guardedNavigate: () => undefined,
  }),
}));
jest.mock("@/components/providers/navigation-history-provider", () => ({
  clearRecentlyViewed: () => undefined,
}));

// ── Fixtures ────────────────────────────────────────────────────────────────

const AUTH_ME = ["auth-me"] as const;
/** Any other query a signed-in screen holds — a list, a record. */
const PERSONS_LIST = ["natural-persons", { offset: 0 }] as const;

// Slice #38.21: /api/auth/me answers `fullAccess`, not a role. Every account with an app_users
// row has the whole application; the one that sees less is an account WITHOUT a row — the
// fixture keeps the old name for the old story the tests tell.
const SUPERUSER = { username: "Adrian", fullAccess: true };
const PLAIN_USER = { username: "test-user", fullAccess: false };

// Slice #38.20: the two administration sections („Operațiuni" and „Configurare") became
// „Administrare" and „Setări" — the two an account without an app_users row never sees.
const ADMIN_SECTIONS = [
  "sections.administration",
  "sections.settings",
] as const;

function answer(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const UNAUTHORIZED = () => answer(401, { error: "Unauthorized" });

function newClient(retry: number = 0): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry, retryDelay: 0, gcTime: Infinity } },
  });
}

function withClient(client: QueryClient, ui: ReactNode) {
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function expectAdminSections(present: boolean): void {
  for (const key of ADMIN_SECTIONS) {
    if (present) expect(screen.getByText(key)).toBeInTheDocument();
    else expect(screen.queryByText(key)).toBeNull();
  }
}

function renderLoginForm(client: QueryClient) {
  return withClient(
    client,
    <LoginForm
      labelIdentity="Utilizator sau Email"
      placeholderIdentity=""
      labelPassword="Parolă"
      buttonSignIn="Conectare"
      buttonSigningIn="Se conectează…"
      errorInvalidCredentials="Utilizator sau parolă incorectă"
      errorGeneric="Eroare"
    />,
  );
}

/** Fill and submit the form. An address with „@” skips the username lookup. */
async function signInThroughForm(): Promise<void> {
  fireEvent.change(screen.getByLabelText("Utilizator sau Email"), {
    target: { value: "adrian@example.ro" },
  });
  fireEvent.change(screen.getByLabelText("Parolă"), { target: { value: "fixture" } });
  fireEvent.click(screen.getByRole("button", { name: "Conectare" }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
}

let fetchMock: jest.Mock;
const realFetch = global.fetch;

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  mockPush.mockReset();
  mockRefresh.mockReset();
  mockSignOut.mockReset().mockResolvedValue({ error: null });
  mockSignIn.mockReset().mockResolvedValue({ error: null });
});

afterAll(() => {
  global.fetch = realFetch;
});

// ── 1. A 401 is not a role ──────────────────────────────────────────────────

describe("the role query — an answer that is not ok is never cached as a role", () => {
  it("a 401 from /api/auth/me leaves no role in the cache, and no administration section", async () => {
    fetchMock.mockImplementation(async () => UNAUTHORIZED());
    const client = newClient();
    withClient(client, <SidebarNav />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/auth/me"));
    await waitFor(() => expect(client.getQueryState(AUTH_ME)?.fetchStatus).toBe("idle"));

    expect(client.getQueryData(AUTH_ME)).toBeUndefined();
    expectAdminSections(false);
  });

  it("a failed first answer is retried, and a superuser then sees both sections without a reload", async () => {
    fetchMock
      .mockImplementationOnce(async () => UNAUTHORIZED())
      .mockImplementation(async () => answer(200, SUPERUSER));
    const client = newClient(1);
    withClient(client, <SidebarNav />);

    expect(await screen.findByText(ADMIN_SECTIONS[0])).toBeInTheDocument();
    expectAdminSections(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a full-access answer shows both sections; a no-row account's shows neither", async () => {
    fetchMock.mockImplementation(async () => answer(200, SUPERUSER));
    const first = withClient(newClient(), <SidebarNav />);
    expect(await screen.findByText(ADMIN_SECTIONS[0])).toBeInTheDocument();
    expectAdminSections(true);
    first.unmount();

    fetchMock.mockImplementation(async () => answer(200, PLAIN_USER));
    const client = newClient();
    withClient(client, <SidebarNav />);
    await waitFor(() => expect(client.getQueryData(AUTH_ME)).toEqual(PLAIN_USER));
    expectAdminSections(false);
  });
});

// ── 2. Sign-out and sign-in start from an empty cache ───────────────────────

describe("„Ieșire” empties the whole query cache before it leaves", () => {
  it("no role, list or record survives the sign-out", async () => {
    const client = newClient();
    client.setQueryData(AUTH_ME, SUPERUSER);
    client.setQueryData(PERSONS_LIST, { rows: [{ id: "p1" }] });
    fetchMock.mockImplementation(async () => UNAUTHORIZED()); // signed out from here on

    let personsAtPush: unknown = "push never ran";
    mockPush.mockImplementation(() => {
      personsAtPush = client.getQueryData(PERSONS_LIST);
    });

    withClient(client, <SidebarNav />);
    expectAdminSections(true);

    fireEvent.click(screen.getByRole("button", { name: "signOut" })); // #37.42: an icon button — named, no `title`
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(personsAtPush).toBeUndefined();
    expect(client.getQueryData(PERSONS_LIST)).toBeUndefined();
    expect(client.getQueryData(AUTH_ME)).toBeUndefined();
  });
});

describe("a successful sign-in empties the whole query cache before it navigates", () => {
  it("nothing cached before the sign-in is there when „/” opens", async () => {
    const client = newClient();
    client.setQueryData(AUTH_ME, PLAIN_USER);
    client.setQueryData(PERSONS_LIST, { rows: [{ id: "p1" }] });

    let cachedAtPush: number | null = null;
    mockPush.mockImplementation(() => {
      cachedAtPush = client.getQueryCache().getAll().length;
    });

    renderLoginForm(client);
    await signInThroughForm();

    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(cachedAtPush).toBe(0);
  });

  it("a refused sign-in leaves the cache alone and stays on the form", async () => {
    const client = newClient();
    client.setQueryData(PERSONS_LIST, { rows: [{ id: "p1" }] });
    mockSignIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });

    renderLoginForm(client);
    fireEvent.change(screen.getByLabelText("Utilizator sau Email"), {
      target: { value: "adrian@example.ro" },
    });
    fireEvent.change(screen.getByLabelText("Parolă"), { target: { value: "fixture" } });
    fireEvent.click(screen.getByRole("button", { name: "Conectare" }));

    expect(await screen.findByText("Utilizator sau parolă incorectă")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(client.getQueryData(PERSONS_LIST)).toEqual({ rows: [{ id: "p1" }] });
  });
});

// ── 3. The sequence Adrian took, in one document ────────────────────────────

describe("sign out, sign back in, in the same tab", () => {
  async function signOutThenIn(client: QueryClient): Promise<void> {
    const sidebar = withClient(client, <SidebarNav />);
    expectAdminSections(true);
    fetchMock.mockImplementation(async () => UNAUTHORIZED());
    fireEvent.click(screen.getByRole("button", { name: "signOut" })); // #37.42: an icon button — named, no `title`
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
    sidebar.unmount(); // /login renders without the app shell

    const form = renderLoginForm(client);
    await signInThroughForm();
    form.unmount();
  }

  it("the superuser signs back in and has both administration sections", async () => {
    const client = newClient();
    client.setQueryData(AUTH_ME, SUPERUSER);
    await signOutThenIn(client);

    fetchMock.mockImplementation(async () => answer(200, SUPERUSER));
    withClient(client, <SidebarNav />);
    expect(await screen.findByText(ADMIN_SECTIONS[0])).toBeInTheDocument();
    expectAdminSections(true);
  });

  it("an account without an app_users row signing in after the superuser sees neither section — from the first render", async () => {
    const client = newClient();
    client.setQueryData(AUTH_ME, SUPERUSER);
    await signOutThenIn(client);

    let answerUser: () => void = () => undefined;
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => {
        answerUser = () => resolve(answer(200, PLAIN_USER));
      }),
    );
    withClient(client, <SidebarNav />);

    // Before /api/auth/me has answered: the previous account's role is gone.
    expectAdminSections(false);

    answerUser();
    await waitFor(() => expect(client.getQueryData(AUTH_ME)).toEqual(PLAIN_USER));
    expectAdminSections(false);
  });
});
