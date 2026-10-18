/**
 * No new button shows words without a decision.                   (Slice #37.48)
 *
 * #37.42–#37.47 put the app's buttons on IconButton; Adrian decided, action by
 * action, which keep their words (GA40-CTA-Icon-Map.xlsx, „Keep text"). This
 * guard reads every `<button>`, `<a>`, `<Link>` and `role="button"` element
 * under `src/` (`src/lib/testing/text-controls.ts`) and fails on one whose
 * children show words unless it is on the list below — so adding a text button
 * means adding a line here, in the diff, with the decision it rests on.
 *
 * ⚠️ **A LIST, NOT A HEURISTIC.** Each entry is a file, the action ID that
 * keeps the words, and the start of the element's children as the scan reads
 * them. Every entry must match an element, and every element an entry: a list
 * that has outlived its buttons fails as surely as a button the list never
 * heard of.
 *
 * The IDs (the workbook's „Actions" sheet):
 *  - A110 a confirmation's answers — „Șterge" / „Anulează" under „Ștergeți…?";
 *  - A113 a record's name, code or count shown as a link — the text is the data;
 *  - A107 the import wizard's answers; A108 a form's own submit button;
 *  - A043, A054, A055 choices between values and dialog decisions;
 *  - A056 „HARTĂ" / „SATELIT"; A062 the map's two tabs; A069 „Îndreaptă";
 *    A070 the coordinate formats; A071 the add-property choice tiles and their
 *    drop zones; A020 „Toate" / „Implicit"; A075 the users' tabs; A085 the
 *    reference-data hub; A091 help content's tabs and list; A111 form tabs;
 *    A112 breadcrumbs;
 *  - A001 the sidebar's rows and A015 a filter's dropdown trigger: icon AND
 *    words, decided so in #37.42 (the words are the place or the value);
 *  - A096 a link in a sentence that opens in the same tab — #37.46 gave the
 *    new-tab ones their ExternalLink and left this one as it was;
 *  - FOLD „Arată mai mult…" (#37.40), out of scope for icons — and a section's
 *    title that opens and closes it (#39.33, `DisclosureSection`);
 *  - ICONBUTTON IconButton itself, whose children are its icon and words;
 *  - INFO the ⓘ's „i" (#38.08): a glyph drawn as a letter, aria-hidden — the
 *    button is named by its aria-label, so it shows no words.
 * A text link carrying `LeadingIcon` / `TrailingIcon` has its icon and is not
 * listed (#37.46, #37.47).
 */
import fs from "fs";
import os from "os";
import path from "path";

import { scanTextControls, type TextControl } from "@/lib/testing/text-controls";

type Allowed = [id: string, childrenStart: string];

