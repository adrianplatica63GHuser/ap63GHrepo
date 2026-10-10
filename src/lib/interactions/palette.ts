/**
 * „Interacțiuni" — the spec's palette (§5), as class strings.   (Slice #38.84)
 *
 * Adrian, 2026-10-10: „I love the design choices and the colour choices of the visual representations inside the
 * document, please try to keep them as is." So this module keeps the spec's colours even where the rest of the app
 * uses its navy: indigo #3B5BDB for the primary action and the selected row, a colour per channel, the status pills.
 *
 * ⚠️ **EVERY TEXT HERE READS AT 4.5 : 1 OR BETTER, AND A COLOUR IS DARKENED ONLY WHERE IT WOULD NOT.** A pill is the
 * channel's colour as a 12 % tint, its words and icon in the colour itself — or, where the colour on its own tint
 * falls under 4.5 : 1, the colour darkened toward black just far enough (measured, WCAG 2 contrast):
 *   Email      #1A73E8 → #1767D1 on #E4EEFC  4.60      WhatsApp #128C7E → #0F786C on #E3F1F0  4.61
 *   SMS        #0D9488 → #0B7970 on #E2F2F1  4.57      Telefon  #7C3AED  as is  on #EFE7FD  4.75
 *   Întâlnire  #D97706 → #A55A05 on #FAEFE1  4.55      Poștă    #475569  as is  on #E9EBED  6.34
 * Dark: the tint is 22 % of the colour over zinc-900 and the words the colour lightened toward white, each ≥ 4.5.
 * Status (§5): „Așteaptă răspuns" #B45309 on #FEF3C7 (4.51); Înregistrată / Trimisă / Încheiată green-700 on green-50
 * (4.79); „Programată", which §5 does not colour, indigo on indigo-50 (5.07).
 * Direction (§5): inbound a teal arrow, outbound an indigo one — beside the word, never alone (§8.7).
 *
 * The classes are written out whole so Tailwind's scanner sees them.
 */
import type { InteractionChannel, InteractionDirection, InteractionStatus } from "./model";

/** The primary action and the selection (§5). */
export const INDIGO = "#3B5BDB";

/** A channel's pill: tint, words and icon, light and dark. */
export const CHANNEL_PILL: Readonly<Record<InteractionChannel, string>> = {
  EMAIL: "border-[#1767d1]/25 bg-[#e4eefc] text-[#1767d1] dark:border-[#5195ee]/30 dark:bg-[#182c48] dark:text-[#5195ee]",
  WHATSAPP: "border-[#0f786c]/25 bg-[#e3f1f0] text-[#0f786c] dark:border-[#41a398]/30 dark:bg-[#173231] dark:text-[#41a398]",
  SMS: "border-[#0b7970]/25 bg-[#e2f2f1] text-[#0b7970] dark:border-[#34a59b]/30 dark:bg-[#163333] dark:text-[#34a59b]",
  PHONE: "border-[#7c3aed]/25 bg-[#efe7fd] text-[#7c3aed] dark:border-[#a375f2]/30 dark:bg-[#2e1f49] dark:text-[#a375f2]",
  MEETING: "border-[#a55a05]/25 bg-[#faefe1] text-[#a55a05] dark:border-[#dd851f]/30 dark:bg-[#422d16] dark:text-[#dd851f]",
  PAPER_MAIL: "border-[#475569]/25 bg-[#e9ebed] text-[#475569] dark:border-[#868f9c]/30 dark:bg-[#22252c] dark:text-[#868f9c]",
};

/** A channel's icon alone, on white or on the page (a chip at rest, §3): the same darkened colour. */
export const CHANNEL_INK: Readonly<Record<InteractionChannel, string>> = {
  EMAIL: "text-[#1767d1] dark:text-[#5195ee]",
  WHATSAPP: "text-[#0f786c] dark:text-[#41a398]",
  SMS: "text-[#0b7970] dark:text-[#34a59b]",
  PHONE: "text-[#7c3aed] dark:text-[#a375f2]",
  MEETING: "text-[#a55a05] dark:text-[#dd851f]",
  PAPER_MAIL: "text-[#475569] dark:text-[#868f9c]",
};

export const STATUS_PILL: Readonly<Record<InteractionStatus, string>> = {
  LOGGED: "bg-green-50 text-green-700 dark:bg-[#172f22] dark:text-[#52a16f]",
  NEEDS_REPLY: "bg-[#fef3c7] text-[#b45309] dark:bg-[#3a2517] dark:text-[#c88049]",
  SENT: "bg-green-50 text-green-700 dark:bg-[#172f22] dark:text-[#52a16f]",
  COMPLETED: "bg-green-50 text-green-700 dark:bg-[#172f22] dark:text-[#52a16f]",
  SCHEDULED: "bg-[#eef2ff] text-[#3b5bdb] dark:bg-[#202745] dark:text-[#768ce6]",
};

export const DIRECTION_INK: Readonly<Record<InteractionDirection, string>> = {
  INBOUND: "text-[#0b7970] dark:text-[#34a59b]",
  OUTBOUND: "text-[#3b5bdb] dark:text-[#768ce6]",
};

/** The selected row (§3): indigo-50, and a 3-pixel indigo bar at its left (drawn on its first cell). */
export const SELECTED_ROW = "bg-[#eef2ff] dark:bg-[#202745]";
export const SELECTED_BAR = "shadow-[inset_3px_0_0_0_#3b5bdb] dark:shadow-[inset_3px_0_0_0_#768ce6]";
/** Hover (§3): slate-50. */
export const HOVER_ROW = "hover:bg-slate-50 dark:hover:bg-zinc-800/60";

/** A tile (§2): a 12-pixel radius, a 1-pixel slate border, a very light shadow. */
export const MODULE_CARD =
  "rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.06)] " +
  "dark:border-zinc-700 dark:bg-zinc-900";
