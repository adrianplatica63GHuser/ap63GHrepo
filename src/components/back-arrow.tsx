"use client";

import { ArrowLeft } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";

// ---------------------------------------------------------------------------
// „Back to <screen>" as a link                       (Slice #18.11, #37.42)
// ---------------------------------------------------------------------------
//
// Since #37.42 (A009) every way back in the app is one icon, Lucide's
// ArrowLeft, through IconButton: the words („← Înapoi la Calcul") are the name
// and the tooltip. This file used to hold `NavArrowIcon`, a hand-drawn 24px
// arrow the back buttons drew beside their words; it went with the words.
//
// A client component of its own because the pages that use it are server
// components, and a server component cannot hand IconButton its `icon`: a
// component is a function, and functions do not cross that boundary. Strings
// do, so the page passes the href and the words and this file picks the icon.
export function BackLink({ href, label }: { href: string; label: string }) {
  return <IconButton href={href} icon={ArrowLeft} label={label} variant="secondary" size="md" />;
}
