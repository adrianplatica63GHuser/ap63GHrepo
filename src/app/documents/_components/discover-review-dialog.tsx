"use client";

/**
 * The review step between AI Discovery and a document type's custom form.
 *                                                          (Slice #26.11)
 *
 * Discovery reads a document and reports the label -> value pairs it found.
 * This dialog turns that report into a decision: which of those labels become
 * fields on THIS DOCUMENT TYPE's form, what each one is called, and what kind
 * of value it holds. On "save", the accepted rows are appended to the type's
 * `template_fields` and every subsequent import of that type fills them
 * automatically — the type is not touched until then.
 *
 * WHY A REVIEW STEP AT ALL
 * ------------------------
 * Discovery is a read of ONE document by a model that was given no schema, so
 * its output is a good first draft and nothing more: it will report the page
 * header as a field, split one value across two labels, and read a date as a
 * number. Writing that straight onto the type would put those mistakes into
 * the extraction prompt for every future document of that type, where nobody
 * would ever see them again. The evidence column is the point of the screen —
 * each row is shown beside the value that produced it, so the decision is made
 * against what was actually on the page rather than against a field name.
 *
 * WHAT IT CANNOT DO, ON PURPOSE
 * -----------------------------
 * It cannot remove or edit a field the type already has. Those are listed,
 * greyed, as already captured so the user can see they are kept — a discovery
 * run on a type that already has a form is a normal thing to do (it is how you
 * find what is still unrecognised) and it must be additive. The same block
 * holds the rows the system captures some OTHER way: the four generic columns
 * every document has, and the type's person roles, which the import links to
 * real Person records rather than to free text.
 *
 * THE TYPE ITSELF CAN BE NEW                                    (Slice #27.04)
 * --------------------------
 * Everything above assumes the document already sits on the type that should
 * gain the form. Often it does not: `ensureDocType` puts a document whose scan
 * produced no usable label on the fallback type (the UNCLASSIFIED row —
 * `catchAllType`), and
 * saving this review onto THAT type writes one document's fields onto the
 * catch-all that every unclassified document in the archive shares. Since
 * #27.03 an administrator can remove a field again from Reference Data, so that
 * is no longer literally permanent — but the field's KEY is: every document of
 * the type that has since stored a value under it keeps that value in
 * `custom_fields`, reachable from no screen once the field is gone.
 *
 * So the review can also say "this is a new document type", pre-filled with
 * `documentLabel` — the model's own short Romanian name for what it read,
 * which the discover response has always carried and this client used to throw
 * away. Accepting then does three writes, IN THIS ORDER:
 *
 *   1. POST  /api/admin/value-lists/document-types    — create the type
 *   2. PATCH /api/documents/[id]                      — re-type this document,
 *                                                       clearing custom_fields
 *   3. PUT   /api/document-types/[id]/template-fields  — the accepted fields
 *
 * ⚠️ **That order is a safety property, not a preference.** Fields last means a
 * failure at any step leaves them written nowhere — and never on the type the
 * document is being rescued FROM, which is the one outcome no screen can undo.
 * Each step is resumable rather than repeatable: `createdType` and `retyped`
 * make a second press of Save continue where the first stopped instead of
 * creating a second type.
 *
 * ⚠️ **Discover mode itself still persists nothing.** These writes happen on
 * the user's acceptance, in the same click that saves the fields — which is
 * what keeps the Descoperire AI button safe to re-run.
 *
 * ⚠️ **`origin` is deliberately NOT sent** — see `createType` below.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/lib/ui/button-styles";
import type { DiscoverConfidence } from "@/lib/documents/discover-log";
import {
  buildFieldHint,
  capturedFieldNames,
  formValueForField,
  keysForReviewRows,
  looksLikeSentenceFragment,
  MAX_KEY_LENGTH,
  MAX_TEMPLATE_FIELDS,
  nameTooLongForKey,
  proposeTemplateFields,
  reviewRowIssue,
  reviewRowIssues,
  rowName,
  seedReviewRows,
  type DiscoveredFieldRow,
} from "@/lib/documents/discover-to-template";
import {
  parseTemplateFields,
  type DocumentTemplateField,
  type DocumentTemplateFieldType,
} from "@/lib/documents/template-fields";
import { sameDocumentTypeName } from "@/lib/documents/document-type-match";

const FIELD_TYPES: DocumentTemplateFieldType[] = ["text", "textarea", "date", "number"];

/**
 * The template a BRAND-NEW type has.                            (Slice #27.04)
 *
 * A module constant rather than a `[]` literal at each use site: it is read by
 * `useMemo`/`seedReviewRows` inputs, and a fresh array identity on every render
 * is the thing those memos exist to avoid.
 */
const NO_FIELDS: readonly DocumentTemplateField[] = [];

/**
 * Two type names that a business user would read as the same name.
 *                                                (Slice #27.04, #29.06)
 *
 * ⚠️ **MOVED, not deleted.** It was `sameTypeName` here, three lines of
 * `normaliseKeyForComparison`, and it was the only one of the app's three
 * name-matching rules that was right. Slice #29.06 hoisted it into
 * `src/lib/documents/document-type-match.ts` so the import wizard and the
 * server-side resolver use the SAME rule rather than the two weaker ones they
 * had — `trim()`+`toLowerCase()` with no diacritic fold in one, a byte-for-byte
 * SQL `eq` in the other. What it does is unchanged, including the empty-string
 * guard; where it lives is what changed, and the alias is kept so this file's
 * two call sites still read as they did.
 *
 * Used only to REFUSE creating a duplicate, and deliberately no cleverer than
 * that: merging or de-duplicating near-identical types is a different problem
 * with a different answer (the archive has three deliberate alternate wordings
 * — `AUTORIZATIE` / `AUTORIZATIE_ALT` and two more — that a fuzzy test would
 * wrongly collapse; those differ by WORDING, which survives this).
 */
const sameTypeName = sameDocumentTypeName;

/**
 * What the dialog shows and edits — a proposal plus the user's decisions.
 *
 * The shape and its seeding rule live in `discover-to-template.ts` (#29.10) so
 * the starting position of this screen is a pure function a test can run,
 * rather than a closure inside a client component. `rowId` is the row's index
 * and NOT the field key: two discovered labels can legitimately resolve to one
 * already-captured field ("Nr." and "Număr" both mean the document's number),
 * and since #29.10 the key of a new row is not fixed at all — it follows the
 * name as the user types it (see `keysByRowId`).
 */
type Row = DiscoveredFieldRow;

export type DiscoverReviewPair = {
  name:       string;
  value:      string;
  confidence: DiscoverConfidence;
};

/** A document type this dialog created. `key` is the server's, never guessed. */
export type CreatedDocumentType = { id: string; key: string; name: string };

/**
 * The three ways the new-type path can leave the server.        (Slice #27.04)
 *
 * `created` — the row exists; this document is still on its old type.
 * `moved`   — the row exists AND this document has been re-typed onto it.
 * `moveUnresolved` — the row exists; whether the document reached it could not
 *   be established. The caller must NOT write either type into its form: the
 *   only honest next step is to reload the document and look.
 * `movedFieldsUnknown` — the row exists and this document is on it, but whether
 *   the accepted fields were saved onto it could not be established.
 * `unresolved` — a create whose outcome could not be established. Nothing may
 *   be assumed from it except that a row with this name MIGHT exist.
 */
// One member per status, rather than one member with three of them: a union
// discriminant does not narrow away through a chain of `!==` tests, and the
// caller reads `name` on the one member that has it.
export type NewTypeProgress =
  | { status: "created";            type: CreatedDocumentType }
  | { status: "moved";              type: CreatedDocumentType }
  | { status: "moveUnresolved";     type: CreatedDocumentType }
  | { status: "movedFieldsUnknown"; type: CreatedDocumentType }
  | { status: "unresolved";         name: string };

