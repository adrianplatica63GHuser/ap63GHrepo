"use client";

/**
 * The page bar's slot, left of „?" — where a record screen puts its versions pill and „Panouri".        (Slice 41.08)
 *
 * Adrian, 2026-10-29: „can we possibly move the buttons for the versions and for the panels inside this bar at the left
 * of the help button?" The bar (`breadcrumb-bar.tsx`) lives in the app shell, above every screen, so the shell holds the
 * slot's element here and the bar registers it (Ask first 2). A record screen draws `PageBarControls` in its header, as
 * it drew the two controls before; they are portalled into the bar, in the order given — the versions pill's slot
 * first, then „Panouri". The record's name stays in its header.
 *
 * With no shell around (a jest render of one screen) the controls stay in the header, where they were. With a shell
 * whose bar is not drawn yet (its Suspense), they wait for it rather than flash in the header and jump.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Slot = { slot: HTMLElement | null; setSlot: (el: HTMLElement | null) => void };

const PageBarSlotContext = createContext<Slot | null>(null);

/** In the app shell, around the bar and the screen. */
export function PageBarSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ slot, setSlot }), [slot]);
  return <PageBarSlotContext.Provider value={value}>{children}</PageBarSlotContext.Provider>;
}

/** The bar's ref for its slot; undefined with no shell. */
export function usePageBarSlotRef(): ((el: HTMLElement | null) => void) | undefined {
  return useContext(PageBarSlotContext)?.setSlot;
}

/** A record screen's controls: in the bar's slot, or in place when there is no shell. */
export function PageBarControls({ children }: { children: ReactNode }) {
  const ctx = useContext(PageBarSlotContext);
  const controls = (
    <div className={`${ctx ? "" : "ml-auto "}flex shrink-0 items-center gap-3`} data-record-controls="">
      {children}
    </div>
  );
  if (!ctx) return controls;
  return ctx.slot ? createPortal(controls, ctx.slot) : null;
}