const ALLOW: Record<string, Allowed[]> = {
  // Slice #39.72: the issuer search — a juridical person's name picks it, with its code, type and CUI beside it.
  "src/app/documents/_components/issuer-field.tsx": [
    ["A113", "{o.displayName}"],
  ],
  // Slice #39.67: the tarlale — a tarla's code opens its page; a property's and a document's code open theirs.
  "src/app/tarlale/_components/tarla-list.tsx": [
    ["A113", "{row.indicativ}"],
  ],
  "src/app/tarlale/_components/tarla-detail.tsx": [
    ["A113", "{p.code}"],
    ["A113", "{d.code}"], // Slice #39.69: a plan's code opens the plan
    ["A113", "{p.sourceDocumentCode}"], // Slice #39.69: the plan a parcel came from
    ["A113", "{d.code}"],
  ],
  // Slice #39.69: the tarla step — „Deschide pagina tarlalei” at the end of the proposal's sentence (A096).
  "src/app/admin/import/_components/tarla-plan-dialog.tsx": [
    ["A096", "{chunks}"],
  ],
  "src/app/(all-roles)/admin/global-search/_components/global-search-view.tsx": [
    ["A113", "{row.entityType === \"PROPERTY\" ? propertyLabel(row, nameOr(n"], // #37.57: the name is the link
  ],
  // Slice #39.48: „Legături”'s line „Părțile actului (3) sunt în fișa „Părți”.” — its „Părți” is a word in a sentence
  // that brings the tile into view on the same screen (A096).
  "src/app/documents/_components/document-related-tile.tsx": [
    ["A096", "{chunks}"],
  ],
  "src/app/_components/dashboard-client.tsx": [
    ["A113", "{data === undefined ? ( <Skeleton className=\"h-8 w-12\" /"],
    ["A113", "{nameOr(doc.title, \"document\")}"], // #37.57: the title is the link
    ["A113", "<span className=\"font-bold\">{data.persons}</span> <span>"],
    ["A113", "<span className=\"font-bold\">{data.properties}</span> <sp"],
    ["A113", "<span className=\"font-bold\">{data.documents}</span> <spa"],
    ["A113", "{nameOr(item.displayName, item.entityType)}"],
  ],
  // Slice #39.37: the user manual. A cross-reference in a sentence is a same-tab link whose words are the number
  // it points at (A096); the contents' rows are the chapters and sections themselves, as the sidebar's rows are
  // the places they open (A001). „Capitolul anterior / următor" carry LeadingIcon / TrailingIcon, so are not listed.
  // Slice #39.42: „Harta competențelor”. The Path chips are a choice between values; a skill's name in the list
  // view is the link to its quiz — the text is the data. The boxes themselves are drawn faces, not words.
  "src/app/skills-map/_components/skills-map-view.tsx": [
    ["A043", "{t(\"allPaths\")}"],
    ["A043", "{pathShort(p.key)}"],
    ["A113", "{s.name[lang]}"],
  ],
  // Slice #39.45: „Întreabă”'s AI answer names its sections in the sentence, as the manual's cross-references do (A096).
  "src/app/ask/_components/ask-box.tsx": [
    ["A096", "{`§${run.number}`}"],
    // #39.49: „Manualul nu răspunde la această întrebare. Deschide cuprinsul manualului” — a link in a sentence.
    ["A096", "{t(\"openContents\")}"],
  ],
  "src/app/manual/_components/manual-view.tsx": [
    ["A096", "{target.number}"],
    ["A001", "{`${c.number} ${c.title}`}"],
    ["A001", "{`${b.number} ${b.title}`}"],
  ],
  "src/app/account/change-password/change-password-form.tsx": [
    ["A108", "{state === \"saving\" ? t(\"buttonSaving\") : t(\"buttonSave\""],
  ],
  // #39.11: the inheritance tree — a person's name is the link to their screen (the card's, a tie's, a node's).
  // #39.12: drawn by the shared canvas now, for the whole tree and for a person's tile.
  "src/components/inheritance/tree-canvas.tsx": [
    ["A113", "{byId.get(chosen)!.displayName}"],
    ["A113", "{byId.get(other)?.displayName}"],
    ["A113", "<text x={0} y={-h / 2 + px(17)} textAnchor=\"middle\" fontSize={px(13)} fontWeight"],
    // #39.13: a person's documents count, a pair's shared count, and a document's type in their list — the data.
    ["A113", "<title>{t(\"docs.badge\", { count: docCount })}</title>"],
    ["A113", "<title>{label}</title>"],
    ["A113", "<FileText aria-hidden=\"true\" size={14} className=\"mt-0.5 shrink-0 text-teal-700\""],
  ],
  "src/app/admin/calculation/_components/calculation-view.tsx": [
    ["A113", "{nameOr(p.nickname, \"property\")}"], // #37.57: no system ID; back with #38.25's commit
  ],
  "src/app/admin/calculation/_components/side-road-start.tsx": [
    ["A113", "<span className=\"min-w-0 flex-1 truncate text-left\">{render(h)}</span>"], // #39.79: a property or a person found, by name
  ],
  // Slice #38.43: „Ștergeți calculul?" — „Șterge" / „Anulează".
  "src/app/admin/calculation/history/_components/delete-run.tsx": [
    ["A110", "{busy ? t(\"deleting\") : t(\"confirm\")}"],
    ["A110", "{t(\"cancel\")}"],
  ],
  "src/app/admin/groups/_components/groups-list-view.tsx": [
    ["A110", "{deleteMutation.isPending ? t(\"confirm.deleting\") : t(\"c"],
    ["A110", "{t(\"confirm.cancel\")}"],
  ],
  "src/app/admin/help-content/_components/help-content-hub.tsx": [
    ["A091", "{t(\"screensTab\")}"],
    ["A091", "{t(\"hintsTab\")}"],
    ["A091", "<span className=\"truncate\">{t(helpScreenLabelKey(s.key))"],
    ["A091", "<span className=\"truncate\">{t(helpHintLabelKey(h.hintKey"],
  ],
  "src/app/admin/import/_components/bulk-import-dialog.tsx": [
    ["A113", "✓ {t(`note.${note.id}`, note.values)}"],
  ],
  "src/app/admin/import/_components/cancel-import-dialog.tsx": [
    ["A110", "{t(\"keepGoing\")}"],
    ["A110", "{t(\"confirm\")}"],
  ],
  "src/app/admin/import/_components/id-card-person-dialog.tsx": [
    ["A107", "{t(\"extractErrorDismiss\")}"],
    ["A107", "{addingInstitution ? t(\"institutionAdding\") : t(\"institu"],
  ],
  "src/app/admin/import/_components/import-information.tsx": [
    ["A107", "{t(\"acknowledge\")}"],
  ],
  "src/app/admin/import/_components/import-structure-stage.tsx": [
    ["A107", "{t(\"confirmProperty.change\")}"],
    ["A107", "{t(\"confirmProperty.change\")}"],
    ["A107", "{t(\"confirmProperty.yes\")}"],
    ["A107", "{t(\"confirmProperty.no\")}"],
  ],
  "src/app/admin/import/_components/import-types-blocked-stage.tsx": [
    ["A107", "{t(\"continueWithoutForms.button\")}"],
  ],
  "src/app/admin/import/_components/preflight-checklist.tsx": [
    ["A096", "{t(\"documentTypesLink\")}"],
  ],
  "src/app/admin/import/_components/tag-dialog.tsx": [
    ["A107", "{t(\"confirmButton\")}"],
  ],
  "src/app/admin/stamps/_components/stamps-list-view.tsx": [
    ["A110", "{deleteMutation.isPending ? t(\"confirm.deleting\") : t(\"c"],
    ["A110", "{t(\"confirm.cancel\")}"],
  ],
  "src/app/admin/tags/_components/tag-manager.tsx": [
    ["A113", "{row.tag} <span className=\"ml-1.5 text-xs opacity-60\">×{"],
  ],
  "src/app/admin/users/users-access-client.tsx": [
    ["A075", "{tabKey === \"pending\" ? t(\"tabs.pending\") : t(\"tabs.hist"],
  ],
  "src/app/admin/value-lists/_components/document-type-form-editor.tsx": [
    ["A110", "{pending.kind === \"discard\" ? t(\"confirmDiscard\") : t(\"c"],
    ["A110", "{t(\"cancel\")}"],
  ],
  "src/app/admin/value-lists/_components/value-list-hub.tsx": [
    ["A085", "{label}"],
  ],
  "src/app/admin/value-lists/_components/relationship-triangle.tsx": [
    ["A085", "<title>{openLabel(r)}</title> {mark}"], // #38.62: a corner's or side's number opens its list
    ["A085", "{name(r)}"], // #38.62: the relationship's name opens its list — the name is the place
    ["A085", "<title>{name(r)}</title> {mark}"], // #38.68: 6's number is pressed too — it marks 6 alone, opens nothing
    ["A096", "{chunks}"], // #38.69: a list named in a step of the ⓘ — a link in a sentence, the same tab
  ],
  "src/app/admin/value-lists/_components/document-type-page.tsx": [
    ["A111", "{t(`tabs.${key}`)}"], // #38.39: General / Formular / Roluri
  ],
  "src/app/admin/value-lists/document-types/[code]/page.tsx": [
    ["A112", "{t(\"back\")}"], // #38.39: „← Tipuri de Document", the way back to the list
  ],
  "src/app/admin/value-lists/_components/value-list-modal.tsx": [
    ["A110", "{deleteMutation.isPending ? t(\"confirm.deleting\") : t(\"c"],
    ["A110", "{t(\"confirm.cancel\")}"],
  ],
  "src/app/documents/_components/ai-reference-linker-dialog.tsx": [
    ["A054", "{t(\"stubConfirm\")}"],
    ["A054", "{t(\"stub\")}"],
    ["A054", "{t(\"leave\")}"],
  ],
  "src/app/documents/_components/document-form.tsx": [
    ["A096", "{chunks}"], // #37.85: „Distilare Tipizate" in the no-form line, same tab
    ["A111", "{label}"],
    ["A110", "{noLabel}"],
    ["A110", "{yesLabel}"],
  ],
  "src/app/documents/_components/pages-panel.tsx": [
    ["A113", "<td className=\"py-1.5 pr-2 font-mono text-xs tabular-num"],
    ["A110", "{t(\"deleteConfirm.no\")}"],
    ["A110", "{t(\"deleteConfirm.yes\")}"],
  ],
  // Slice #38.84 — „Interacțiuni": the period's trigger names its range; a person, a document and a count are data.
  "src/app/interactions/_components/filter-controls.tsx": [
    ["A113", "<span className=\"min-w-0 flex-1 truncate text-left\">{p.displayName"], // a person found, by name
  ],
  // Slice #38.85: „Renunți la interacțiunea nesalvată?" — „Renunță la ea" / „Continuă".
  "src/app/interactions/_components/log-tile.tsx": [
    ["A110", "{tl(\"discardYes\")}"],
    ["A110", "{tl(\"discardNo\")}"],
    ["A113", "{s}"], // #38.86: a tag suggested — the text is the data
    // #38.87: „…modificată de altcineva" — „Reîncarcă" / „Suprascrie"; „Ștergi interacțiunea?" — „Anulează" / „Șterge".
    ["A110", "{tl(\"conflictReload\")}"],
    ["A110", "{tl(\"conflictOverwrite\")}"],
    ["A110", "{tl(\"deleteNo\")}"],
    ["A110", "{deleting ? tl(\"deleting\") : tl(\"deleteYes\")}"],
  ],
  // Slice #38.86: a document or a property found in the archive's own search, by its name.
  "src/app/interactions/_components/pickers.tsx": [
    ["A113", "<span className=\"min-w-0 flex-1 truncate text-left\">{h.name}</span>"],
  ],
  "src/app/interactions/_components/history-tile.tsx": [
    ["A113", "{name}"], // #39.06: the person's name, a link to their screen
    ["A015", "<CalendarDays aria-hidden=\"true\" size={16} /> {t(`toolbar.preset."], // the period: its preset and its days
    ["A113", "<Paperclip aria-hidden=\"true\" size={14} /> {count}"], // how many documents, opening them
    ["A113", "<FileText aria-hidden=\"true\" size={16} /> {nameOr(d.title"], // a linked document, by its name
  ],
  "src/components/list/filter-bar.tsx": [
    ["A015", "<span className=\"text-fade\">{field.label}</span> <span className=\"font-medium te"], // #39.61: a filter's chip names its field and what is chosen, as a filter's trigger does
  ],
  "src/app/documents/list-view.tsx": [
    ["A015", "<span className=\"text-fade\">{label}</span> {trigger.kind"], // #38.07: the trigger names one type, or says how many
    ["A110", "{noLabel}"],
    ["A110", "{yesLabel}"],
  ],
  "src/app/judicial-persons/_components/judicial-person-form.tsx": [
    ["A113", "{(personName as string) || personId}"],
    ["A110", "{noLabel}"],
    ["A110", "{yesLabel}"],
  ],
  "src/app/judicial-persons/list-view.tsx": [
    ["A110", "{noLabel}"],
    ["A110", "{yesLabel}"],
  ],
  "src/app/login/login-form.tsx": [
    ["A108", "{loading ? buttonSigningIn : buttonSignIn}"],
  ],
  "src/app/natural-persons/_components/natural-person-form.tsx": [
    ["A113", "{nameOr(linkedIdCard.title, \"document\")} →"], // #37.57: the card by its title
    ["A110", "{noLabel}"],
    ["A110", "{yesLabel}"],
  ],
  "src/app/natural-persons/list-view.tsx": [
    ["A110", "{noLabel}"],
    ["A110", "{yesLabel}"],
  ],
  "src/app/properties/_components/add-property-dialog.tsx": [
    // Slice #39.65: two ways in — the scanned image's and the text folder's cards and drop zones went with them.
    ["A071", "<span className=\"font-medium\">{t(\"choiceManual\")}</span>"],
    ["A071", "<span className=\"font-medium\">{t(\"choiceTextFile\")}</spa"],
    ["A071", "<TextFileIcon /> <span className=\"text-sm font-medium te"],
  ],
  "src/app/properties/_components/corners-manager.tsx": [
    ["A070", "{label}"],
    ["A070", "{fmtLabel[f]}"],
  ],
  "src/app/properties/_components/property-form.tsx": [
    ["A069", "{t(\"bowTie.straighten\")}"],
    ["A110", "{noLabel}"],
    ["A110", "{yesLabel}"],
  ],
  "src/app/properties/_components/property-mini-map-inner.tsx": [
    ["A056", "{id === \"roadmap\" ? t(\"map.typeStreet\") : t(\"map.typeSat"],
  ],
  "src/app/properties/_components/straighten-dialog.tsx": [
    ["A069", "{t(\"confirm\")}"],
  ],
  "src/app/properties/map/property-map.tsx": [
    ["A056", "{id === \"roadmap\" ? t(\"map.typeStreet\") : t(\"map.typeSat"],
    ["A062", "{t(\"mapTitle\")}"],
    ["A062", "{t(\"map.selectedPropertiesTab\")} <span className=\"ml-1.5"],
  ],
  "src/app/signup/signup-form.tsx": [
    ["A108", "{state === \"submitting\" ? buttonSubmitting : buttonSubmi"],
  ],
  "src/components/breadcrumb-bar.tsx": [
    ["A112", "{seg.label}"],
  ],
  "src/components/entity-metadata-tab.tsx": [
    ["A113", "<span className=\"font-mono text-xs rounded border border"],
    ["A113", "<span className=\"font-mono text-xs rounded border border"],
    ["A113", "{nameOr(ref.peerName, unnamedKindOf(ref.peerType))}"], // #37.57
    ["A110", "{labelCancel}"],
    ["A110", "{labelOk}"],
  ],
  "src/components/forms/growing-text.tsx": [
    ["FOLD", "{expanded ? t(\"showLess\") : t(\"showMore\")}"],
  ],
  // Slice #39.33: a section that opens and closes — its title is the words, „>" after it (the log tile's five).
  "src/lib/ui/disclosure-section.tsx": [
    ["FOLD", "<span className=\"shrink-0\">{title}</span>"],
  ],
  "src/components/groups-filter-dropdown.tsx": [
    ["A015", "<span className=\"text-fade\">{label}</span> <span classNa"],
  ],
  "src/components/persons/person-resolution-dialog.tsx": [
    ["A055", "{children}"],
    ["A055", "{children}"],
  ],
  "src/components/providers/unsaved-changes-provider.tsx": [
    ["A110", "{t(\"cancel\")}"],
    ["A110", "{t(\"discard\")}"],
    ["A110", "{busy ? t(\"saving\") : t(\"save\")}"],
  ],
  "src/components/recently-viewed-panel.tsx": [
    ["A113", "<EntityIcon type={entry.entityType} /> <span className=\""],
    ["A001", "<History size={18} className=\"shrink-0\" aria-hidden=\"true\" /> <span"], // #38.28: the „Recente" bar, a sidebar row
  ],
  "src/components/record-save-sync.tsx": [
    ["A110", "{t(\"confirmNo\")}"],
    ["A110", "{t(\"confirmYes\")}"],
  ],
  "src/components/screen/tile-positions-reset.tsx": [
    ["A020", "{t(\"defaults\")}"], // #38.12: the forms' „Implicit", for a screen with no checkbox bar
  ],
  "src/components/sidebar/sidebar-nav.tsx": [
    ["A001", "<Icon size={14} className=\"shrink-0\" aria-hidden=\"true\" "], // #39.78: a guide's button, a sidebar row like the link
    ["A001", "<Icon size={14} className=\"shrink-0\" aria-hidden=\"true\" "],
    ["A001", "<span className={`flex items-center ${isCollapsed ? \"\" :"],
    ["A001", "<span className={`flex items-center ${isCollapsed ? \"\" :"],
  ],
  "src/components/tiles/tile-selector.tsx": [
    ["A020", "{t(\"all\")}"],
    ["A020", "{t(\"defaults\")}"],
  ],
  "src/lib/ui/hint-bubble.tsx": [
    ["INFO", "<span aria-hidden=\"true\" data-info-glyph=\"\" className={INFO_GLYPH} style={INFO_G"], // #38.08
  ],
  "src/lib/ui/info-press.tsx": [
    ["INFO", "<span aria-hidden=\"true\" data-info-glyph=\"\" className={INFO_GLYPH} style={INFO_G"], // #38.69: the same ⓘ, opened by a press
  ],
  "src/lib/ui/icon-button.tsx": [
    ["ICONBUTTON", "{inner}"],
    ["ICONBUTTON", "{inner}"],
  ],
};

