"use client";

/**
 * Same-browser notices between windows — the React half.       (Slice #37.21)
 *
 * The rule and the message are `@/lib/sync/record-sync`. This provider:
 *   1. wraps `window.fetch` ONCE per window, so every successful write under
 *      /api/ is posted on the channel (see that module's header for why the
 *      wrapper and not the call sites);
 *   2. on a change posted by ANOTHER window — a channel never hears its own
 *      posts — refetches every query but the version lists, so lists and
 *      association tiles show it;
 *   3. hands the change to the record screens that subscribed
 *      (`useRecordSaveSync`), which decide between reloading and saying so.
 *
 * A browser without BroadcastChannel (none this application supports) simply
 * gets no notices; the save's version check still protects it.
 */
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RECORD_CHANNEL, changeOf, refetchesAfterChange, type RecordChange } from "@/lib/sync/record-sync";

type Listener = (change: RecordChange) => void;

interface RecordSyncValue {
  /** Hear changes posted by other windows. Returns the unsubscribe. */
  subscribe: (listener: Listener) => () => void;
}

const RecordSyncContext = createContext<RecordSyncValue>({ subscribe: () => () => {} });

const WRAPPED = Symbol.for("ga40.recordSync.fetchWrapped");

/** The channel the wrapper posts on — this window's, while the provider is mounted. */
let activeChannel: BroadcastChannel | null = null;

/**
 * Wrap `window.fetch` once for the life of the window. Never unwrapped: a
 * remount (Fast Refresh, a layout change) only swaps `activeChannel`, so the
 * wrapper cannot end up wrapped twice and post every change twice.
 */
function wrapFetchOnce(): void {
  const w = window as unknown as Record<symbol, unknown>;
  if (w[WRAPPED]) return;
  w[WRAPPED] = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await original(input, init);
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : undefined);
    const change = changeOf(method, url, window.location.origin, res.ok);
    if (change && activeChannel) {
      try {
        activeChannel.postMessage(change);
      } catch {
        // A channel closed mid-request loses one notice, nothing else.
      }
    }
    return res;
  };
}

export function RecordSyncProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const listeners = useRef(new Set<Listener>());

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(RECORD_CHANNEL);
    activeChannel = channel;
    wrapFetchOnce();

    channel.onmessage = (event: MessageEvent<RecordChange>) => {
      const change = event.data;
      if (!change || typeof change.path !== "string") return;
      void queryClient.invalidateQueries({ predicate: (q) => refetchesAfterChange(q.queryKey) });
      for (const listener of listeners.current) listener(change);
    };

    return () => {
      if (activeChannel === channel) activeChannel = null;
      channel.close();
    };
  }, [queryClient]);

  const value = useMemo<RecordSyncValue>(
    () => ({
      subscribe: (listener) => {
        listeners.current.add(listener);
        return () => listeners.current.delete(listener);
      },
    }),
    [],
  );

  return <RecordSyncContext.Provider value={value}>{children}</RecordSyncContext.Provider>;
}

export function useRecordSync(): RecordSyncValue {
  return useContext(RecordSyncContext);
}
