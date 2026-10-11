"use client";

import { useEffect, useEffectEvent, useId, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { Check, CirclePlus, Link2, Mail, MessageCircle, SquarePen, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { buttonClass } from "@/lib/ui/button-styles";
import { screenBox } from "@/lib/ui/field-widths";
import { INTERACTION_CHANNELS, INTERACTION_STATUSES, SUBJECT_MAX, type InteractionRecord } from "@/lib/interactions/model";
import { CHANNEL_INK, CHANNEL_PILL, MODULE_CARD } from "@/lib/interactions/palette";
import {
  DESCRIPTION_PROMPT,
  checkForm,
  emptyForm,
  firstError,
  isDirty,
  localMinute,
  nextAfterSave,
  type FormError,
  type FormField,
  type LogForm,
} from "@/lib/interactions/form";
import { CHANNEL_ICON, DIRECTION_ICON } from "./interaction-pills";
import { PersonPicker } from "./filter-controls";

/** The ids the focus goes to when a field is in error (§7). */
const FIELD_ID: Readonly<Record<FormField, string>> = {
  personId: "interaction-person",
  subject: "interaction-subject",
  when: "interaction-when",
  followUpOn: "interaction-follow-up",
};

/** „Now" to the minute, read as a store: the server renders none, the browser its own clock. */
function subscribeMinute(onChange: () => void): () => void {
  const t = setInterval(onChange, 15_000);
  return () => clearInterval(t);
}
function useNowMinute(): string {
  return useSyncExternalStore(subscribeMinute, () => localMinute(new Date()), () => "");
}

const BOX =
  "rounded-md border bg-white px-3 py-1.5 text-sm text-ink placeholder:text-fade dark:bg-zinc-900 dark:text-zinc-100";
const boxBorder = (invalid: boolean) =>
  invalid ? "border-red-700 outline outline-1 outline-red-700 dark:border-red-400 dark:outline-red-400" : "border-slate-300 dark:border-zinc-600";

/**
 * Tile two — „Înregistrează o interacțiune" (§4), new-record mode.   (Slice #38.85)
 *
 * Two jobs kept apart: the connections card on top — drawn as Figure 2 draws it and inert, because there is no Gmail
 * and no WhatsApp in this app (Adrian, 2026-10-10) — and the manual entry form under it, which needs no account at
 * all (§8.4). The form is checked with the route's own schema (`src/lib/interactions/form.ts`); Save stays disabled
 * until it passes, and Ctrl+S on a form that does not pass outlines what is missing and moves the focus there.
 */
export function LogTile({
  scope,
  scopeName,
  onSaved,
  tileRef,
}: {
  scope: string | null;
  scopeName: string | null;
  onSaved: (record: InteractionRecord) => void;
  tileRef: RefObject<HTMLElement | null>;
}) {
  const t = useTranslations("interactions");
  const tl = useTranslations("interactions.log");
  const now = useNowMinute();
  const [base, setBase] = useState<LogForm>(() => emptyForm(scope));
  const [form, setForm] = useState<LogForm>(base);
  const [touched, setTouched] = useState<Partial<Record<FormField, true>>>({});
  const [showAll, setShowAll] = useState(false);
  const [askCancel, setAskCancel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [personName, setPersonName] = useState<string | null>(scopeName);

  // A new scope, on a form nobody has touched, is the form's person (§4: pre-filled from the scope).
  const [prevScope, setPrevScope] = useState(scope);
  if (prevScope !== scope) {
    setPrevScope(scope);
    if (!isDirty(form, base)) {
      const fresh = emptyForm(scope);
      setBase(fresh);
      setForm(fresh);
      setPersonName(scopeName);
    }
  }
  if (form.personId === scope && scopeName && personName !== scopeName) setPersonName(scopeName);

  // Checked against the clock each render; `now` re-renders it every 15 s, so a time typed ahead turns valid in time.
  const check = checkForm(form, new Date());
  const errors: Partial<Record<FormField, FormError>> = check.ok ? {} : check.errors;
  const shown = (f: FormField) => (showAll || touched[f] ? errors[f] : undefined);
  const set = (patch: Partial<LogForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setAskCancel(false);
  };
  const touch = (f: FormField) => setTouched((prev) => ({ ...prev, [f]: true }));

  const save = async (andNew: boolean) => {
    if (saving) return;
    const result = checkForm(form, new Date());
    if (!result.ok) {
      setShowAll(true);
      const first = firstError(result.errors);
      if (first) document.getElementById(FIELD_ID[first])?.focus();
      return;
    }
    setSaving(true);
    setFailed(false);
    try {
      const res = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.input),
      });
      if (res.status !== 201 || res.redirected) throw new Error(`POST /api/interactions ${res.status}`);
      const record = (await res.json()) as InteractionRecord;
      const next = andNew ? nextAfterSave(form) : emptyForm(scope);
      setBase(next);
      setForm(next);
      if (!andNew) setPersonName(scopeName);
      setTouched({});
      setShowAll(false);
      onSaved(record);
      document.getElementById(andNew ? FIELD_ID.subject : "interaction-channel-first")?.focus();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (isDirty(form, base)) {
      setAskCancel(true);
      return;
    }
    clear();
  };
  const clear = () => {
    const fresh = emptyForm(scope);
    setBase(fresh);
    setForm(fresh);
    setPersonName(scopeName);
    setTouched({});
    setShowAll(false);
    setAskCancel(false);
  };

  // Ctrl+S saves (§4) — and never opens the browser's own „Save page".
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void save(false);
    }
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const ids = {
    hintWhen: useId(),
    hintPerson: useId(),
    hintSubject: useId(),
    hintDescription: useId(),
    hintFollowUp: useId(),
    channel: useId(),
    direction: useId(),
  };

  return (
    <section
      ref={tileRef}
      tabIndex={-1}
      aria-labelledby="interactions-log-title"
      data-interactions-log=""
      className={`${MODULE_CARD} flex min-w-0 flex-col gap-4 p-4 focus-visible:outline-2 focus-visible:outline-focus`}
    >
      <h2 id="interactions-log-title" className="flex items-center gap-2 text-lg font-semibold text-ink dark:text-zinc-100">
        <SquarePen aria-hidden="true" size={20} className="text-[#3b5bdb] dark:text-[#768ce6]" />
        {t("screen.logTitle")}
      </h2>

      <Connections />

      <form
        noValidate
        aria-label={tl("manual")}
        data-log-form=""
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
        className="flex flex-col gap-4"
      >
        <h3 className="text-sm font-semibold text-ink dark:text-zinc-100">{tl("manual")}</h3>

        <Field label={tl("channel")} labelId={ids.channel}>
          <div role="radiogroup" aria-labelledby={ids.channel} className="flex flex-wrap gap-1.5" data-log-channel="">
            {INTERACTION_CHANNELS.map((c, i) => {
              const Icon = CHANNEL_ICON[c];
              const on = form.channel === c;
              return (
                <label
                  key={c}
                  data-channel-option={c}
                  className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
                    on ? CHANNEL_PILL[c] : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="interaction-channel"
                    id={i === 0 ? "interaction-channel-first" : undefined}
                    className="sr-only"
                    checked={on}
                    onChange={() => set({ channel: c })}
                  />
                  <Icon aria-hidden="true" size={16} className={on ? undefined : CHANNEL_INK[c]} />
                  {t(`channel.${c}`)}
                </label>
              );
            })}
          </div>
        </Field>

        <div className="flex flex-wrap gap-x-6 gap-y-4">
          <Field label={tl("direction")} labelId={ids.direction}>
            <div role="radiogroup" aria-labelledby={ids.direction} className="inline-flex overflow-hidden rounded-md border border-slate-300 dark:border-zinc-600" data-log-direction="">
              {(["INBOUND", "OUTBOUND"] as const).map((d, i) => {
                const Icon = DIRECTION_ICON[d];
                const on = form.direction === d;
                return (
                  <label
                    key={d}
                    className={`inline-flex cursor-pointer select-none items-center gap-1.5 px-3 py-1.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-focus ${
                      i > 0 ? "border-l border-slate-300 dark:border-zinc-600" : ""
                    } ${on ? "bg-[#3b5bdb] font-medium text-white dark:bg-[#768ce6] dark:text-zinc-900" : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-300"}`}
                  >
                    <input type="radio" name="interaction-direction" className="sr-only" checked={on} onChange={() => set({ direction: d })} />
                    <Icon aria-hidden="true" size={16} />
                    {t(`direction.${d}`)}
                  </label>
                );
              })}
            </div>
          </Field>

          <Field label={tl("status")} htmlFor="interaction-status">
            <select
              id="interaction-status"
              value={form.status}
              onChange={(e) => set({ status: e.target.value as LogForm["status"] })}
              className={`${BOX} ${boxBorder(false)}`}
              {...screenBox("interactionStatus")}
            >
              {INTERACTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={tl("when")} htmlFor={FIELD_ID.when} hint={shown("when") ? tl(`error.${shown("when")}`) : tl("whenHint")} hintId={ids.hintWhen} error={!!shown("when")}>
          <input
            id={FIELD_ID.when}
            type="datetime-local"
            value={form.when ?? now}
            onChange={(e) => set({ when: e.target.value })}
            onBlur={() => touch("when")}
            aria-invalid={!!shown("when")}
            aria-describedby={ids.hintWhen}
            className={`${BOX} ${boxBorder(!!shown("when"))}`}
            {...screenBox("interactionWhen")}
          />
        </Field>

        <Field label={tl("person")} htmlFor={FIELD_ID.personId} hint={shown("personId") ? tl(`error.${shown("personId")}`) : undefined} hintId={ids.hintPerson} error={!!shown("personId")}>
          <PersonPicker
            inputId={FIELD_ID.personId}
            personId={form.personId}
            personName={personName}
            label={tl("person")}
            placeholder={tl("personPlaceholder")}
            clearLabel={tl("personClear")}
            invalid={!!shown("personId")}
            describedBy={ids.hintPerson}
            onPick={(id, name) => {
              set({ personId: id });
              setPersonName(name);
              touch("personId");
            }}
          />
        </Field>

        <Field
          label={tl("subject")}
          htmlFor={FIELD_ID.subject}
          hint={shown("subject") ? tl(`error.${shown("subject")}`) : tl("subjectHint")}
          hintId={ids.hintSubject}
          error={!!shown("subject")}
        >
          <input
            id={FIELD_ID.subject}
            type="text"
            value={form.subject}
            maxLength={SUBJECT_MAX}
            placeholder={tl("subjectPlaceholder")}
            onChange={(e) => set({ subject: e.target.value })}
            onBlur={() => touch("subject")}
            aria-invalid={!!shown("subject")}
            aria-describedby={ids.hintSubject}
            className={`${BOX} ${boxBorder(!!shown("subject"))}`}
            {...screenBox("interactionSubjectLine")}
          />
        </Field>

        <Field label={tl("description")} htmlFor="interaction-description" hint={tl("descriptionHint")} hintId={ids.hintDescription}>
          <textarea
            id="interaction-description"
            rows={3}
            value={form.description}
            placeholder={tl(`prompt.${DESCRIPTION_PROMPT[form.channel]}`)}
            onChange={(e) => set({ description: e.target.value })}
            aria-describedby={ids.hintDescription}
            className={`${BOX} ${boxBorder(false)}`}
            {...screenBox("interactionDescription")}
          />
        </Field>

        <div className="flex flex-col gap-1.5" data-log-follow-up="">
          <span className="text-sm font-medium text-ink dark:text-zinc-100">{tl("followUp")}</span>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={form.followUp} onChange={(e) => set({ followUp: e.target.checked })} className="accent-[#3b5bdb]" />
              {tl("followUpSet")}
            </label>
            {form.followUp && (
              <input
                id={FIELD_ID.followUpOn}
                type="date"
                aria-label={tl("followUpDate")}
                value={form.followUpOn}
                onChange={(e) => set({ followUpOn: e.target.value })}
                onBlur={() => touch("followUpOn")}
                aria-invalid={!!shown("followUpOn")}
                aria-describedby={ids.hintFollowUp}
                className={`${BOX} ${boxBorder(!!shown("followUpOn"))}`}
                {...screenBox("interactionDay")}
              />
            )}
          </div>
          <p id={ids.hintFollowUp} className={`text-xs ${shown("followUpOn") ? "text-red-700 dark:text-red-400" : "text-fade dark:text-zinc-400"}`}>
            {shown("followUpOn") ? tl("error.followUpRequired") : tl("followUpHint")}
          </p>
        </div>

        <div className="flex flex-col gap-1.5" data-log-internal="">
          <span className="text-sm font-medium text-ink dark:text-zinc-100">{tl("internal")}</span>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              role="switch"
              aria-checked={form.internal}
              checked={form.internal}
              onChange={(e) => set({ internal: e.target.checked })}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative inline-block h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-[#3b5bdb] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4 dark:bg-zinc-600 dark:peer-checked:bg-[#768ce6]"
            />
            {tl("internalHint")}
          </label>
          {form.internal && (
            <textarea
              aria-label={tl("internalNote")}
              rows={2}
              value={form.internalNote}
              onChange={(e) => set({ internalNote: e.target.value })}
              className={`${BOX} ${boxBorder(false)}`}
              {...screenBox("interactionDescription")}
            />
          )}
        </div>

        {failed && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {tl("saveFailed")}
          </p>
        )}

        {askCancel && (
          <div role="alertdialog" aria-labelledby="interaction-discard-title" className="flex flex-wrap items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-700 dark:bg-amber-950/40">
            <span id="interaction-discard-title" className="text-ink dark:text-zinc-100">
              {tl("discardQuestion")}
            </span>
            <button type="button" onClick={clear} className={buttonClass({ variant: "danger", size: "sm" })}>
              {tl("discardYes")}
            </button>
            <button type="button" onClick={() => setAskCancel(false)} className={buttonClass({ variant: "secondary", size: "sm" })}>
              {tl("discardNo")}
            </button>
          </div>
        )}

        {/* The action bar (§4). */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-zinc-700" data-log-actions="">
          <IconButton
            type="submit"
            icon={Check}
            label={tl("save")}
            showLabel
            variant="accent"
            size="lg"
            busy={saving}
            busyLabel={tl("saving")}
            disabled={!check.ok || saving}
          />
          <IconButton
            icon={CirclePlus}
            label={tl("saveAndNew")}
            showLabel
            variant="secondary"
            size="lg"
            disabled={!check.ok || saving}
            onClick={() => void save(true)}
          />
          <IconButton icon={X} label={tl("cancel")} showLabel variant="ghost" size="lg" onClick={cancel} />
          <span className="ml-auto flex items-center gap-1 text-xs text-fade dark:text-zinc-400" data-ctrl-s="">
            {tl("ctrlS")}
            <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-sans dark:border-zinc-600">Ctrl</kbd>
            <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-sans dark:border-zinc-600">S</kbd>
          </span>
        </div>
      </form>
    </section>
  );
}

/** A label above its control, and the standing hint under it (§5: hints are text, not only tooltips). */
function Field({
  label,
  htmlFor,
  labelId,
  hint,
  hintId,
  error = false,
  children,
}: {
  label: string;
  htmlFor?: string;
  labelId?: string;
  hint?: string;
  hintId?: string;
  error?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink dark:text-zinc-100">
          {label}
        </label>
      ) : (
        <span id={labelId} className="text-sm font-medium text-ink dark:text-zinc-100">
          {label}
        </span>
      )}
      {children}
      {hint !== undefined && (
        <p id={hintId} className={`text-xs ${error ? "text-red-700 dark:text-red-400" : "text-fade dark:text-zinc-400"}`}>
          {hint}
        </p>
      )}
      {hint === undefined && hintId && <span id={hintId} hidden />}
    </div>
  );
}

