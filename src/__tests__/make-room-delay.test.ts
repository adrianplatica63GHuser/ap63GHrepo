/**
 * The make-room delay, read from „Setări" once per page load.   (Slice 39.92)
 *
 * `src/components/tiles/make-room-delay.ts` is the one reader the tile hook
 * asks (39.91). Until the read answers — and when it fails, or the row holds a
 * value the editor could not have saved — the delay is the built-in 1,0 s.
 */
import { MAKE_ROOM_DELAY_MS } from "@/lib/ui/tile-positions";

type Delay = typeof import("@/components/tiles/make-room-delay");

/** A fresh copy of the module (its promise and value are per page load), with `fetch` answering `answer`. */
function fresh(answer: () => Promise<unknown>): { mod: Delay; calls: () => number } {
  let n = 0;
  (global as { fetch?: unknown }).fetch = jest.fn(() => {
    n++;
    return answer();
  });
  let mod!: Delay;
  jest.isolateModules(() => {
    mod = jest.requireActual("@/components/tiles/make-room-delay") as Delay;
  });
  return { mod, calls: () => n };
}

const ok = (items: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve({ items }) });

afterEach(() => {
  delete (global as { fetch?: unknown }).fetch;
});

describe("the make-room delay", () => {
  it("is 1,0 s before anything is read", () => {
    const { mod } = fresh(() => ok([]));
    expect(MAKE_ROOM_DELAY_MS).toBe(1000);
    expect(mod.makeRoomDelayMs()).toBe(1000);
  });

  it("is the saved value once read — and read once, however many screens ask", async () => {
    const { mod, calls } = fresh(() => ok([{ key: "recency_badge_red", value: 5 }, { key: "tile_make_room_delay", value: 1500 }]));
    expect(await mod.loadMakeRoomDelay()).toBe(1500);
    await mod.loadMakeRoomDelay();
    expect(mod.makeRoomDelayMs()).toBe(1500);
    expect(calls()).toBe(1);
  });

  it("is read afresh after „Setări” saves", async () => {
    let value = 1500;
    const { mod, calls } = fresh(() => ok([{ key: "tile_make_room_delay", value }]));
    await mod.loadMakeRoomDelay();
    value = 2250;
    mod.forgetMakeRoomDelay();
    expect(await mod.loadMakeRoomDelay()).toBe(2250);
    expect(mod.makeRoomDelayMs()).toBe(2250);
    expect(calls()).toBe(2);
  });

  it.each([
    ["a failed read", () => Promise.reject(new Error("offline"))],
    ["a refused read", () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })],
    ["no row", () => ok([])],
    ["a value out of range", () => ok([{ key: "tile_make_room_delay", value: 50_000 }])],
    ["a value that is not a whole number of ms", () => ok([{ key: "tile_make_room_delay", value: "1,5" }])],
  ])("%s is 1,0 s", async (_name, answer) => {
    const { mod } = fresh(answer as () => Promise<unknown>);
    expect(await mod.loadMakeRoomDelay()).toBe(1000);
    expect(mod.makeRoomDelayMs()).toBe(1000);
  });

  it("accepts exactly what the editor and the API accept: 200 to 10 000 ms", () => {
    const { mod } = fresh(() => ok([]));
    expect(mod.usableDelay(200)).toBe(200);
    expect(mod.usableDelay(10_000)).toBe(10_000);
    expect(mod.usableDelay(199)).toBe(1000);
    expect(mod.usableDelay(10_001)).toBe(1000);
    expect(mod.usableDelay(1500.5)).toBe(1000);
  });
});
