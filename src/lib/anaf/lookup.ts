/**
 * The one call to ANAF, made by the app's server.                                                    (Slice #39.64)
 *
 * ANAF allows one request a second (doc_WS_V9). The header's Ask first 3, as recommended: one call per click, and
 * the server spaces its calls apart however many clicks arrive — three seconds rather than one, for the reason at
 * ANAF_SPACING_MS. A queue, not a refusal: a second click a moment after the first waits its turn and still gets its
 * answer. The spacing lives in this module, so it holds across every caller in the process; a restart resets it,
 * which is harmless at one call per click.
 *
 * Failures are `AnafUnavailable`: a network error, a timeout, a status other than 200 (ANAF answers 404 with a JSON
 * body when nothing is found, so a 404 is read, not failed), or a body of another shape.
 */
import { ANAF_URL, readAnafAnswer, type AnafAnswer } from "./company";

// ⚠️ THREE SECONDS, NOT ONE. ANAF documents one request a second, but its firewall answers a request a second or two
// after the last one with an HTML „Request Rejected" page (HTTP 200) — measured on dev, 2026-10-17: calls 3, 6 and
// 10 s apart were all answered; one sent 1 s after the last was rejected, and so was its retry 2 s on.
export const ANAF_SPACING_MS = 3000;
export const ANAF_TIMEOUT_MS = 10_000;
/** Said plainly who is asking — Node's own „node" agent is the kind of caller a firewall turns away. */
export const ANAF_USER_AGENT = "GA40-arhiva/1.0 (completare date firma din CUI)";

export class AnafUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnafUnavailable";
  }
}

/**
 * How long to wait before asking again after an answer that is not JSON — twice, then „down". Measured on dev,
 * 2026-10-17: after 20 s or more without a call, ANAF's first answer was its „Request Rejected" page every time
 * (three of three), and a second ask five seconds later was answered. The shorter first wait catches the common case
 * sooner; the second is the one measured.
 */
export const ANAF_RETRY_MS = [1500, 5000] as const;

/** An answer that is not JSON — asked once more before it counts as „down". */
class NotJson extends AnafUnavailable {}

let lastStart = 0;
let queue: Promise<unknown> = Promise.resolve();

/** For tests: forget the last call's time. */
export function resetAnafSpacing(): void {
  lastStart = 0;
  queue = Promise.resolve();
}

type Deps = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** The day the answer is asked for, yyyy-MM-dd; today by default. */
  day?: string;
};

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function lookupAnafCompany(cui: string, deps: Deps = {}): Promise<AnafAnswer> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? realSleep;
  const day = deps.day ?? new Date(now()).toISOString().slice(0, 10);
  const once = async (): Promise<AnafAnswer> => {
    const wait = lastStart + ANAF_SPACING_MS - now();
    if (wait > 0) await sleep(wait);
    lastStart = now();
    let res: Response;
    try {
      res = await fetchImpl(ANAF_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": ANAF_USER_AGENT },
        body: JSON.stringify([{ cui: Number(cui), data: day }]),
        signal: AbortSignal.timeout(ANAF_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (err) {
      throw new AnafUnavailable(`ANAF unreachable: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (res.status !== 200 && res.status !== 404) throw new AnafUnavailable(`ANAF answered HTTP ${res.status}`);
    const raw = await res.text().catch(() => "");
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      // The start of what came back, so a log says whether it was a maintenance page, a firewall's or a proxy's.
      const head = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
      throw new NotJson(`ANAF answered HTTP ${res.status} with a body that is not JSON: „${head}"`);
    }
    try {
      return readAnafAnswer(body, cui);
    } catch (err) {
      throw new AnafUnavailable(err instanceof Error ? err.message : "ANAF's answer had an unknown shape");
    }
  };
  // ANAF sometimes answers 200 with an HTML „Request Rejected" page instead of its JSON, and the same request a few
  // seconds later is answered properly (ANAF_RETRY_MS). So an answer that is not JSON is asked again after each wait;
  // a third such answer is „down".
  const run = async (): Promise<AnafAnswer> => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await once();
      } catch (err) {
        if (!(err instanceof NotJson)) throw err;
        const wait = ANAF_RETRY_MS[attempt];
        if (wait === undefined) throw new AnafUnavailable(err.message);
        await sleep(wait);
      }
    }
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}
