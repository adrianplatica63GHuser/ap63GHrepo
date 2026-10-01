"use client";

import { History } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";

/**
 * „Istoricul calculelor" as an icon — Lucide's History, the words its name and
 * tooltip.                                                     (Slice #37.46, A087)
 *
 * A client component of its own because the calculation page is a server
 * component, and a server component cannot hand IconButton its `icon` — see
 * `BackLink` in `src/components/back-arrow.tsx`, which is the same move.
 */
export function HistoryLink({ href, label }: { href: string; label: string }) {
  return <IconButton href={href} icon={History} label={label} variant="secondary" size="sm" />;
}