/**
 * „Conturi conectate" (§4, Figure 2) — drawn, inert. Gmail and WhatsApp Business both read „Neconectat"; the
 * connect button is disabled and says the connection comes later. No storage, no sign-in, no network call.
 */
function Connections() {
  const tl = useTranslations("interactions.log");
  const rows = [
    { key: "gmail", name: "Gmail", Icon: Mail, ink: CHANNEL_INK.EMAIL },
    { key: "whatsapp", name: "WhatsApp Business", Icon: MessageCircle, ink: CHANNEL_INK.WHATSAPP },
  ] as const;
  return (
    <div className="rounded-lg border border-slate-200 dark:border-zinc-700" data-connections="">
      <h3 className="px-3 pt-2.5 text-sm font-semibold text-ink dark:text-zinc-100">{tl("connections")}</h3>
      <ul className="divide-y divide-slate-200 dark:divide-zinc-700">
        {rows.map(({ key, name, Icon, ink }) => (
          <li key={key} className="flex flex-wrap items-center gap-3 px-3 py-2.5" data-connection={key}>
            <Icon aria-hidden="true" size={24} className={ink} />
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-ink dark:text-zinc-100">{name}</span>
              <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                {tl("notConnected")}
              </span>
            </div>
            <IconButton
              icon={Link2}
              label={tl("connect")}
              showLabel
              variant="secondary"
              size="sm"
              disabled
              note={tl("connectLater")}
              className="ml-auto"
            />
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1.5 border-t border-slate-200 px-3 py-2 text-xs text-fade dark:border-zinc-700 dark:text-zinc-400">
        {tl("nothingSent")}
      </p>
    </div>
  );
}
