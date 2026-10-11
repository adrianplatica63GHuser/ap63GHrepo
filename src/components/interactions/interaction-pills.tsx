"use client";

import { useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ArrowRight, Mail, Mailbox, MessageCircle, MessageSquareText, Phone, Users } from "lucide-react";
import type { InteractionChannel, InteractionDirection, InteractionStatus } from "@/lib/interactions/model";
import { CHANNEL_PILL, DIRECTION_INK, STATUS_PILL } from "@/lib/interactions/palette";

/**
 * The three things a person scans the history for (§5) — channel, direction, status — each a word AND a mark, never
 * colour alone (§8.7).   (Slice #38.84; moved here from src/app/interactions/_components in #38.89, for the person's tile)
 * Icons (§5): envelope, chat bubble, a bubble with lines for SMS, phone handset, two people, post box; 14 px in a pill.
 */
export const CHANNEL_ICON: Readonly<Record<InteractionChannel, LucideIcon>> = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  SMS: MessageSquareText,
  PHONE: Phone,
  MEETING: Users,
  PAPER_MAIL: Mailbox,
};

export const DIRECTION_ICON: Readonly<Record<InteractionDirection, LucideIcon>> = {
  INBOUND: ArrowLeft,
  OUTBOUND: ArrowRight,
};

export function ChannelPill({ channel }: { channel: InteractionChannel }) {
  const t = useTranslations("interactions.channel");
  const Icon = CHANNEL_ICON[channel];
  return (
    <span
      data-channel={channel}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${CHANNEL_PILL[channel]}`}
    >
      <Icon aria-hidden="true" size={14} />
      {t(channel)}
    </span>
  );
}

export function DirectionMark({ direction }: { direction: InteractionDirection }) {
  const t = useTranslations("interactions.direction");
  const Icon = DIRECTION_ICON[direction];
  return (
    <span data-direction={direction} className="inline-flex items-center gap-1.5 text-sm">
      <Icon aria-hidden="true" size={16} className={DIRECTION_INK[direction]} />
      {t(direction)}
    </span>
  );
}

export function StatusPill({ status }: { status: InteractionStatus }) {
  const t = useTranslations("interactions.status");
  return (
    <span data-status={status} className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[status]}`}>
      {t(status)}
    </span>
  );
}
