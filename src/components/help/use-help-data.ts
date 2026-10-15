"use client";

import { useQuery } from "@tanstack/react-query";

export type HelpContentData = {
  backgroundEn: string | null;
  backgroundRo: string | null;
  howToEn: string | null;
  howToRo: string | null;
} | null;

export type HelpHintData = {
  screenKey: string;
  hintKey: string;
  textEn: string | null;
  textRo: string | null;
};

/** Slice #39.40: the screen's „Vezi în manual” link, resolved by the API (src/lib/help/manual-link.ts). */
export type HelpManualData = {
  id: string;
  href: string;
  labels: Record<"ro-RO" | "en-GB", { number: string; title: string }>;
} | null;

type HelpApiResponse = { content: HelpContentData; hints: HelpHintData[]; manual?: HelpManualData };

async function fetchHelp(screenKey: string): Promise<HelpApiResponse> {
  const res = await fetch(`/api/help/${screenKey}`);
  if (!res.ok) throw new Error("Failed to load help content");
  return res.json();
}

/**
 * Shared data hook for <HelpButton> and <HelpHint>. Both components on the
 * same screen use the same screenKey, so they share one cached fetch — a
 * screen with a HelpButton plus six micro-hints (the Properties Map) only
 * ever hits GET /api/help/[screenKey] once.
 *
 * Accepts null so callers that resolve their screen from the route can pass
 * the result straight through without a conditional hook call.
 */
export function useHelpData(screenKey: string | null | undefined) {
  return useQuery({
    queryKey: ["help", screenKey],
    queryFn: () => fetchHelp(screenKey as string),
    // A route with no registered help screen resolves to null. Disabling the
    // query rather than fetching "/api/help/" avoids a guaranteed 404 on every
    // such page — hooks cannot be called conditionally, so the guard lives
    // here rather than at the call site.
    enabled: !!screenKey,
    staleTime: 5 * 60 * 1000,
  });
}

/** Picks the current-locale string, falling back to the other locale. */
export function pickLocaleText(
  locale: string,
  en: string | null | undefined,
  ro: string | null | undefined,
): string | null {
  const isRo = locale === "ro-RO";
  const primary = isRo ? ro : en;
  const fallback = isRo ? en : ro;
  return primary || fallback || null;
}