const found = scanTextControls(process.cwd());

function describe1(c: TextControl): string {
  return `${c.file}:${c.line} <${c.tag}> ${c.key.slice(0, 80)}`;
}

describe("every control showing words is on the list (#37.48)", () => {
  it("finds the app's controls at all — the scan is reading the source", () => {
    expect(found.length).toBeGreaterThan(50);
  });

  it("no control shows words without a decision, and no decision outlives its control", () => {
    const unlisted: string[] = [];
    const left = new Map(Object.entries(ALLOW).map(([f, entries]) => [f, [...entries]]));
    for (const c of found) {
      const entries = left.get(c.file) ?? [];
      const i = entries.findIndex(([, start]) => c.key.startsWith(start));
      if (i < 0) unlisted.push(describe1(c));
      else entries.splice(i, 1);
    }
    const stale = [...left].flatMap(([f, entries]) => entries.map(([id, start]) => `${f} [${id}] ${start}`));
    expect({ unlisted, stale }).toEqual({ unlisted: [], stale: [] });
  });

  it("every entry names a decision", () => {
    const known = /^(A0(01|15|20|43|54|55|56|62|69|70|71|75|85|91|96)|A10[78]|A11[0-3]|FOLD|ICONBUTTON|INFO)$/;
    for (const entries of Object.values(ALLOW)) for (const [id] of entries) expect(id).toMatch(known);
  });
});

