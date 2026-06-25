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

type HelpApiResponse = { content: HelpContentData; hints: HelpHintData[] };

async function fetchHelp(screenKey: string): Promise<HelpApiResponse> {
  const res = await fetch(`/api/help/${screenKey}`);
  if (!res.ok) throw new Error("Failed to load help content");
  return res.json();
}

/**
 * Shared data hook for <HelpButton> and <HelpHint>. Both components on the
 * same screen use the same screenKey, so they share one cached fetch — a
 * screen with a HelpButton plus two micro-hints only ever hits
 * GET /api/help/[screenKey] once.
 */
export function useHelpData(screenKey: string) {
  return useQuery({
    queryKey: ["help", screenKey],
    queryFn: () => fetchHelp(screenKey),
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
