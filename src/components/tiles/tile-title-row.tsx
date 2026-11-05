"use client";

/**
 * A tile title's line: the heading, its „i", its action and — since 41.91 — the tile's X.          (Slice 41.91)
 *
 * `TileTitle` stays a plain component (server pages draw it too), so the one part that has to watch the screen —
 * whether a tile choice is mounted at all, and so whether the X has a place — is this client piece. With no screen's
 * choice mounted (a dialog, a jest render, a page with no „Panouri") it draws exactly what TileTitle drew before 41.91:
 * the heading alone, or the line with its „i" and its action. The X itself (`TileCloseButton`) is loaded only where it
 * is drawn, so nothing that renders a title loads its translations.
 */
import { lazy, Suspense, useSyncExternalStore, type ReactNode } from "react";
import { subscribeTileClosers, tileClosersCount } from "./tile-closers";

const TileCloseButton = lazy(() => import("./tile-close").then((m) => ({ default: m.TileCloseButton })));
const noScreen = () => 0;

export function TileTitleRow({
  heading,
  hint,
  action,
  close,
  title,
}: {
  heading: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  /** The tile's X at the line's end; false in edit, or where the tile draws its own. */
  close: boolean;
  /** The tile's name, for „Închide — <tile>". */
  title?: string;
}) {
  const screenHasTiles = useSyncExternalStore(subscribeTileClosers, tileClosersCount, noScreen) > 0;
  const closer =
    close && screenHasTiles ? (
      <Suspense fallback={null}>
        <TileCloseButton title={title} firstTitle />
      </Suspense>
    ) : null;
  if (!hint && !action && !closer) return <>{heading}</>;
  return (
    // 41.91: with the X and no action, the title is centred on the X as it is on an action (3 px down).
    <div className="flex items-start gap-1.5 [&:has([data-tile-close])>h2]:mt-[3px]" data-tile-title-line="">
      {heading}
      {hint && <div className={`flex shrink-0 items-center${action ? " mt-[3px]" : ""}`}>{hint}</div>}
      {action ? (
        <div className="ml-auto flex shrink-0 items-center gap-2 pl-0.5" data-tile-title-action="">
          {action}
          {closer}
        </div>
      ) : (
        closer && (
          <div className="ml-auto flex shrink-0 items-center pl-0.5" data-tile-title-close="">
            {closer}
          </div>
        )
      )}
    </div>
  );
}
