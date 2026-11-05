/**
 * The screens' tile choices, for the X in each tile's corner.                                       (Slice 41.91)
 *
 * `useTileChoice` registers its choice here while it is mounted (`registerTileCloser`); a tile's X
 * (`TileCloseButton`) and a tile's title (`TileTitleRow`) read it through `useSyncExternalStore`. No imports, so a
 * title drawn anywhere — a server component, a jest render with no screen — loads nothing more for it.
 */

/** What a tile's X needs from the screen's choice. */
export type TileCloser = { all: readonly string[]; shown: readonly string[]; close: (key: string) => void };

let closers: TileCloser[] = [];
let closersVersion = 0;
const closerListeners = new Set<() => void>();
function closersChanged(): void {
  closersVersion += 1;
  for (const l of closerListeners) l();
}

/** For `useSyncExternalStore`: a change of any screen's choice. */
export function subscribeTileClosers(listener: () => void): () => void {
  closerListeners.add(listener);
  return () => closerListeners.delete(listener);
}
export function tileClosersVersion(): number {
  return closersVersion;
}
/** How many screens' choices are mounted: a title draws the X's place only where one is. */
export function tileClosersCount(): number {
  return closers.length;
}

/** The choice that holds `key` — the latest registered, when two screens' choices both name it. */
export function tileCloserFor(key: string): TileCloser | undefined {
  for (let i = closers.length - 1; i >= 0; i--) if (closers[i].all.includes(key)) return closers[i];
  return undefined;
}

/** Whether a tile's X shows: the tile is on screen and is not the last one shown. */
export function tileClosable(closer: TileCloser | undefined, key: string): boolean {
  return !!closer && closer.shown.includes(key) && closer.shown.length > 1;
}

/** Registers `closer` while its screen is mounted; returns the unregister. */
export function registerTileCloser(closer: TileCloser): () => void {
  closers = [...closers, closer];
  closersChanged();
  return () => {
    closers = closers.filter((c) => c !== closer);
    closersChanged();
  };
}