type Props = {
  /** The pairs discovery reported, in the model's own reading order. */
  pairs:        readonly DiscoverReviewPair[];
  /** The document that was read — the one that gets re-typed. (#27.04) */
  documentId:   string;
  /**
   * The model's own short Romanian name for what it read, or null when it
   * offered none. Seeds the new-type name box; the user may edit it. (#27.04)
   */
  documentLabel: string | null;
  /** The type these fields would be saved onto. */
  typeId:       string;
  typeName:     string;
  /**
   * Every type name already in the list, so an exact duplicate is refused
   * before it is created rather than discovered later. (#27.04)
   */
  existingTypeNames: readonly string[];
  /** The type's current template — kept whole, shown as already captured. */
  existing:     readonly DocumentTemplateField[];
  /** The type's person roles — captured as linked Persons, never as text. */
  partyRoleNames: readonly string[];
  /** Pages discovery could not send, and whether it ran out of output budget. */
  skippedPages: number;
  truncated:    boolean;
  /**
   * Called after a successful save, with how many fields the SERVER added and
   * the values discovery read for them. The caller writes those into the form
   * it is standing on — see its own comment for why that is not optional.
   */
  onSaved:      (addedFieldCount: number, values: Record<string, string>) => void;
  /**
   * How far the new-type path got on the server.                (Slice #27.04)
   *
   * ⚠️ **Reported after EACH write, not once at the end.** Each is committed
   * the moment it returns and the write after it can still fail. A caller told
   * only about a complete success would leave a created type missing from its
   * cached type list — the list its own error message tells the user to go and
   * pick the type from — and, worse, would keep rendering the OLD type for a
   * document the server has already moved, so the next ordinary Save would
   * PATCH it straight back and undo the rescue.
   *
   * `unresolved` carries no type because there is none to carry: the create
   * neither certainly happened nor certainly did not. It exists so the warning
   * outlives this dialog, which is about to be closed on top of it.
   *
   * ⚠️ **The caller must not apply any of it to a live form field while this
   * dialog is mounted** — see the mount site in document-form.tsx, which defers
   * it to close. Changing the selected type there changes this component's
   * React `key`, which unmounts it mid-save.
   */
  onNewTypeProgress: (progress: NewTypeProgress) => void;
  /**
   * Called when the stored template turned out to have moved on under us, so
   * the caller can refresh its own copy. This dialog does NOT depend on that
   * refresh: it reseeds from the fields the 409 itself returned.
   */
  onTypesChanged: () => void;
  onClose:      () => void;
};

