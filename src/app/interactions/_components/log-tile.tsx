"use client";

import { useEffect, useEffectEvent, useId, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, CirclePlus, FileText, Link2, Mail, Map as MapIcon, MessageCircle, Plus, SquarePen, Trash2, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUnsavedChangesGuard } from "@/components/providers/unsaved-changes-provider";
import { useNameOr } from "@/components/record/use-name-or";
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
  fromRecord,
  isDirty,
  localMinute,
  nextAfterSave,
  withDocument,
  withTag,
  type FormError,
  type LinkedDocument,
  type FormField,
  type LogForm,
} from "@/lib/interactions/form";
import { CHANNEL_ICON, DIRECTION_ICON } from "@/components/interactions/interaction-pills";
import { PersonPicker } from "./filter-controls";
import { RecordSearch } from "./pickers";
import { useInteraction } from "./history-tile";

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

/** What the screen asks the tile to confirm before it throws a dirty form away (38.87): another row, or a new record. */
export type SwitchRequest = { kind: "select"; id: string } | { kind: "new" };

/**
 * Tile two — „Înregistrează o interacțiune" (§4).   (Slices #38.85, #38.87)
 *
 * Two jobs kept apart: the connections card on top — drawn as Figure 2 draws it and inert, because there is no Gmail
 * and no WhatsApp in this app (Adrian, 2026-10-10) — and the manual entry form under it, which needs no account at
 * all (§8.4). The form is checked with the route's own schema (`src/lib/interactions/form.ts`); Save stays disabled
 * until it passes, and Ctrl+S on a form that does not pass outlines what is missing and moves the focus there.
 *
 * 38.87 — TWO MODES, the spec's two-part switch: „Înregistrare nouă", and „Editează selecția" once a row of the history
 * is chosen (the screen's `selectedId`). Edit mode loads the record, saves it with „Salvează modificările" over the
 * `updatedAt` it read — a record someone else changed since answers 409 and the tile offers „Reîncarcă" (the default)
 * or „Suprascrie", never silently — deletes it after a confirmation that names the person and the date, and shows
 * the audit line. A dirty form is never thrown away without asking: here for another row or a new record
 * (`request`), and through the app's unsaved-changes guard for leaving the screen.
 */
