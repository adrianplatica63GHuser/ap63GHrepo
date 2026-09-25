/**
 * Where each role's saved session lives.                       (Slice #36.20)
 *
 * `e2e/auth.setup.ts` logs in twice: the superuser every spec runs as
 * (E2E_EMAIL, saved to SUPERUSER_STATE — the file playwright.config.ts gives
 * every spec by default), and, when `.env` holds E2E_USER_EMAIL, an account
 * whose role is `user` (saved to USER_STATE). A spec that must act as the
 * `user` switches with `test.use({ storageState: USER_STATE })` inside the one
 * `chromium` project; there is no second project.
 *
 * Both files are under `e2e/.auth/`, which is gitignored and dockerignored:
 * they hold live session cookies.
 */
import path from "path";

export const SUPERUSER_STATE = path.join(__dirname, "..", ".auth", "session.json");
export const USER_STATE = path.join(__dirname, "..", ".auth", "user-session.json");