describe("the scan itself (#37.48)", () => {
  function scanOf(tsx: string): TextControl[] {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "text-controls-"));
    fs.mkdirSync(path.join(root, "src", "app"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "app", "x.tsx"), tsx);
    try {
      return scanTextControls(root);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  it("returns a button that shows words — the case the guard exists for", () => {
    const r = scanOf(`export const X = () => (\n  <button type="button" onClick={go}>\n    {t("save")}\n  </button>\n);\n`);
    expect(r).toEqual([{ file: "src/app/x.tsx", line: 2, tag: "button", key: '{t("save")}' }]);
  });

  it("does not return an icon-only control, an IconButton, or a link carrying LeadingIcon", () => {
    const r = scanOf(
      [
        `<button type="button" aria-label={t("help")}><CircleHelp aria-hidden="true" /></button>`,
        `<IconButton icon={Save} label={t("save")} variant="primary" />`,
        `<a href="/login"><LeadingIcon icon={LogIn} />{label}</a>`,
        `{/* <button>{t("old")}</button> */}`,
      ].join("\n"),
    );
    expect(r).toEqual([]);
  });

  it("reads a role=\"button\" element and a <Link>", () => {
    const r = scanOf(`<div role="button" tabIndex={0}>{name}</div>\n<Link href="/x">{code}</Link>\n`);
    expect(r.map((c) => [c.tag, c.key])).toEqual([
      ["div", "{name}"],
      ["Link", "{code}"],
    ]);
  });
});