export function DiscoverReviewDialog({
  pairs,
  documentId,
  documentLabel,
  typeId,
  typeName,
  existingTypeNames,
  existing,
  partyRoleNames,
  skippedPages,
  truncated,
  onSaved,
  onNewTypeProgress,
  onTypesChanged,
  onClose,
}: Props) {
  const t = useTranslations("document.discoverReview");

  // Computed once from the props this dialog was opened with. It must NOT
  // recompute into `rows` while the user is editing: `rows` seeds from it, and
  // a reseed would throw away every tick and rename made so far. (The one
  // deliberate reseed is the 409 path in handleSave.)
  /**
   * ⚠️ **The type's person roles, FROZEN at mount — same reason as `baseline`
   * below, and a review round found this one live.** The prop comes from the
   * same react-query cache with `refetchOnWindowFocus`: a role added while the
   * dialog is open left `alreadyInForm` frozen at what was proposed, while
   * `capturedFieldNames` gained the new role and silently re-minted an
   * untouched row's key from `notar` to `notar_2`. Inside the
   * `fieldsUnresolved` window that changes the retry's payload, which is
   * exactly what that freeze exists to prevent.
   */
  const [roles] = useState<readonly string[]>(partyRoleNames);

  const proposals = useMemo(
    () => proposeTemplateFields(pairs, existing, roles),
    [pairs, existing, roles],
  );

  /**
   * The template as it stood when this dialog opened, frozen.
   *
   * It must NOT be re-read from the `existing` prop at save time. That prop
   * comes from a react-query cache with `refetchOnWindowFocus`, so alt-tabbing
   * to check the scan can refresh it mid-review — and then `knownKeys` would
   * describe a template the reviewer never saw, the route's 409 would pass
   * exactly when it should fire, and the field that arrived in between would be
   * silently swallowed by the merge. Freezing it is what makes the concurrency
   * check a check on what was ACTUALLY reviewed.
   *
   * STATE, not a ref, for two reasons that are really one. The footer reads its
   * length during render (the field-count ceiling), and `react-hooks/refs`
   * rightly bans that — a ref's value is not something a render may depend on.
   * And the one thing that does change it, the 409 reseed, has to repaint the
   * counts it feeds. `useState(existing)` captures the prop exactly once, which
   * is the freezing this needs; later prop changes do not touch it.
   */
  const [baseline, setBaseline] = useState<readonly DocumentTemplateField[]>(existing);

  const [rows, setRows] = useState<Row[]>(() => seedReviewRows(proposals));
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // ── Slice #27.04: "this is a new document type" ──────────────────────────
  //
  // Off by default. Ticking it does not create anything — it changes what Save
  // will do, and nothing is written until Save is pressed.
  const [createNew,   setCreateNew]   = useState(false);
  const [newTypeName, setNewTypeName] = useState((documentLabel ?? "").trim());
  /**
   * The type this dialog CREATED, once it exists, and whether the document has
   * been moved onto it.
   *
   * ⚠️ **These make Save resumable rather than repeatable.** Three writes stand
   * behind one button, and the user's answer to a failure at write 2 or 3 is to
   * press it again. Without these, that second press would create a second type
   * named the same thing, leaving a stray empty one in Reference Data that
   * nothing in the app would explain. Both are STATE: each is read during
   * render as well as inside the handler — the name box locks once the type is
   * real, and the help text under it branches on whether the document has moved.
   */
  const [createdType, setCreatedType] = useState<CreatedDocumentType | null>(null);
  // State, not a ref: the help text under the name box says whether the
  // document has been moved, and it was WRONG while this was a ref that render
  // could not read. Set only inside the save handler.
  const [retyped, setRetyped] = useState(false);
  /**
   * A write whose outcome could not be established, even after asking.
   *
   * ⚠️ **The one state where retrying is the dangerous answer, and it is
   * therefore terminal.** `lookup_document_type` has no unique constraint on
   * `name` (only on `key`, which is generated), so a second POST after a create
   * that actually succeeded leaves two identically named types, one of them
   * permanently empty. A dropped connection after the row was inserted, or a
   * 201 whose body will not parse, are both this.
   *
   * ⚠️ **It locks the new-type CHECKBOX as well as Save, and a review round is
   * why.** Left tickable, unticking it cleared the error and re-enabled a Save
   * that would then write the fields onto the type this document is being
   * rescued FROM — the shared catch-all — which is the single outcome the whole
   * slice exists to prevent. From here the only exit is Close, and the caller
   * repeats the warning on the page.
   */
  const [unresolved, setUnresolved] = useState(false);
  /**
   * A field write whose outcome could not be established.            (#29.10)
   *
   * ⚠️ **This LOCKS THE ROWS, and it has to, because the key now follows the
   * name.** `errorFieldsUnknown` tells the user to press Save again, and the
   * recovery depends on the retry sending the same keys: the 409 branch below
   * finishes the save when every key it asked for is already stored. Since
   * #29.10 a rename between the two presses changes the key — and the banner is
   * on screen precisely when the fragment warning has just told the user to
   * rename something. The retry would then ask for `suprafata` where the server
   * stored `suprafata_de`, the `every` test would fail, the rows would reseed
   * as already-captured, `onSaved` would never fire, and the discovered values
   * would be unrecoverable. Freezing the rows makes the retry idempotent, which
   * is what the whole recovery was written against.
   *
   * Unlike `unresolved` this does NOT disable Save — pressing it again IS the
   * remedy. It only stops the rows moving underneath it.
   */
  const [fieldsUnresolved, setFieldsUnresolved] = useState(false);
  /**
   * The template of the type being written to when that type is NEW: empty,
   * because it was just created. Separate from `baseline` so toggling the box
   * off restores the stored type's frozen template rather than an emptied copy
   * of it — and so the 409 path can reseed whichever one is live.
   */
  const [newTypeBaseline, setNewTypeBaseline] =
    useState<readonly DocumentTemplateField[]>(NO_FIELDS);
  const activeBaseline = createNew ? newTypeBaseline : baseline;
  const setActiveBaseline = (fields: readonly DocumentTemplateField[]) =>
    createNew ? setNewTypeBaseline(fields) : setBaseline(fields);

  /**
   * Re-apply those decisions over a fresh seed. A row that is already captured
   * takes the seed regardless — it cannot be saved, so there is no decision to
   * restore.
   */
  const applyDecisions = (seeded: Row[]): Row[] =>
    seeded.map((s) => {
      const decided = decisionsRef.current.get(s.rowId);
      if (!decided || s.alreadyInForm) return s;
      return { ...s, ...decided };
    });

  const trimmedNewName = newTypeName.trim();
  const duplicateName =
    trimmedNewName.length > 0 &&
    createdType === null &&
    existingTypeNames.some((name) => sameTypeName(name, trimmedNewName));
  // The type the fields will land on, named. While the box is empty the old
  // type is still the honest answer, and Save is blocked anyway.
  const targetTypeName =
    createNew && (createdType?.name ?? trimmedNewName)
      ? (createdType?.name ?? trimmedNewName)
      : typeName;

  /**
   * Every decision the USER has made, kept apart from the rows themselves.
   *
   * ⚠️ **Not derived from the previous rows, and a review round is why.** Rows
   * are reseeded twice — by the 409 recovery and by the new-type toggle — and a
   * carry-across that reads the previous rows cannot tell "the user left this
   * ticked" from "the seed ticked it". Toggling the new-type box off and on
   * again then walked over explicit choices with fresh defaults: a field the
   * user had deliberately UNTICKED came back ticked, and a rename was lost —
   * and a ticked field is one only an administrator can take back off the type
   * again, from another screen, after the fact.
   *
   * ⚠️ **Keyed on `rowId`, NOT on the printed label**, and a second review
   * round is why. A document that prints "Suprafață" twice yields two rows —
   * `proposeTemplateFields` uniquifies the KEY (`suprafata`, `suprafata_2`) and
   * leaves both labels identical, deliberately — so a label-keyed map gives
   * them one shared decision and an untick on the second silently removes the
   * first. `rowId` is the row's index in the proposal list, and that list is
   * built from `pairs` alone: same length, same order, whichever template it is
   * proposed against. It is the only identity here that survives a reseed AND
   * distinguishes two rows that read the same.
   */
  const decisionsRef = useRef(
    new Map<string, { include: boolean; label: string; type: DocumentTemplateFieldType }>(),
  );

  /**
   * Ticking the box re-proposes against an EMPTY template.
   *
   * ⚠️ **Not a `useEffect`.** Reseeding rows from a prop is the thing this
   * component's comments warn about twice; reseeding them from an explicit user
   * action is a different act, and writing it in the handler is what keeps the
   * two distinguishable.
   *
   * ⚠️ **The reseed is the point, not a side effect.** A document that landed on
   * the WRONG type — not merely a formless one — has rows greyed as "already
   * captured" by a template that is about to stop applying to it. Left alone
   * they could never be moved to the new type, which is half of what this slice
   * is for. The party roles stay captured-elsewhere regardless: a brand-new type
   * has no roles configured yet, but offering "Vânzător" as a free-text field is
   * precisely what `src/lib/import/id-card.ts` exists to refuse.
   */
  const toggleCreateNew = (checked: boolean) => {
    setCreateNew(checked);
    setError(null);
    const base = checked ? newTypeBaseline : baseline;
    const reproposed = proposeTemplateFields(pairs, base, roles);
    setRows(applyDecisions(seedReviewRows(reproposed)));
  };

  const closeRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Escape closes — but never mid-save, where the dialog is the only thing
  // telling the user a write is in flight.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  /**
   * Keep Tab inside the panel.
   *
   * `aria-modal="true"` is a promise, and nothing else in this app keeps it —
   * the backdrop stops the mouse and nothing stops the keyboard. Here it is
   * not merely an accessibility nicety: the document form's TYPE dropdown sits
   * directly under this overlay, and changing it while the review is open
   * changes the dialog's React `key`, which unmounts it and takes every tick
   * and rename with it. Trapping Tab is what makes that unreachable.
   *
   * Deliberately narrow: it moves focus, it does not manage anything else, and
   * it never fights the browser on Escape (handled above) or on typing.
   */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      // ⚠️ Slice #27.04: PREVENT, don't release. Every control in this panel is
      // disabled while a save is in flight, so this list is empty for exactly
      // as long as the write lasts — and returning here let Tab walk out to the
      // page beneath, where the type dropdown sits. Changing that unmounts this
      // dialog mid-save, and #27.04 made the save three sequential writes, so
      // the window is wide and what it discards is the record of which of them
      // already landed. Nothing to move focus TO is a reason to swallow Tab,
      // not a reason to hand it to the page under the overlay.
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      // Focus outside the panel entirely (it was never moved in, or something
      // stole it) — pull it back rather than letting Tab walk the page.
      if (!active || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const newRows     = rows.filter((r) => !r.alreadyInForm);
  const presentRows = rows.filter((r) => r.alreadyInForm);
  const selected    = newRows.filter((r) => r.include);
  // Counted against the SAME ceiling the route enforces, so the user is stopped
  // before the click rather than rejected after it — and never by an English
  // sentence built on the server.
  const storedCount = activeBaseline.length;
  const wouldTotal  = storedCount + selected.length;
  const typeFull    = storedCount >= MAX_TEMPLATE_FIELDS;
  const overLimit   = wouldTotal > MAX_TEMPLATE_FIELDS;
  // Every row discovery found is already captured — the normal outcome of
  // re-running discovery to see what is still unrecognised. Nothing to save, so
  // the screen offers Close rather than a Save that can never fire. A type
  // already at the ceiling is the same dead end reached from the other side.
  const nothingToAdd = newRows.length === 0 || typeFull;
  // Slice #27.04: a new type with no name is the fourth way to reach a disabled
  // Save, and the only one the user can fix by typing. Answered in the footer
  // like the other three rather than left as a dead button.
  const newTypeReady = !createNew || (trimmedNewName.length > 0 && !duplicateName);
  /**
   * Two labels can resolve to one captured field, so count — and LIST — the
   * FIELDS.
   *
   * ⚠️ The de-duplication is not tidiness: a final review round found the count
   * taken over distinct keys while the chips below were rendered one per ROW,
   * so a document printing „Nr." twice showed „Un câmp este deja preluat"
   * above three chips, two of them the identical word. Since #29.10 that is the
   * normal case, not a corner: a repeat of a generic column or a person role
   * stays already-captured on every occurrence, because those mechanisms have
   * exactly one slot each.
   */
  const presentFields = presentRows.filter(
    (r, i) => presentRows.findIndex((o) => o.key === r.key) === i,
  );
  const presentCount = presentFields.length;

  /**
   * The key each ticked row would be stored under, and the two ways a ticked
   * row can be un-saveable.                                          (#29.10)
   *
   * All three are pure functions in `discover-to-template.ts` —
   * `capturedFieldNames`, `keysForReviewRows`, `reviewRowIssue` — so a rename,
   * a rename onto a stored field, and a document that prints one caption twice
   * are sequences a test can run without rendering React. Read their comments
   * for the rules and for the three review rounds that shaped them.
   */
  /**
   * Everything already spoken for on the type being written to.
   *
   * ⚠️ **From `capturedFieldNames`, the SAME index `proposeTemplateFields`
   * builds** — the stored fields by key and by label slug, the four generic
   * columns and their Romanian aliases, and the type's person roles. A review
   * round found this hand-assembled here from the stored keys plus whatever
   * discovery happened to surface as captured, which is a different and smaller
   * set: renaming a row to „Notar" or „Data" went straight through it.
   */
  const captured = useMemo(
    () => capturedFieldNames(activeBaseline, roles),
    [activeBaseline, roles],
  );

  const keysByRowId = useMemo(() => keysForReviewRows(rows, captured), [rows, captured]);

  /**
   * The key to print under a row — only where there IS one.
   *
   * ⚠️ Blank for an unticked row, and a review round is why. Falling back to
   * the bare slug there showed a key belonging to a DIFFERENT field: on a type
   * already holding `suprafata`, a second „Suprafață" row displayed
   * `suprafata` until it was ticked, and `suprafata_2` afterwards. The key
   * becomes real when the row is accepted, and that is when it is shown.
   */
  const keyForRow = (row: Row): string =>
    row.alreadyInForm ? row.key : (keysByRowId.get(row.rowId) ?? "");

  const { unnamed: unnamedRow, duplicateOfCaptured: duplicateRow } = reviewRowIssues(
    rows,
    captured,
  );

  // Slice #29.10: the row controls freeze while a write is in flight AND once
  // a field write's outcome is unknown — see `fieldsUnresolved`.
  const rowsLocked = saving || fieldsUnresolved;
  // ⚠️ `!unresolved` sits OUTSIDE `newTypeReady`, not inside it. Inside, it was
  // reachable only through `createNew` — and unticking that box cleared the way
  // back to a Save that would write the fields onto the shared catch-all type.
  const canSave =
    selected.length > 0 &&
    !saving &&
    !overLimit &&
    !typeFull &&
    newTypeReady &&
    !unresolved &&
    !unnamedRow &&
    !duplicateRow;

  const patchRow = (rowId: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
    // Slice #27.04: remembered so a later reseed cannot walk over it. Recorded
    // from the CURRENT render's rows, in the event handler — not inside the
    // updater, which React may run twice.
    const row = rows.find((r) => r.rowId === rowId);
    if (row) {
      const next = { ...row, ...patch };
      decisionsRef.current.set(rowId, {
        include: next.include,
        label:   next.label,
        type:    next.type,
      });
    }
  };

  /**
   * Write 1 of 3 — create the type.                             (Slice #27.04)
   *
   * ⚠️ **No `origin` is sent, so `createValue` supplies MANUAL** (see its own
   * comment in src/lib/admin/value-lists/queries.ts). The column is write-once
   * and the value-lists PUT strips it, so this cannot be corrected from any
   * screen — which is why it is the value that makes no new claim rather than
   * the flattering one. Slice #29.06 named the rule this is the exception-
   * proving case of: **origin says who CHOSE the name.** IMPORT means a machine
   * chose it with nobody looking — `resolveClassifiedDocumentType` is its only
   * writer, for the scan and for the whole-document read alike — and what
   * happened HERE is that a person read a machine's suggestion, edited the name
   * and pressed a button.
   *
   * It also only shows for a WINDOW: the type gains a form seconds
   * later and reads "Are formular" from then on, whichever origin it holds. The
   * one moment origin is visible is when the field save failed — and there,
   * "Adăugat manual" on a formless type is the truth.
   *
   * ⚠️ **Its three outcomes are not two.** "Created", "certainly not created"
   * and "cannot tell" are different answers, and collapsing the last two is how
   * a retry produces a duplicate — see `createUnknown`. A response that ARRIVED
   * and was a failure is safe to retry; a request that never came back, or a
   * 201 whose body will not parse, is not.
   */
  type CreateOutcome =
    | { status: "created"; type: CreatedDocumentType }
    | { status: "failed" }
    | { status: "unknown" };

  /**
   * Turn "I do not know whether the type was created" into an answer, by
   * asking.                                                     (Slice #27.04)
   *
   * ⚠️ **Ask, do not assume — and do not retry blind.** Both unknown outcomes
   * (a rejected `fetch`, a 201 whose body will not parse) are recoverable by
   * one GET, and a duplicate name is exactly what this dialog refuses before
   * creating, so a single match is almost certainly the row we just wrote. Two
   * matches means the list was stale when we checked and something else shares
   * the name: that stays unknown rather than picking one, because picking wrong
   * writes the fields onto somebody else's type.
   *
   * ⚠️ **"Almost certainly" is doing real work in that sentence, so the match
   * must also have an EMPTY template.** The pre-flight refusal reads the
   * client's type list, which react-query holds for five minutes — so a type
   * another session created inside that window is invisible to it, and a
   * single match could be that type rather than ours. A type this dialog just
   * created has no fields yet; one that already has a form is somebody's
   * finished work, and writing this document's fields onto it is the single
   * outcome the whole slice exists to prevent. Ambiguous rather than adopted.
   */
  const resolveCreate = async (name: string): Promise<CreateOutcome> => {
    let res: Response;
    try {
      res = await fetch("/api/admin/value-lists/document-types");
    } catch {
      return { status: "unknown" };
    }
    if (res.redirected || !res.ok) return { status: "unknown" };
    const body = (await res.json().catch(() => ({}))) as { items?: unknown };
    if (!Array.isArray(body.items)) return { status: "unknown" };
    const matches = (
      body.items as { id?: unknown; key?: unknown; name?: unknown; templateFields?: unknown }[]
    ).filter((row) => typeof row.name === "string" && sameTypeName(row.name, name));
    // Nothing with this name exists, so the POST certainly did not land — the
    // safe answer, and the only one that lets the user simply press Save again.
    // ⚠️ The message is set HERE. `handleSave` clears the banner before every
    // attempt and answers a `failed` with a bare `return`, so a resolver that
    // stayed silent turned a failed press into no visible change at all — and
    // wiped the previous attempt's red banner on the way, which reads as
    // success.
    if (matches.length === 0) {
      setError(t("errorCreateType"));
      return { status: "failed" };
    }
    const only = matches[0];
    if (
      matches.length > 1 ||
      typeof only.id !== "string" ||
      only.id.length === 0 ||
      parseTemplateFields(only.templateFields).length > 0
    ) {
      return { status: "unknown" };
    }
    return {
      status: "created",
      type: {
        id:   only.id,
        key:  typeof only.key  === "string" ? only.key  : "",
        name: typeof only.name === "string" ? only.name : name,
      },
    };
  };

  const createType = async (name: string): Promise<CreateOutcome> => {
    let res: Response;
    try {
      res = await fetch("/api/admin/value-lists/document-types", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name }),
      });
    } catch {
      // The browser's own "Failed to fetch": a dropped connection, a gateway
      // timeout, a backgrounded tab. The INSERT may well have committed — so
      // go and look rather than guessing either way.
      return resolveCreate(name);
    }
    if (res.redirected) {
      setError(t("errorSession"));
      return { status: "failed" };
    }
    if (!res.ok) {
      setError(t("errorCreateType"));
      return { status: "failed" };
    }
    const row = (await res.json().catch(() => ({}))) as {
      id?: unknown; key?: unknown; name?: unknown;
    };
    if (typeof row.id !== "string" || row.id.length === 0) {
      // A 201 we cannot read is a row that exists and an id we do not have —
      // recoverable from the list, which is keyed by the name we just sent.
      return resolveCreate(name);
    }
    return {
      status: "created",
      type: {
        id:   row.id,
        key:  typeof row.key  === "string" ? row.key  : "",
        name: typeof row.name === "string" ? row.name : name,
      },
    };
  };

  /**
   * Write 2 of 3 — move this document onto the new type.        (Slice #27.04)
   *
   * ⚠️ **`customFields: {}` is sent every time, not only when the column holds
   * something.** `custom_fields` is keyed by the OLD type's template, and a key
   * carried across is persisted, snapshotted into every later
   * `document_version`, and visible on no screen and editable from none — the
   * reason `runAiInterpret` states at length about its own re-type. In practice
   * the document being rescued is formless and the column is already empty, so
   * this usually writes nothing; the case it protects is the one where it is
   * not, and that case cannot be repaired afterwards.
   *
   * Deliberately a NARROW patch: two keys, nothing else. The form behind this
   * dialog may hold unsaved edits, and they are the user's to save.
   *
   * ⚠️ **Its three outcomes are not two either, and for a worse reason than
   * write 1's.** A PATCH that commits and whose answer is lost, reported as
   * "not moved", sends the caller a document it believes is still on the old
   * type — and the next ordinary Save writes that old `documentTypeId` back,
   * undoing a re-type the server had already made and taking the cleared
   * `custom_fields` with it. So a lost answer is resolved by READING the
   * document back, not by assuming the safer-sounding half.
   */
  type RetypeOutcome = "moved" | "failed" | "unknown";

  const resolveRetype = async (newTypeId: string): Promise<RetypeOutcome> => {
    let res: Response;
    try {
      res = await fetch(`/api/documents/${encodeURIComponent(documentId)}`);
    } catch {
      return "unknown";
    }
    if (res.redirected || !res.ok) return "unknown";
    const body = (await res.json().catch(() => ({}))) as { documentTypeId?: unknown };
    // `documentTypeId` is NOT NULL on the row, so a response that does not
    // carry it as a string is a response shape we do not understand — which is
    // "I could not tell", not "it did not happen".
    if (typeof body.documentTypeId !== "string") return "unknown";
    if (body.documentTypeId === newTypeId) return "moved";
    // Same rule as `resolveCreate`: a silent `failed` is a press that changes
    // nothing on screen and clears the banner explaining the last one.
    setError(t("errorRetype"));
    return "failed";
  };

  const retypeDocument = async (newTypeId: string): Promise<RetypeOutcome> => {
    let res: Response;
    try {
      res = await fetch(`/api/documents/${encodeURIComponent(documentId)}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ documentTypeId: newTypeId, customFields: {} }),
      });
    } catch {
      return resolveRetype(newTypeId);
    }
    if (res.redirected) {
      setError(t("errorSession"));
      return "failed";
    }
    if (!res.ok) {
      setError(t("errorRetype"));
      return "failed";
    }
    return "moved";
  };

  /**
   * Write 3 of 3, when its answer is lost.                       (Slice #27.04)
   *
   * ⚠️ **The third write needed this as much as the first two, and not having
   * it made the page lie.** A rejected `fetch` on the PUT left the run
   * reporting "the form was NOT saved and the fields that were read are lost"
   * over a template the server had in fact written — and the obvious retry
   * answered 409 `template_changed`, reseeded every row as already-captured,
   * and left a dialog with nothing to add beside a red banner. The stored
   * template is readable from the list, and the keys we asked for are the
   * question, so ask it.
   */
  const resolveFieldsSaved = async (
    typeIdToCheck: string,
    expected: readonly string[],
  ): Promise<{ status: "saved"; fields: DocumentTemplateField[] } | "failed" | "unknown"> => {
    let res: Response;
    try {
      res = await fetch("/api/admin/value-lists/document-types");
    } catch {
      return "unknown";
    }
    if (res.redirected || !res.ok) return "unknown";
    const body = (await res.json().catch(() => ({}))) as { items?: unknown };
    if (!Array.isArray(body.items)) return "unknown";
    const row = (body.items as { id?: unknown; templateFields?: unknown }[]).find(
      (item) => item.id === typeIdToCheck,
    );
    if (!row) return "unknown";
    const stored = parseTemplateFields(row.templateFields);
    const storedKeys = new Set(stored.map((f) => f.key));
    if (expected.every((key) => storedKeys.has(key))) return { status: "saved", fields: stored };
    // Not one of them landed: the write certainly did not commit, so a retry is
    // safe. A PARTIAL match is neither, and guessing either way is how a
    // half-written template gets reported as finished.
    if (expected.every((key) => !storedKeys.has(key))) return "failed";
    return "unknown";
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    /**
     * ⚠️ **Cleared HERE, at the top of every attempt, and a review round is
     * why.** `fieldsUnresolved` freezes the rows so the retry the banner asks
     * for sends the same keys — and it was never cleared, so every outcome that
     * PROVES the write did not land (a 409 that reseeds the list and says
     * "check it and press Save again", a 404, `errorTooMany`'s "untick a few and
     * try again") left the user reading an instruction beside a table with every
     * control dead. Clearing it here keeps the freeze over exactly the window it
     * is for: from an unknown outcome until the next press. The payload below is
     * built synchronously from the rows as they were frozen, and `saving` holds
     * the controls for the rest of the write.
     */
    setFieldsUnresolved(false);
    try {
      // ── Slice #27.04: writes 1 and 2, when the user asked for a new type ──
      // Each is skipped if a previous press already completed it, so a retry
      // after a failure resumes instead of duplicating.
      let target = createdType;
      if (createNew) {
        if (!target) {
          if (trimmedNewName.length === 0) {
            setError(t("newTypeNameRequired"));
            return;
          }
          if (duplicateName) {
            setError(t("newTypeNameTaken"));
            return;
          }
          const outcome = await createType(trimmedNewName);
          if (outcome.status === "unknown") {
            // Do NOT let the user press Save again: see `unresolved`.
            setUnresolved(true);
            setError(t("errorCreateTypeUnknown", { type: trimmedNewName }));
            onNewTypeProgress({ status: "unresolved", name: trimmedNewName });
            return;
          }
          if (outcome.status === "failed") return;
          target = outcome.type;
          setCreatedType(target);
          // Announced before the next write, so a failure below still leaves
          // the caller's type list able to offer what was created.
          onNewTypeProgress({ status: "created", type: target });
        }
        if (!retyped) {
          const outcome = await retypeDocument(target.id);
          if (outcome === "unknown") {
            setUnresolved(true);
            setError(t("errorRetypeUnknown", { type: target.name }));
            onNewTypeProgress({ status: "moveUnresolved", type: target });
            return;
          }
          if (outcome === "failed") return;
          setRetyped(true);
          // Told to the caller HERE rather than on success: the document has
          // already moved, and the field write below may still fail.
          onNewTypeProgress({ status: "moved", type: target });
        }
      }
      const saveTypeId = target?.id ?? typeId;
      // `order` is sent as the position within the accepted set; the server
      // renumbers the merged list from scratch (mergeAcceptedFields), so this
      // only has to carry the user's ordering, not a global one.
      const fields: DocumentTemplateField[] = selected.map((r, index) => {
        // ⚠️ `rowName`, with no fallback to `labelRo` — see its comment. A
        // ticked row with no name cannot reach here: `unnamedRow` disables Save.
        const label = rowName(r);
        return {
          // ⚠️ Slice #29.10: the key the SCREEN was showing under this row, not
          // the one the proposal minted before the user renamed it. Same
          // `taken` walk, same order, so what is stored is what was displayed.
          // `|| r.key` is unreachable — `keysForReviewRows` keys exactly the
          // ticked, not-already-captured rows, which is what `selected` is —
          // and it is here so a future refactor cannot make a field silently
          // vanish: `mergeAcceptedFields` drops a row with an empty key.
          key:     keyForRow(r) || r.key,
          labelRo: label,
          labelEn: label,
          type:    r.type,
          order:   index,
          // ⚠️ Slice #29.10: always null on this path, and deliberately still a
          // call rather than a literal. `buildFieldHint` is where the rule and
          // the six values that broke the previous one are written down; a
          // `null` here would leave the next reader to rediscover why. A form
          // proposed from ONE document carries no extraction hint — the
          // document-type engine, reading several, is what produces one.
          aiHint:  buildFieldHint({ sampleValue: r.sampleValue, type: r.type }),
          groupRo: null,
          groupEn: null,
        };
      });

      /**
       * What a save that LANDED means for the caller, wherever we learned it
       * landed from — the PUT's own answer, or the list read that resolved a
       * lost one.
       */
      const completeSave = (savedFields: DocumentTemplateField[]) => {
        // How many fields the type ACTUALLY gained, from the server's own
        // answer. `fields.length` would be what we asked for, and the merge
        // legitimately drops a row whose key the template already had —
        // reporting the request would let the dialog claim three fields were
        // added when one was.
        const savedKeys = new Set(savedFields.map((f) => f.key));
        const added = savedFields.length > 0
          ? savedFields.length - activeBaseline.length
          : fields.length;
        // The values discovery read, for the fields that actually landed. The
        // caller fills the form it is standing on with them: the user has just
        // confirmed each one against the page, and without this the document
        // that produced the discovery is the one document of its type nothing
        // can fill — the per-document AI-Interpret button went in #26.09, and
        // `runAiInterpret` only runs inside an import.
        // Through formValueForField, never raw: a date input holds only ISO and
        // a number input only a dot-decimal, and a value they cannot hold is
        // stored invisibly rather than shown. See that function's own comment.
        const values: Record<string, string> = {};
        // Indexed against `fields`, not against `r.key`: since #29.10 the key
        // follows the name the user typed, and `r.key` is the proposal's
        // opening guess. Reading the stale one here filled nothing, because
        // `savedKeys` holds what was actually stored.
        selected.forEach((r, index) => {
          const key = fields[index].key;
          if (!savedKeys.has(key)) return;
          const value = formValueForField(r.sampleValue, r.type);
          if (value !== null) values[key] = value;
        });
        onSaved(Math.max(0, added), values);
      };

      let res: Response;
      try {
        res = await fetch(
          `/api/document-types/${encodeURIComponent(saveTypeId)}/template-fields`,
          {
            method:  "PUT",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
              knownKeys: activeBaseline.map((f) => f.key),
              fields,
            }),
          },
        );
      } catch {
        const resolved = await resolveFieldsSaved(saveTypeId, fields.map((f) => f.key));
        if (resolved === "unknown") {
          /**
           * ⚠️ **NOT terminal, unlike an unresolved write 1 or 2.** What makes
           * those two terminal is that retrying them can create a second type
           * or re-type twice; write 3 has neither hazard — `createdType` and
           * `retyped` already hold, so a second press only re-PUTs the fields,
           * and a PUT that already landed answers 409 `template_changed`, which
           * this dialog recovers from by reseeding. Locking Save here turned the
           * ordinary review's one-second Wi-Fi drop into a dead end whose only
           * exit was Close, where before it was a retry — and the resolver's own
           * GET fails under exactly the network condition that made the PUT
           * fail, so "unknown" is the LIKELY branch on this path, not the rare
           * one.
           */
          setError(t("errorFieldsUnknown", { type: targetTypeName }));
          // Slice #29.10: freeze the rows so the retry the message asks for
          // sends the same keys. See `fieldsUnresolved`.
          setFieldsUnresolved(true);
          // If it did land, the type list is now stale and the form behind this
          // dialog would not render the new fields. Not awaited.
          onTypesChanged();
          if (target) onNewTypeProgress({ status: "movedFieldsUnknown", type: target });
          return;
        }
        if (resolved === "failed") {
          setError(t("errorSave"));
          // Same downgrade as the answered-failure branch below: the resolver
          // read the stored template and none of the keys is there.
          if (createNew && target) onNewTypeProgress({ status: "moved", type: target });
          return;
        }
        completeSave(resolved.fields);
        return;
      }
      // An expired session is redirected to /login and followed silently by
      // fetch, which would otherwise look like a successful save.
      if (res.redirected) {
        setError(t("errorSession"));
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          code?:   string;
          max?:    number;
          fields?: unknown;
        };
        // The route's messages are English — it serves an API, not a screen.
        // Every one of them is mapped to copy from this namespace; none is
        // shown verbatim, because the reader is a Romanian business user.
        if (res.status === 409 && body.code === "template_changed") {
          // Recovered HERE, from the fields the 409 itself carries, rather than
          // by asking the caller to refetch and remount us. A refetch can fail
          // — `invalidateQueries` resolves either way and react-query keeps the
          // stale data — and a dialog that answers a failure by rebuilding
          // itself from the same stale cache reproduces the failure for ever,
          // with Cancel (which discards the whole run) as the only exit.
          const fresh = parseTemplateFields(body.fields);
          /**
           * ⚠️ **A 409 that already holds every key we asked for is OUR OWN
           * write coming back, not somebody else's.**
           *
           * That is now the main way this branch is reached: a PUT whose answer
           * was lost is retried (see `errorFieldsUnknown`), the retry sends the
           * `knownKeys` the reviewer saw, and the server — which has since
           * stored those very fields — answers 409. Reseeding there marked all
           * five rows "already captured", never called `onSaved`, and left the
           * user with the fields on the type, no values in the form, a banner
           * blaming a concurrent edit, and no Save button to press. The
           * discovered values were then unrecoverable: a fresh discovery run
           * reports every one of them as already captured.
           *
           * The 409 body carries the stored fields, so the proof is in hand.
           * Finish the save from it instead of reporting a conflict.
           */
          if (fields.every((f) => fresh.some((stored) => stored.key === f.key))) {
            completeSave(fresh);
            return;
          }
          // Slice #27.04: whichever baseline is live — the stored type's, or
          // the one belonging to a type this dialog just created.
          setActiveBaseline(fresh);
          const reproposed = proposeTemplateFields(pairs, fresh, roles);
          setRows(applyDecisions(seedReviewRows(reproposed)));
          setError(t("errorChanged"));
          // The form behind this dialog renders from the caller's cache, so it
          // is now out of date too. Not awaited, and nothing here depends on it.
          onTypesChanged();
        } else if (body.code === "too_many_fields") {
          setError(t("errorTooMany", { max: body.max ?? MAX_TEMPLATE_FIELDS }));
        } else if (res.status === 404) {
          setError(t("errorNotFound"));
        } else {
          setError(t("errorSave"));
        }
        // ⚠️ Slice #27.04: a definite failure DOWNGRADES an earlier "we could
        // not tell". An answer that arrived proves the fields are not stored —
        // a PUT that had committed would have answered 409, and the branch
        // above would have finished the save — so leaving `movedFieldsUnknown`
        // pending would close the run on "check whether the form was saved"
        // when the honest ending is "it was not, run discovery again".
        if (createNew && target) onNewTypeProgress({ status: "moved", type: target });
        return;
      }
      const saved = (await res.json().catch(() => ({}))) as { fields?: unknown };
      completeSave(parseTemplateFields(saved.fields));
    } catch {
      setError(t("errorSave"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discover-review-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
    >
      {/* Capped and internally scrolled, like every other dialog in this repo
          (person-resolution, property-step, the value-list modals). Without
          the cap a dense contract's forty rows push the footer, the error
          banner and the over-limit warning below the fold — so the controls
          are off-screen at the moment they have something to say. */}
      <div
        ref={panelRef}
        className="my-8 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-card p-6 shadow-xl dark:bg-zinc-900"
      >
        <h3
          id="discover-review-title"
          className="text-base font-semibold text-ink dark:text-zinc-100"
        >
          {t("title", { type: targetTypeName })}
        </h3>
        {/* Slice #27.04: the heading names the type the fields will land on, so
            the paragraph under it has to be talking about the same type. The
            stored-type wording says "this document type", which is the OLD one
            the moment the new-type box is ticked. */}
        <p className="mt-2 text-sm text-fade dark:text-zinc-400">
          {createNew ? t("introNewType") : t("intro")}
        </p>

        {/* ⚠️ Slice #29.10: said on the screen because the screen is where the
            decision is made. A form proposed from ONE document is saved with no
            extraction hints at all — see `buildFieldHint` for the six values
            that came off one deed and were sitting on a shared type. The
            sentence also points at the thing that DOES produce hints, so the
            absence reads as a boundary rather than as a missing feature. */}
        {!nothingToAdd && (
          <p className="mt-2 text-sm text-fade dark:text-zinc-400">{t("noHintNote")}</p>
        )}

        {/* ── Slice #27.04: "this is a new document type" ─────────────────
            Above the table, because it changes what every row below it means:
            with the box ticked the fields land on a type that does not exist
            yet, and the rows the CURRENT type already captures become
            offerable again. Outside the scrolling area so it cannot be
            scrolled away from the rows it governs. */}
        <div className="mt-3 rounded-md border border-wire bg-cta-pale px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/40">
          <label className="flex items-start gap-2 font-medium text-ink dark:text-zinc-200">
            <input
              type="checkbox"
              checked={createNew}
              // Locked once the type is real — unticking it would point Save at
              // the old type while the document sits on the new one — and
              // locked once a write is unresolved, where unticking cleared the
              // warning and re-armed exactly that.
              disabled={saving || createdType !== null || unresolved || fieldsUnresolved}
              onChange={(e) => toggleCreateNew(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-wire accent-cta"
            />
            <span>{t("newTypeToggle")}</span>
          </label>
          {createNew && (
            <div className="mt-3 pl-6">
              <label
                htmlFor="discover-new-type-name"
                className="block text-xs font-medium uppercase tracking-wide text-fade dark:text-zinc-400"
              >
                {t("newTypeNameLabel")}
              </label>
              <input
                id="discover-new-type-name"
                type="text"
                value={createdType?.name ?? newTypeName}
                // Same lock, same reason: the row exists, and this box cannot
                // rename it. Reference Data can.
                disabled={saving || createdType !== null || unresolved || fieldsUnresolved}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder={t("newTypeNamePlaceholder")}
                // Both, and in this order: a screen reader that only heard the
                // help sentence would be told what Save is about to do at the
                // moment Save has gone dead and cannot do it.
                aria-describedby={
                  duplicateName
                    ? "discover-new-type-taken discover-new-type-help"
                    : "discover-new-type-help"
                }
                aria-invalid={duplicateName || undefined}
                // Disabled styling copied from `Field` in document-form.tsx,
                // never an opacity dip: #23.05.UX retired that pattern because it
                // multiplies the enabled appearance instead of replacing it, and
                // `button-styles-single-source.test.ts` enforces the ban — by
                // grepping the source, so naming the class even in a comment
                // fails the build. (It did.)
                className="mt-1 w-full max-w-md rounded-md border border-wire bg-transparent px-2 py-1.5 text-ink disabled:bg-canvas disabled:text-fade disabled:cursor-default dark:border-zinc-700 dark:text-zinc-100 dark:disabled:bg-zinc-800"
              />
              {duplicateName && (
                <p
                  id="discover-new-type-taken"
                  role="alert"
                  className="mt-2 text-red-700 dark:text-red-400"
                >
                  {t("newTypeNameTaken")}
                </p>
              )}
              <p
                id="discover-new-type-help"
                className="mt-2 text-fade dark:text-zinc-400"
              >
                {/* ⚠️ Keyed off `retyped`, not off `createdType`. The type is
                    created BEFORE the document is moved, so a help text that
                    claimed both on the strength of the first sat directly above
                    a red banner saying the second had failed. */}
                {!createdType
                  ? t("newTypeHelp", { current: typeName })
                  : retyped
                    ? t("newTypeCreated", { type: createdType.name })
                    : t("newTypeCreatedNotMoved", { type: createdType.name })}
              </p>
              {/* Ticking the box cannot help when the reseed left nothing
                  offerable — every pair is a generic column or a person role.
                  Said here, because the Save button is not rendered at all in
                  that state and the panel above it is still promising an
                  action. */}
              {createNew && nothingToAdd && !createdType && (
                <p className="mt-2 text-fade dark:text-zinc-400">
                  {t("newTypeNothingToAdd")}
                </p>
              )}
              {!documentLabel && !createdType && (
                <p className="mt-2 text-fade dark:text-zinc-400">{t("newTypeNoLabel")}</p>
              )}
            </div>
          )}
        </div>

        {(skippedPages > 0 || truncated) && (
          <div
            role="status"
            className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          >
            {skippedPages > 0 && <p>{t("warnSkipped", { count: skippedPages })}</p>}
            {truncated && <p>{t("warnTruncated")}</p>}
          </div>
        )}

        {/* Everything between the heading and the footer scrolls; the footer
            and the error banner stay put. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* ── The proposals ───────────────────────────────────────────── */}
          {typeFull ? (
            <p className="mt-4 rounded-md border border-dashed border-wire px-4 py-6 text-center text-sm text-fade dark:border-zinc-700 dark:text-zinc-400">
              {t("typeFull", { max: MAX_TEMPLATE_FIELDS })}
            </p>
          ) : newRows.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed border-wire px-4 py-6 text-center text-sm text-fade dark:border-zinc-700 dark:text-zinc-400">
              {t("nothingNew")}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{t("tableCaption")}</caption>
                <thead>
                  <tr className="border-b border-crease text-left text-xs uppercase tracking-wide text-fade dark:border-zinc-700 dark:text-zinc-400">
                    <th scope="col" className="w-10 py-2 pr-2">
                      <span className="sr-only">{t("colInclude")}</span>
                    </th>
                    <th scope="col" className="py-2 pr-3">{t("colLabel")}</th>
                    <th scope="col" className="py-2 pr-3">{t("colType")}</th>
                    <th scope="col" className="py-2">{t("colSample")}</th>
                  </tr>
                </thead>
                <tbody>
                  {newRows.map((row) => {
                    // Computed once per row: it is both the red mark on the row
                    // and half of what the footer says.
                    const issue = reviewRowIssue(row, captured);
                    return (
                    <tr
                      key={row.rowId}
                      className="border-b border-crease/60 align-top dark:border-zinc-800"
                    >
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={row.include}
                          disabled={rowsLocked}
                          onChange={(e) => patchRow(row.rowId, { include: e.target.checked })}
                          // ⚠️ Slice #29.10: named by the row's NAME, not by
                          // `row.key` — which is the proposal's opening guess
                          // and stops being the stored key the moment the user
                          // renames the row.
                          // `|| labelRo` is a DISPLAY fallback and nothing
                          // else — `rowName` has none, deliberately, so a
                          // cleared box cannot be saved under the caption it
                          // deleted. An empty accessible name would leave two
                          // emptied rows announcing identically.
                          aria-label={t("includeAria", { label: rowName(row) || row.labelRo })}
                          className="mt-2 h-4 w-4 shrink-0 rounded border-wire accent-cta"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="text"
                          value={row.label}
                          disabled={rowsLocked}
                          onChange={(e) => patchRow(row.rowId, { label: e.target.value })}
                          aria-label={t("labelAria", { label: row.labelRo })}
                          className="w-full rounded-md border border-wire bg-transparent px-2 py-1.5 text-ink dark:border-zinc-700 dark:text-zinc-100"
                        />
                        <span className="mt-1 block font-mono text-xs text-fade dark:text-zinc-500">
                          {/* Slice #29.10: recomputed from the name as typed,
                              so renaming a field actually renames it. */}
                          {keyForRow(row)}
                          {row.confidence !== "high" && (
                            <span className="ml-2 rounded bg-amber-100 px-1 py-0.5 font-sans text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                              {t("lowConfidence")}
                            </span>
                          )}
                        </span>
                        {/* ⚠️ Slice #29.10: ADVISORY, never a filter. The model
                            reads one document with no schema and hands back
                            names cut out of the prose around them — „suprafața
                            de", „prețul vânzării este de". Deleting those
                            silently is the mistake field-distillation.ts spent
                            three rounds measuring; saying so beside a box the
                            user can type in is not. The row stays saveable. */}
                        {/* ⚠️ Slice #29.10: through `rowName`, the same helper
                            the key and the save use. A round found this reading
                            a different expression from the key and the save, so
                            typing one space into the box made the warning
                            vanish while the fragment was still stored. */}
                        {looksLikeSentenceFragment(rowName(row)) && (
                          <span className="mt-1 block text-xs text-amber-800 dark:text-amber-300">
                            {t("fragmentName")}
                          </span>
                        )}
                        {/* ⚠️ Slice #29.10: a SECOND complaint with its own
                            sentence, and a review round is why. Folded into the
                            one above, the length test told the author of
                            „Certificat de atestare fiscală pentru persoane
                            fizice" that their caption read like a piece of a
                            sentence, which is untrue — while the thing that is
                            true, that its key is about to be cut mid-word, went
                            unsaid. F5 reported that truncation by name. */}
                        {nameTooLongForKey(rowName(row)) && (
                          <span className="mt-1 block text-xs text-amber-800 dark:text-amber-300">
                            {t("longName", { max: MAX_KEY_LENGTH })}
                          </span>
                        )}
                        {/* ⚠️ Slice #29.10: the two BLOCKING problems marked on
                            the row as well as summarised in the footer, and a
                            review round is why. They were footer-only, saying
                            "a ticked field has no name" on a screen showing
                            thirty-six rows — while the two advisory warnings
                            above sat on the row itself. The one you must act on
                            was the harder of the two to find. */}
                        {issue !== null && (
                          <span className="mt-1 block text-xs text-red-700 dark:text-red-400">
                            {issue === "unnamed" ? t("rowNameRequired") : t("rowNameDuplicate")}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={row.type}
                          disabled={rowsLocked}
                          onChange={(e) =>
                            patchRow(row.rowId, {
                              type: e.target.value as DocumentTemplateFieldType,
                            })
                          }
                          aria-label={t("typeAria", { label: rowName(row) || row.labelRo })}
                          className="rounded-md border border-wire bg-transparent px-2 py-1.5 text-ink dark:border-zinc-700 dark:text-zinc-100"
                        >
                          {FIELD_TYPES.map((ft) => (
                            <option key={ft} value={ft}>
                              {t(`types.${ft}`)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 text-fade dark:text-zinc-400">
                        <span className="block max-h-24 overflow-y-auto whitespace-pre-wrap break-words">
                          {row.sampleValue || t("sampleEmpty")}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Already captured ────────────────────────────────────────── */}
          {presentRows.length > 0 && (
            <div className="mt-5 rounded-md border border-wire bg-cta-pale px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/40">
              <p className="font-medium text-ink dark:text-zinc-200">
                {t("alreadyTitle", { count: presentCount })}
              </p>
              <p className="mt-1 text-fade dark:text-zinc-400">{t("alreadyBody")}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {presentFields.map((row) => (
                  <li
                    key={row.key}
                    className="rounded bg-card px-2 py-1 font-mono text-xs text-fade dark:bg-zinc-900 dark:text-zinc-400"
                  >
                    {row.labelRo}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
          >
            <span className="mt-0.5 shrink-0 font-bold">!</span>
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-fade dark:text-zinc-400">
            {/* A disabled primary button with nothing beside it reads as a
                broken screen. Every way of reaching one is answered here:
                nothing new to add, the type already full, and nothing ticked.
                ⚠️ Slice #29.10 made the last one the OPENING state of every
                run — nothing is pre-ticked any more — so this sentence is no
                longer an edge case, it is the first thing the user reads. */}
            {nothingToAdd ? (
              t("nothingToAddFooter")
            ) : (
              <>
                {t("selectedCount", { count: selected.length })}
                {selected.length === 0 && (
                  <span className="mt-1 block">{t("needSelection")}</span>
                )}
              </>
            )}
            {overLimit && !typeFull && (
              <span className="mt-1 block text-red-700 dark:text-red-400">
                {t("overLimit", { max: MAX_TEMPLATE_FIELDS, total: wouldTotal })}
              </span>
            )}
            {/* Slice #27.04: the fourth way to a disabled Save, answered like
                the other three rather than left as a dead button. Only the
                EMPTY name is answered here — a name that is already taken is
                said beside the box that holds it, and saying it twice on one
                screen was a review finding. */}
            {createNew && trimmedNewName.length === 0 && !nothingToAdd && (
              <span className="mt-1 block text-red-700 dark:text-red-400">
                {t("newTypeNameRequired")}
              </span>
            )}
            {/* ⚠️ Slice #29.10: two more ways to a disabled Save, both opened
                by the key following the label. The footer POINTS and the rows
                SAY — a review round found it the other way round, with "a
                ticked field has no name" down here and nothing on the row, on a
                screen that routinely shows thirty-six of them. */}
            {/* ⚠️ Inside `!nothingToAdd`, and a fourth round found why: a 409
                that reseeds onto a type at the ceiling replaces the table with
                the `typeFull` paragraph while `applyDecisions` restores the
                ticks, so a pure pointer said "marked in red above" with nothing
                above it. */}
            {!nothingToAdd && (unnamedRow || duplicateRow) && (
              <span className="mt-1 block text-red-700 dark:text-red-400">
                {t("rowIssuesFooter")}
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              disabled={saving}
              className={buttonClass({
                // Slice #27.04: `unresolved` is a dead end — Save is disabled
                // and cannot be re-armed — so this button is the only exit and
                // reads as the primary one.
                variant: nothingToAdd || unresolved ? "primary" : "secondary",
                size: "lg",
              })}
            >
              {/* ⚠️ Slice #27.04: "Anulează" is a lie once anything has been
                  written. A user who has just been told a type was created and
                  to close the window should not have to press a button that
                  says the run is being cancelled — it reads as undoing the type
                  that now exists. */}
              {nothingToAdd || createdType !== null || unresolved
                ? t("close")
                : t("cancel")}
            </button>
            {!nothingToAdd && (
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className={buttonClass({ variant: "primary", size: "lg" })}
              >
                {saving ? t("saving") : t("save")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