export function LogTile({
  scope,
  scopeName,
  selectedId,
  request,
  onRequest,
  onModeNew,
  onSaved,
  onDeleted,
  dirtyRef,
  tileRef,
  personFixed = false,
}: {
  scope: string | null;
  scopeName: string | null;
  selectedId: string | null;
  request: SwitchRequest | null;
  onRequest: (answer: boolean) => void;
  onModeNew: () => void;
  onSaved: (record: InteractionRecord, kind: "created" | "updated") => void;
  onDeleted: (id: string) => void;
  dirtyRef: RefObject<boolean>;
  tileRef: RefObject<HTMLElement | null>;
  /**
   * Slice #39.05: on a person's screen (C of the person's „Interacțiuni") the person is the screen's — the picker is
   * not drawn — and Ctrl+S saves this form only while the focus is in it, so the person's own form keeps its Ctrl+S.
   */
  personFixed?: boolean;
}) {
  const t = useTranslations("interactions");
  const tl = useTranslations("interactions.log");
  const locale = useLocale();
  const now = useNowMinute();
  const queryClient = useQueryClient();
  const record = useInteraction(selectedId);
  const loaded = selectedId !== null && record.data?.id === selectedId ? record.data : null;
  const mode: "new" | "edit" = selectedId ? "edit" : "new";

  const [base, setBase] = useState<LogForm>(() => emptyForm(scope));
  const [form, setForm] = useState<LogForm>(base);
  const [touched, setTouched] = useState<Partial<Record<FormField, true>>>({});
  const [showAll, setShowAll] = useState(false);
  const [askCancel, setAskCancel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [personName, setPersonName] = useState<string | null>(scopeName);
  const [conflict, setConflict] = useState<InteractionRecord | null>(null);
  const [askDelete, setAskDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The version the form was filled from — what a change is saved over. Not `loaded.updatedAt`: a background read of
  // a newer copy must never make a save land over a change nobody here has seen (§7).
  const [readAt, setReadAt] = useState<string | null>(null);
  const dirty = isDirty(form, base);

  const reset = (next: LogForm, name: string | null, version: string | null = null) => {
    setReadAt(version);
    setBase(next);
    setForm(next);
    setPersonName(name);
    setTouched({});
    setShowAll(false);
    setAskCancel(false);
    setFailed(false);
    setConflict(null);
    setAskDelete(false);
  };

  // What the form holds follows the mode: a new record, or the record chosen — loaded, and again whenever it is
  // read anew (after a save, a reload). A newer copy of the SAME record never replaces what is being typed: that is
  // the 409's job, at save.
  const formKey = loaded ? `${loaded.id}@${loaded.updatedAt}` : selectedId ? `loading:${selectedId}` : "new";
  const [shownKey, setShownKey] = useState(formKey);
  if (shownKey !== formKey) {
    const sameRecord = loaded !== null && shownKey.startsWith(`${loaded.id}@`);
    setShownKey(formKey);
    if (loaded && (!sameRecord || !dirty)) reset(fromRecord(loaded), loaded.personName, loaded.updatedAt);
    else if (!selectedId) reset(emptyForm(scope), scopeName);
  }

  // A new scope, on a new form nobody has touched, is the form's person (§4: pre-filled from the scope).
  const [prevScope, setPrevScope] = useState(scope);
  if (prevScope !== scope) {
    setPrevScope(scope);
    if (mode === "new" && !dirty) reset(emptyForm(scope), scopeName);
  }
  if (mode === "new" && form.personId === scope && scopeName && personName !== scopeName) setPersonName(scopeName);

  // Checked against the clock each render; `now` re-renders it every 15 s, so a time typed ahead turns valid in time.
  const check = checkForm(form, new Date());
  const errors: Partial<Record<FormField, FormError>> = check.ok ? {} : check.errors;
  const shown = (f: FormField) => (showAll || touched[f] ? errors[f] : undefined);
  const set = (patch: Partial<LogForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setAskCancel(false);
  };
  const touch = (f: FormField) => setTouched((prev) => ({ ...prev, [f]: true }));

  /** Save — a new record, or the loaded one over the `updatedAt` it was read at (or, after „Suprascrie", the newest). */
  const save = async (andNew: boolean, over?: string): Promise<boolean> => {
    if (saving) return false;
    const result = checkForm(form, new Date());
    if (!result.ok) {
      setShowAll(true);
      const first = firstError(result.errors);
      if (first) document.getElementById(FIELD_ID[first])?.focus();
      return false;
    }
    if (mode === "edit" && (!loaded || !readAt)) return false;
    setSaving(true);
    setFailed(false);
    try {
      const res =
        mode === "new"
          ? await fetch("/api/interactions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(result.input),
            })
          : await fetch(`/api/interactions/${encodeURIComponent((loaded as InteractionRecord).id)}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...result.input, expectedUpdatedAt: over ?? readAt }),
            });
      if (res.status === 409) {
        // §7: „This record was updated by someone else. Reload, or overwrite." Overwrite is never the default.
        const body = (await res.json()) as { current: InteractionRecord | null };
        setConflict(body.current);
        return false;
      }
      if (!res.ok || res.redirected) throw new Error(`${mode === "new" ? "POST" : "PUT"} /api/interactions ${res.status}`);
      const saved = (await res.json()) as InteractionRecord;
      if (mode === "new") {
        reset(andNew ? nextAfterSave(form) : emptyForm(scope), andNew ? personName : scopeName);
        onSaved(saved, "created");
        document.getElementById(andNew ? FIELD_ID.subject : "interaction-channel-first")?.focus();
      } else {
        queryClient.setQueryData(["interaction", saved.id], saved);
        reset(fromRecord(saved), saved.personName, saved.updatedAt);
        setShownKey(`${saved.id}@${saved.updatedAt}`);
        onSaved(saved, "updated");
      }
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setSaving(false);
    }
  };

  /** „Reîncarcă" after a 409: what is stored now, the changes typed here dropped. */
  const reload = () => {
    const current = conflict;
    setConflict(null);
    if (current) {
      queryClient.setQueryData(["interaction", current.id], current);
      reset(fromRecord(current), current.personName, current.updatedAt);
      setShownKey(`${current.id}@${current.updatedAt}`);
    }
    void queryClient.invalidateQueries({ queryKey: ["interactions"] });
  };

  const remove = async () => {
    if (!loaded || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/interactions/${encodeURIComponent(loaded.id)}`, { method: "DELETE" });
      if (!(res.status === 204 || res.status === 404) || res.redirected) throw new Error(`DELETE ${res.status}`);
      queryClient.removeQueries({ queryKey: ["interaction", loaded.id] });
      setAskDelete(false);
      reset(emptyForm(scope), scopeName);
      onDeleted(loaded.id);
    } catch {
      setFailed(true);
      setAskDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  /** „Renunță" (§4): clean — a new form clears, an edit stays; dirty — asks first. */
  const cancel = () => {
    if (dirty) {
      setAskCancel(true);
      return;
    }
    clear();
  };
  const clear = () => {
    if (loaded) reset(fromRecord(loaded), loaded.personName, loaded.updatedAt);
    else reset(emptyForm(scope), scopeName);
  };

  // The screen asks before it switches row or mode; the app's guard asks before it leaves (38.87).
  useEffect(() => {
    dirtyRef.current = dirty;
  });
  useUnsavedChangesGuard({ isDirty: dirty, onSave: () => save(false) });

  const stamp = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  // Ctrl+S saves (§4) — and never opens the browser's own „Save page".
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") {
      if (personFixed && !tileRef.current?.contains(document.activeElement)) return;
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

      {/* 38.87: the mode switch (§4, Figure 2) — „Editează selecția" once a row of the history is chosen. */}
      <div role="radiogroup" aria-label={tl("mode")} data-log-mode={mode} className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-300 text-sm dark:border-zinc-600">
        {(["new", "edit"] as const).map((m, i) => (
          <label
            key={m}
            className={`flex cursor-pointer select-none items-center justify-center px-3 py-1.5 has-[:disabled]:cursor-not-allowed has-[:disabled]:text-fade has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-focus ${
              i > 0 ? "border-l border-slate-300 dark:border-zinc-600" : ""
            } ${mode === m ? "bg-[#eef2ff] font-medium text-[#3b5bdb] dark:bg-[#202745] dark:text-[#768ce6]" : "bg-white text-slate-700 dark:bg-zinc-900 dark:text-zinc-300"}`}
          >
            <input
              type="radio"
              name="interaction-mode"
              className="sr-only"
              checked={mode === m}
              disabled={m === "edit" && !selectedId}
              onChange={() => (m === "new" ? onModeNew() : undefined)}
            />
            {m === "new" ? tl("modeNew") : tl("modeEdit")}
          </label>
        ))}
      </div>

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
        {mode === "edit" && !loaded && (
          <p role="status" className="text-sm text-fade dark:text-zinc-400" data-log-loading="">
            {record.isError ? tl("loadFailed") : tl("loadingRecord")}
          </p>
        )}
        <fieldset disabled={mode === "edit" && !loaded} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">

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

        {!personFixed && (
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
        )}

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

        {/* 38.86: what the record links to — documents already in the archive, tags, one property. */}
        <LinkedDocuments documents={form.documents} onChange={(documents) => set({ documents })} />
        <TagChips tags={form.tags} onChange={(tags) => set({ tags })} />
        <RelatedProperty property={form.property} onChange={(property) => set({ property })} />

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

        </fieldset>

        {failed && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {tl("saveFailed")}
          </p>
        )}

        {(askCancel || request) && (
          <div role="alertdialog" aria-labelledby="interaction-discard-title" data-log-discard="" className="flex flex-wrap items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-700 dark:bg-amber-950/40">
            <span id="interaction-discard-title" className="text-ink dark:text-zinc-100">
              {mode === "new" && !request ? tl("discardQuestion") : tl("discardChanges")}
            </span>
            <button
              type="button"
              onClick={() => {
                if (request) onRequest(true);
                else clear();
              }}
              className={buttonClass({ variant: "danger", size: "sm" })}
            >
              {tl("discardYes")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (request) onRequest(false);
                else setAskCancel(false);
              }}
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              {tl("discardNo")}
            </button>
          </div>
        )}

        {/* §7: the record changed underneath — reload (the default) or overwrite, never silently. */}
        {conflict && (
          <div role="alertdialog" aria-labelledby="interaction-conflict-title" data-log-conflict="" className="flex flex-wrap items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-700 dark:bg-amber-950/40">
            <span id="interaction-conflict-title" className="text-ink dark:text-zinc-100">
              {tl("conflict")}
            </span>
            <button type="button" id="interaction-conflict-reload" onClick={reload} className={buttonClass({ variant: "accent", size: "sm" })}>
              {tl("conflictReload")}
            </button>
            <button
              type="button"
              onClick={() => {
                const over = conflict.updatedAt;
                setConflict(null);
                void save(false, over);
              }}
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              {tl("conflictOverwrite")}
            </button>
          </div>
        )}

        {/* The action bar (§4). */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-zinc-700" data-log-actions="">
          {mode === "edit" && (
            <IconButton icon={Trash2} label={tl("delete")} showLabel variant="bare-danger" size="lg" disabled={!loaded || saving} onClick={() => setAskDelete(true)} />
          )}
          <IconButton
            type="submit"
            icon={Check}
            label={mode === "edit" ? tl("saveChanges") : tl("save")}
            showLabel
            variant="accent"
            size="lg"
            busy={saving}
            busyLabel={tl("saving")}
            disabled={!check.ok || saving || (mode === "edit" && (!loaded || !dirty))}
          />
          {mode === "new" && (
            <IconButton
              icon={CirclePlus}
              label={tl("saveAndNew")}
              showLabel
              variant="secondary"
              size="lg"
              disabled={!check.ok || saving}
              onClick={() => void save(true)}
            />
          )}
          <IconButton icon={X} label={tl("cancel")} showLabel variant="ghost" size="lg" onClick={cancel} />
          <span className="ml-auto flex items-center gap-1 text-xs text-fade dark:text-zinc-400" data-ctrl-s="">
            {tl("ctrlS")}
            <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-sans dark:border-zinc-600">Ctrl</kbd>
            <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-sans dark:border-zinc-600">S</kbd>
          </span>
        </div>
      </form>

      {/* §6: the audit line, read-only, at the bottom of edit mode. */}
      {loaded && (
        <p className="text-xs text-fade dark:text-zinc-400" data-audit-line="">
          {tl.rich("audit", {
            createdBy: loaded.createdByName ?? "—",
            createdAt: stamp(loaded.createdAt),
            updatedBy: loaded.updatedByName ?? "—",
            updatedAt: stamp(loaded.updatedAt),
            // Each name in its own span: a picture paints a real person's name over (capture-and-personal-data).
            name: (chunks) => <span data-audit-name="">{chunks}</span>,
          })}
        </p>
      )}

      {askDelete && loaded && (
        <div role="dialog" aria-modal="true" aria-labelledby="interaction-delete-title" data-log-delete="" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="rounded-lg bg-card p-6 shadow-xl dark:bg-zinc-900" {...screenBox("interactionSubjectLine")}>
            <h3 id="interaction-delete-title" className="text-base font-semibold text-ink dark:text-zinc-100">
              {tl("deleteTitle")}
            </h3>
            <p className="mt-2 text-sm text-ink dark:text-zinc-200">{tl("deleteBody", { person: loaded.personName, date: stamp(loaded.occurredAt) })}</p>
            <p className="mt-1 text-sm text-fade dark:text-zinc-400">{tl("deleteKeeps")}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setAskDelete(false)} disabled={deleting} className={buttonClass({ variant: "secondary", size: "lg" })}>
                {tl("deleteNo")}
              </button>
              <button type="button" onClick={() => void remove()} disabled={deleting} className={buttonClass({ variant: "danger", size: "lg" })}>
                {deleting ? tl("deleting") : tl("deleteYes")}
              </button>
            </div>
          </div>
        </div>
      )}
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

/** Focus a box that a press has just asked for — after React has drawn it. */
function focusSoon(id: string) {
  setTimeout(() => document.getElementById(id)?.focus(), 0);
}

const SECTION_LABEL = "text-sm font-medium text-ink dark:text-zinc-100";
const HINT = "text-xs text-fade dark:text-zinc-400";

/**
 * „Acte legate" (§4, §6, Figure 2): documents already in the archive, each a row with its icon and an „×", and
 * „Adaugă legătură" under them. A link, never a copy: nothing is uploaded here.   (Slice #38.86)
 */
function LinkedDocuments({ documents, onChange }: { documents: LinkedDocument[]; onChange: (next: LinkedDocument[]) => void }) {
  const tl = useTranslations("interactions.log");
  const nameOr = useNameOr();
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-1.5" data-log-documents="">
      <span className={SECTION_LABEL}>{tl("documents")}</span>
      {documents.length > 0 && (
        <ul className="flex flex-col gap-1" {...screenBox("interactionSubjectLine")}>
          {documents.map((d) => {
            const name = nameOr(d.title, "document");
            return (
              <li key={d.id} data-linked-document={d.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1 text-sm dark:border-zinc-700">
                <FileText aria-hidden="true" size={16} className="shrink-0 text-red-700 dark:text-red-400" />
                <span className="min-w-0 flex-1 truncate" title={name}>
                  {name}
                </span>
                <IconButton icon={X} label={tl("unlinkDocument", { name })} variant="bare" size="xs" onClick={() => onChange(documents.filter((x) => x.id !== d.id))} />
              </li>
            );
          })}
        </ul>
      )}
      {adding ? (
        <RecordSearch
          endpoint="/api/documents/search"
          inputId="interaction-document-search"
          label={tl("documentSearch")}
          placeholder={tl("documentSearchPlaceholder")}
          width="interactionSubjectLine"
          exclude={documents.map((d) => d.id)}
          toHit={(i) => ({ id: String(i.id), name: nameOr((i.title as string | null) ?? null, "document") })}
          onPick={(h) => {
            onChange(withDocument(documents, { id: h.id, title: h.name }));
            setAdding(false);
          }}
        />
      ) : (
        <div>
          <IconButton
            icon={Plus}
            label={tl("addLink")}
            showLabel
            variant="secondary"
            size="sm"
            onClick={() => {
              setAdding(true);
              focusSoon("interaction-document-search");
            }}
          />
        </div>
      )}
      <p className={HINT}>{tl("documentsHint")}</p>
    </div>
  );
}

/**
 * „Etichete" (§4, Figure 2): chips, „Adaugă etichetă" dashed; the suggestions are the tags used most recently on
 * interactions. Every chip is the same pale indigo — a tag stores no colour (38.86, Ask first #1).
 */
function TagChips({ tags, onChange }: { tags: string[]; onChange: (next: string[]) => void }) {
  const tl = useTranslations("interactions.log");
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const listId = useId();
  const prefix = text.trim();
  const suggestions = useQuery<string[]>({
    queryKey: ["interaction-tags", prefix],
    enabled: adding,
    queryFn: async () => {
      const res = await fetch(`/api/interactions/tags?${new URLSearchParams(prefix ? { prefix } : {}).toString()}`);
      if (!res.ok || res.redirected) throw new Error(`tags ${res.status}`);
      return ((await res.json()) as { tags: string[] }).tags;
    },
  });
  const offered = (suggestions.data ?? []).filter((s) => !tags.some((x) => x.toLocaleLowerCase("ro") === s.toLocaleLowerCase("ro"))).slice(0, 8);
  const add = (raw: string) => {
    onChange(withTag(tags, raw));
    setText("");
  };
  return (
    <div className="flex flex-col gap-1.5" data-log-tags="">
      <span className={SECTION_LABEL}>{tl("tags")}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span key={tag} data-tag-chip={tag} className="inline-flex items-center gap-0.5 rounded-full bg-[#eef2ff] py-0.5 pl-2.5 pr-1 text-sm text-[#3b5bdb] dark:bg-[#202745] dark:text-[#768ce6]">
            {tag}
            <IconButton icon={X} label={tl("removeTag", { tag })} variant="bare" size="xs" onClick={() => onChange(tags.filter((x) => x !== tag))} />
          </span>
        ))}
        {!adding && (
          <IconButton
            icon={Plus}
            label={tl("addTag")}
            showLabel
            variant="ghost"
            size="sm"
            pill
            className="border-dashed"
            onClick={() => {
              setAdding(true);
              focusSoon("interaction-tag-input");
            }}
          />
        )}
      </div>
      {adding && (
        <div className="relative inline-flex flex-col gap-1">
          <input
            id="interaction-tag-input"
            type="text"
            role="combobox"
            aria-label={tl("tagInput")}
            aria-expanded={offered.length > 0}
            aria-controls={listId}
            placeholder={tl("tagInputPlaceholder")}
            value={text}
            maxLength={60}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(text);
              } else if (e.key === "Escape") {
                setAdding(false);
                setText("");
              }
            }}
            onBlur={(e) => {
              if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node | null)) setAdding(false);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-ink placeholder:text-fade dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            {...screenBox("interactionTag")}
          />
          {offered.length > 0 && (
            <ul id={listId} role="listbox" aria-label={tl("tagSuggestions")} className="flex flex-wrap gap-1.5" data-tag-suggestions="">
              {offered.map((s) => (
                <li key={s} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => {
                      add(s);
                      focusSoon("interaction-tag-input");
                    }}
                    className={buttonClass({ variant: "ghost", size: "xs", pill: true })}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className={HINT}>{tl("tagsHint")}</p>
    </div>
  );
}

/** „Proprietate legată" (§6): one optional property; the grid does not show it (38.86, Ask first #2). */
function RelatedProperty({
  property,
  onChange,
}: {
  property: { id: string; label: string | null } | null;
  onChange: (next: { id: string; label: string | null } | null) => void;
}) {
  const tl = useTranslations("interactions.log");
  const nameOr = useNameOr();
  return (
    <div className="flex flex-col gap-1.5" data-log-property="">
      <span className={SECTION_LABEL}>{tl("property")}</span>
      {property ? (
        <div className="flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1 text-sm dark:border-zinc-700" data-related-property={property.id} {...screenBox("interactionPerson")}>
          <MapIcon aria-hidden="true" size={16} className="shrink-0 text-slate-600 dark:text-zinc-400" />
          <span className="min-w-0 flex-1 truncate">{nameOr(property.label, "property")}</span>
          <IconButton icon={X} label={tl("unlinkProperty")} variant="bare" size="xs" onClick={() => onChange(null)} />
        </div>
      ) : (
        <RecordSearch
          endpoint="/api/properties/search"
          label={tl("propertySearch")}
          placeholder={tl("propertySearchPlaceholder")}
          width="interactionPerson"
          toHit={(i) => ({ id: String(i.id), name: nameOr((i.label as string | null) ?? null, "property") })}
          onPick={(h) => onChange({ id: h.id, label: h.name })}
        />
      )}
      <p className={HINT}>{tl("propertyHint")}</p>
    </div>
  );
}
