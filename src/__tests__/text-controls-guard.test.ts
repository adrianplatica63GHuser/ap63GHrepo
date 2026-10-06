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
 *  - FOLD „Arată mai mult…" (#37.40), out of scope for icons;
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
  "src/app/(all-roles)/admin/global-search/_components/global-search-view.tsx": [
    ["A113", "{row.entityType === \"PROPERTY\" ? propertyLabel(row, nameOr(n"], // #37.57: the name is the link
  ],
  "src/app/_components/dashboard-client.tsx": [
    ["A113", "{data === undefined ? ( <Skeleton className=\"h-8 w-12\" /"],
    ["A113", "{nameOr(doc.title, \"document\")}"], // #37.57: the title is the link
    ["A113", "<span className=\"font-bold\">{data.persons}</span> <span>"],
    ["A113", "<span className=\"font-bold\">{data.properties}</span> <sp"],
    ["A113", "<span className=\"font-bold\">{data.documents}</span> <spa"],
    ["A113", "{nameOr(item.displayName, item.entityType)}"],
  ],
  "src/app/account/change-password/change-password-form.tsx": [
    ["A108", "{state === \"saving\" ? t(\"buttonSaving\") : t(\"buttonSave\""],
  ],
  "src/app/admin/calculation/_components/calculation-view.tsx": [
    ["A113", "{nameOr(p.nickname, \"property\")}"], // #37.57: no system ID
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
  "src/app/admin/value-lists/_components/document-persons-modal.tsx": [
    ["A110", "{deleteMutation.isPending ? t(\"deleting\") : t(\"delete\")}"],
    ["A110", "{t(\"cancel\")}"],
  ],
  "src/app/admin/value-lists/_components/document-type-form-editor.tsx": [
    ["A110", "{pending.kind === \"discard\" ? t(\"confirmDiscard\") : t(\"c"],
    ["A110", "{t(\"cancel\")}"],
  ],
  "src/app/admin/value-lists/_components/value-list-hub.tsx": [
    ["A085", "{label}"],
  ],
  "src/app/admin/value-lists/_components/value-list-modal.tsx": [
    ["A110", "{deleteMutation.isPending ? t(\"confirm.deleting\") : t(\"c"],
    ["A110", "{t(\"confirm.cancel\")}"],
  ],
  "src/app/documents/[id]/associate-party/associate-party-view.tsx": [
    ["A043", "{t(\"qualityDefunct\")}"],
    ["A043", "{t(\"qualityMostenitor\")}"],
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
  "src/app/documents/_components/succession-parties-panel.tsx": [
    ["A113", "{item.displayName}"],
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
    ["A071", "<span className=\"font-medium\">{t(\"choiceManual\")}</span>"],
    ["A071", "<span className=\"font-medium\">{t(\"choiceScan\")}</span> <"],
    ["A071", "<span className=\"font-medium\">{t(\"choiceTextFile\")}</spa"],
    ["A071", "<span className=\"font-medium\">{t(\"choiceTextFolder\")}</s"],
    ["A071", "<UploadIcon /> <span className=\"text-sm font-medium text"],
    ["A071", "<TextFileIcon /> <span className=\"text-sm font-medium te"],
    ["A071", "<FolderIcon /> <span className=\"text-sm font-medium text"],
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
  "src/app/properties/list-view.tsx": [
    ["A110", "{noLabel}"],
    ["A110", "{yesLabel}"],
  ],
  "src/app/properties/map/property-map.tsx": [
    ["A056", "{id === \"roadmap\" ? t(\"map.typeStreet\") : t(\"map.typeSat"],
    ["A062", "{t(\"mapTitle\")}"],
    ["A062", "{t(\"map.selectedPropertiesTab\")} <span className=\"ml-1.5"],
    ["A110", "{t(\"map.confirmDelete.cancel\")}"],
    ["A110", "{deleting ? t(\"map.confirmDelete.deleting\") : t(\"map.con"],
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
  ],
  "src/components/record-save-sync.tsx": [
    ["A110", "{t(\"confirmNo\")}"],
    ["A110", "{t(\"confirmYes\")}"],
  ],
  "src/components/screen/tile-positions-reset.tsx": [
    ["A020", "{t(\"defaults\")}"], // #38.12: the forms' „Implicit", for a screen with no checkbox bar
  ],
  "src/components/sidebar/sidebar-nav.tsx": [
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
