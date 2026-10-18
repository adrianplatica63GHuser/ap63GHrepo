/**
 * THE SKILLS INVENTORY — every skill a business user needs to master this archive.          (Slice #39.36)
 *
 * Adrian's request of 2026-10-14 (Diagram.of.skills.docx, in the slice's folder): a complete inventory of the
 * skills needed to master the application, in four levels — Basic, Intermediate, Advanced, Expert — grouped into
 * Paths, with arrows between them. An arrow A → B means A must be mastered before B can be approached.
 *
 * This file is the ONE place the inventory is written. Everything else is generated from it or checked against it:
 *   - `validate-graph.ts` proves the graph keeps Adrian's rules — `skills-catalogue.test.ts` runs it on this file;
 *   - `render-docx.ts` and `render-svg.ts` write the review copy (Skills.Inventory.docx, Skills.Graph.svg) —
 *     `scripts/skills/render-inventory.ts` puts them in the slice folder;
 *   - 39.41 stores a user's progress against `key`, and 39.42 draws the real diagram from this list.
 *
 * WHERE THE SKILLS COME FROM — what the application does today: the business-user test cases
 * (docs/testing/TEST-CATALOGUE.md), the sidebar (src/components/sidebar/nav-config.ts), the help registry's
 * screens (src/lib/help/registry.ts) and the structure of the last user manual. A skill is something a business
 * user can do or understand, in the application's own words. Running the system (Docker, the runner, migrations,
 * Supabase) is not a user skill and is not here.
 *
 * A SKILL'S IDENTITY — `number` („<level>.<n>”, the number shown in the box) may change whenever the inventory is
 * revised; `key` never changes, because a user's progress (39.41) is stored against it. Renumber freely; never
 * rename a key. A skill that is withdrawn takes its key with it — the key is not reused for another skill.
 *
 * THE NAMES ARE DATA, IN BOTH LOCALES, HERE (the slice header's item 1) — not next-intl messages. A skill's name is
 * part of its identity record, like a reference value, and it is read outside React: by the validator, by the
 * renderers and by the jest suites. When the diagram (39.42) puts them on a screen, it reads them from here.
 *
 * `screens` are help-registry keys, so a typo is a type error; `cases` are TEST-CATALOGUE ids, checked against
 * the catalogue's rows by `skills-catalogue.test.ts`, which also fails when a case or a help screen is covered by
 * no skill and is not listed, with its reason, in SKILLS_UNCOVERED_CASES.
 *
 * PURE — no I/O, no React.
 */

import type { HelpScreenKey } from "@/lib/help/registry";

export type SkillLevel = 1 | 2 | 3 | 4;

export type LocalisedText = { ro: string; en: string };

export type SkillLevelInfo = { level: SkillLevel; key: "basic" | "intermediate" | "advanced" | "expert"; name: LocalisedText };

export const SKILL_LEVELS: readonly SkillLevelInfo[] = [
  { level: 1, key: "basic", name: { ro: "De bază", en: "Basic" } },
  { level: 2, key: "intermediate", name: { ro: "Intermediar", en: "Intermediate" } },
  { level: 3, key: "advanced", name: { ro: "Avansat", en: "Advanced" } },
  { level: 4, key: "expert", name: { ro: "Expert", en: "Expert" } },
];

export type SkillPathKey = "persons" | "properties" | "documents" | "links" | "import" | "workspace";

export type SkillPath = { key: SkillPathKey; name: LocalisedText; description: LocalisedText };

/**
 * THE PATHS (Ask first 1: six, following the business). A Path is mastered when every Advanced and Expert skill
 * in it is mastered, so each one carries at least one of those (`path-without-mastery` in the validator).
 */
export const SKILL_PATHS: readonly SkillPath[] = [
  {
    key: "persons",
    name: { ro: "Persoane", en: "Persons" },
    description: {
      ro: "Persoanele fizice și juridice, identitatea lor, rudele și moștenirile.",
      en: "Natural and juridical persons, their identity, their relatives and inheritances.",
    },
  },
  {
    key: "properties",
    name: { ro: "Proprietăți și hartă", en: "Properties and the map" },
    description: {
      ro: "Proprietățile, forma lor pe hartă, măsurătorile și calculul drumului lateral.",
      en: "Properties, their shape on the map, measurements and the side-road calculation.",
    },
  },
  {
    key: "documents",
    name: { ro: "Acte", en: "Documents" },
    description: {
      ro: "Actele, paginile lor, tipurile, identificarea, părțile și actele care se sprijină pe alte acte.",
      en: "Documents, their pages, types, identification, parties, and the documents that rest on others.",
    },
  },
  {
    key: "links",
    name: { ro: "Legături și istoric", en: "Links and history" },
    description: {
      ro: "Legăturile dintre obiecte, clasificarea și conexiunile lor, versiunile și istoricul.",
      en: "The links between objects, their classification and connections, versions and history.",
    },
  },
  {
    key: "import",
    name: { ro: "Import și Distilare Tipizate", en: "Import and DocTypeEngine" },
    description: {
      ro: "Importul dosarelor de proprietate, ce citește AI-ul și învățarea unui tip nou de act.",
      en: "Importing property folders, what the AI reads, and teaching the application a new document type.",
    },
  },
  {
    key: "workspace",
    name: { ro: "Spațiul de lucru, rapoarte și administrare", en: "Workspace, reports and administration" },
    description: {
      ro: "Conectarea, listele, fișele, ajutorul, căutarea, interacțiunile, datele de referință și setările.",
      en: "Signing in, lists, tiles, help, search, interactions, reference data and settings.",
    },
  },
];

export type Skill = {
  /** Stable, never changes, never reused (39.41 stores progress against it). kebab-case. */
  key: string;
  /** „<level>.<n>” — shown in the box; may change when the inventory is revised. */
  number: string;
  level: SkillLevel;
  path: SkillPathKey;
  name: LocalisedText;
  description: LocalisedText;
  /** Keys of the skills that must be mastered before this one can be approached. */
  predecessors: readonly string[];
  /** The help-registry screens this skill is practised on. */
  screens: readonly HelpScreenKey[];
  /** The TEST-CATALOGUE cases that exercise it. */
  cases: readonly string[];
  /**
   * The manual sections it rests on, most important first (#39.43): where a user who fails its quiz reads
   * again, and what a Mastered box names. Section ids, never numbers — skills-quizzes.test.ts resolves each.
   */
  manual: readonly string[];
};

const DETAIL_SCREENS = [
  "natural-person-detail",
  "judicial-person-detail",
  "property-detail",
  "document-detail",
] as const satisfies readonly HelpScreenKey[];

export const SKILLS: readonly Skill[] = [
  // ── Level 1 — Basic ─────────────────────────────────────────────────────────────────────────────────────────
  {
    key: "workspace-sign-in-and-navigate",
    number: "1.1",
    level: 1,
    path: "workspace",
    name: {
      ro: "Conectează-te și orientează-te în bara laterală",
      en: "Sign in and find your way through the sidebar",
    },
    description: {
      ro: "Te conectezi, citești tabloul de bord, deschizi orice ecran din bara laterală și revii la ce ai văzut în „Recente”; îți schimbi parola și ieși.",
      en: "Sign in, read the dashboard, open any screen from the sidebar and go back to what you saw in „Recente”; change your password and sign out.",
    },
    predecessors: [],
    screens: ["dashboard"],
    cases: ["TC-AUTH-01", "TC-NAV-01", "TC-LAYOUT-04", "TC-ACCT-01"],
    manual: ["start-sign-in", "start-sidebar", "start-breadcrumb", "start-recent", "intro-purpose"],
  },
  {
    key: "workspace-find-in-a-list",
    number: "1.2",
    level: 1,
    path: "workspace",
    name: { ro: "Găsește un obiect într-o listă", en: "Find an object in a list" },
    description: {
      ro: "Cauți în lista persoanelor, a proprietăților sau a actelor, treci de la o pagină la alta, alegi coloanele din „Câmpuri afișate” și selectezi rânduri.",
      en: "Search the list of persons, properties or documents, page through it, choose its columns in „Câmpuri afișate” and select rows.",
    },
    predecessors: [],
    screens: ["natural-persons-list", "judicial-persons-list", "properties-list", "documents-list"],
    cases: ["TC-PROP-06", "TC-PERS-04", "TC-PERS-06", "TC-DOC-08", "TC-LAYOUT-02", "TC-LAYOUT-03", "TC-LAYOUT-05", "TC-PROP-14", "TC-PERS-12", "TC-PERS-13", "TC-DOC-27"],
    manual: ["start-lists", "start-example-find", "persons-list", "properties-list", "documents-list"],
  },
  {
    key: "workspace-read-a-record-screen",
    number: "1.3",
    level: 1,
    path: "workspace",
    name: {
      ro: "Citește ecranul unui obiect: fișele și bara de butoane",
      en: "Read an object's screen: its tiles and its button bar",
    },
    description: {
      ro: "Recunoști fișele unei persoane, ale unei proprietăți sau ale unui act, le alegi cu bifele, găsești ID-ul de sistem, citești numele butoanelor cu pictogramă și folosești creionul, salvarea și coșul.",
      en: "Recognise the tiles of a person, a property or a document, pick them with the tick boxes, find the system ID, read the names of the icon buttons, and use the pencil, save and bin.",
    },
    predecessors: [],
    screens: DETAIL_SCREENS,
    cases: [
      "TC-TILES-01",
      "TC-TILES-02",
      "TC-TILES-03",
      "TC-TILES-04",
      "TC-TILES-07",
      "TC-TILES-14",
      "TC-TILES-23",
      "TC-SYSID-01",
      "TC-ICON-01",
      "TC-ICON-02",
      "TC-ICON-07",
      "TC-FOLD-01",
    ],
    manual: ["start-tiles", "intro-objects", "start-preview", "admin-settings-account"],
  },
  {
    key: "workspace-read-help",
    number: "1.4",
    level: 1,
    path: "workspace",
    name: {
      ro: "Citește ajutorul: „?”, indiciile cu bec și manualul de utilizare",
      en: "Read the help: „?”, the light-bulb hints and the user manual",
    },
    description: {
      ro: "Deschizi „?” pe un ecran, citești la ce folosește ecranul și cum se lucrează pe el, găsești indiciile cu bec pentru gesturile care nu se văd și cauți în „Manual de utilizare” ce nu știi, după capitol sau după numărul unei secțiuni.",
      en: "Open a screen's „?”, read what the screen is for and how it is worked, find the light-bulb hints for the gestures you cannot see, and look up what you do not know in „Manual de utilizare”, by chapter or by a section's number.",
    },
    predecessors: [],
    // #39.37: + the manual's screen and its case.
    // #39.42: and the skills map with its quiz page — the help screens it is practised on; the skill is unchanged.
    // #39.43: and the quiz itself, TC-SKILL-02. #39.45: and „Întreabă”, its screen and TC-HELP-03. #39.50: a Path in
    // the map's two views, TC-SKILL-03.
    screens: ["dashboard", "manual", "skills-map", "skill-quiz", "ask"],
    cases: ["TC-HELP-01", "TC-HELP-02", "TC-SKILL-01", "TC-SKILL-02", "TC-HELP-03", "TC-SKILL-03"],
    manual: ["start-help", "learning-help", "learning-manual", "intro-how-to-read"],
  },
  {
    key: "persons-add-natural-person-by-hand",
    number: "1.5",
    level: 1,
    path: "persons",
    name: { ro: "Adaugă o persoană fizică de mână", en: "Add a natural person by hand" },
    description: {
      ro: "Creezi o persoană fizică din „Adaugă persoană”, îi completezi identitatea și o regăsești în listă.",
      en: "Create a natural person from „Adaugă persoană”, fill in their identity and find them again in the list.",
    },
    predecessors: [],
    screens: ["natural-persons-list", "natural-person-detail"],
    cases: ["TC-PERS-01"],
    manual: ["persons-add", "persons-add-save", "persons-add-tiles", "persons-list"],
  },
  {
    key: "persons-add-judicial-person",
    number: "1.6",
    level: 1,
    path: "persons",
    name: { ro: "Adaugă și modifică o persoană juridică", en: "Add and edit a juridical person" },
    description: {
      ro: "Creezi o firmă, îi scrii telefonul, e-mailul și persoana de contact și o modifici mai târziu.",
      en: "Create a firm, record its phone, e-mail and contact person, and edit it later.",
    },
    predecessors: [],
    screens: ["judicial-persons-list", "judicial-person-detail"],
    cases: ["TC-PERS-02", "TC-PERS-09", "TC-PERS-14"],
    manual: ["companies-add", "companies-add-contact", "companies-people-contact", "companies-add-edit", "companies-add-identity"],
  },
  {
    key: "properties-add-property-by-hand",
    number: "1.7",
    level: 1,
    path: "properties",
    name: { ro: "Adaugă o proprietate de mână", en: "Add a property by hand" },
    description: {
      ro: "Creezi o proprietate, îi alegi tipul și citești în titlu ce fișe arată acel tip; o a doua proprietate pentru aceeași parcelă este refuzată.",
      en: "Create a property, choose its type and read in the heading which tiles that type shows; a second property for the same parcel is refused.",
    },
    predecessors: [],
    // Slice #39.67: a tarla belongs to a locality — its pages and the case of two T50.
    screens: ["properties-list", "property-detail", "tarla-list", "tarla-detail"],
    cases: ["TC-PROP-01", "TC-PROP-05", "TC-PROP-11", "TC-PROP-12", "TC-PROP-16"],
    manual: ["properties-add", "properties-type", "properties-add-one-parcel", "properties-add-cadastral", "properties-type-hidden"],
  },
  {
    key: "properties-read-the-map",
    number: "1.8",
    level: 1,
    path: "properties",
    name: { ro: "Citește harta proprietăților", en: "Read the properties map" },
    description: {
      ro: "Deschizi „Hartă completă” din lista proprietăților sau harta unei proprietăți, te miști și mărești, deschizi o parcelă din bula ei și pornești „Navighează” spre ea.",
      en: "Open „Hartă completă” from the property list or a property's map, move and zoom, open a parcel from its bubble and start „Navighează” to it.",
    },
    predecessors: [],
    screens: ["properties-map"],
    cases: ["TC-MAP-01", "TC-PROP-10", "TC-PROP-13", "TC-MAP-05", "TC-MAP-06"],
    manual: ["map-what-open", "map-what-bubble", "map-what", "properties-navigate", "map-select"],
  },
  {
    key: "documents-create-document",
    number: "1.9",
    level: 1,
    path: "documents",
    name: { ro: "Creează un act și atașează-i paginile", en: "Create a document and attach its pages" },
    description: {
      ro: "Creezi un act, îi dai o etichetă scurtă, îi atașezi paginile chiar înainte de prima salvare și îl ștergi dacă a fost creat din greșeală.",
      en: "Create a document, give it a short label, attach its pages even before the first save, and delete it if it was created by mistake.",
    },
    predecessors: [],
    screens: ["documents-list", "document-detail"],
    cases: ["TC-DOC-01", "TC-DOC-14", "TC-DOC-26"],
    manual: ["documents-add", "documents-add-pages", "documents-add-delete", "documents-identification", "documents-list"],
  },
  {
    key: "documents-read-pages",
    number: "1.10",
    level: 1,
    path: "documents",
    name: { ro: "Citește paginile unui act", en: "Read a document's pages" },
    description: {
      ro: "Mărești o pagină, o rotești, îi scrii notițe cu creionul „Notițe pagină” și recunoști o pagină al cărei fișier lipsește.",
      en: "Zoom into a page, rotate it, write notes on it with the „Notițe pagină” pencil, and recognise a page whose file is missing.",
    },
    predecessors: [],
    screens: ["document-detail"],
    cases: ["TC-DOC-12", "TC-DOC-17", "TC-DOC-24", "TC-DOC-25"],
    manual: ["documents-add-read", "documents-add-rotate", "documents-add"],
  },
  {
    key: "documents-choose-document-type",
    number: "1.11",
    level: 1,
    path: "documents",
    name: {
      ro: "Recunoaște tipurile de acte și alege tipul unui act",
      en: "Recognise the document types and choose a document's type",
    },
    description: {
      ro: "Cauți în „Tip document” după o parte din nume, fără diacritice, citești denumirea scurtă a tipului în listă și pe cea întreagă în bulă și știi ce tipuri au formular.",
      en: "Search „Tip document” by part of a name, without diacritics, read the type's short name in the list and its full name in the bubble, and know which types have a form.",
    },
    predecessors: [],
    screens: ["documents-list", "document-detail"],
    cases: ["TC-DOC-15", "TC-DOC-16", "TC-DOC-21", "TC-DOC-23"],
    manual: ["documents-type", "documents-list", "admin-reference-data-document-types", "documents-identification"],
  },
  {
    key: "links-associate-two-records",
    number: "1.12",
    level: 1,
    path: "links",
    name: { ro: "Asociază două obiecte", en: "Link two objects" },
    description: {
      ro: "De pe un obiect deschizi ecranul de asociere, cauți, alegi din „Rezultate” și asociezi; mai târziu dezasociezi.",
      en: "From an object, open the association screen, search, pick from „Rezultate” and link; later, unlink.",
    },
    predecessors: [],
    screens: ["associate-person", "associate-document", "associate-property"],
    cases: ["TC-ASSOC-13", "TC-ICON-03"],
    manual: ["links-associate-screen", "links-associate-remove", "links-associate-role", "links-associate", "links-associate-kinds"],
  },
  {
    key: "links-read-related-tile",
    number: "1.13",
    level: 1,
    path: "links",
    name: { ro: "Citește fișa „Legături”", en: "Read the „Legături” tile" },
    description: {
      ro: "Vezi într-o singură fișă persoanele, proprietățile și actele legate de un obiect și citești relația fiecăreia.",
      en: "See in one tile the persons, properties and documents linked to an object, and read each one's relation.",
    },
    predecessors: [],
    screens: DETAIL_SCREENS,
    cases: ["TC-PROP-07", "TC-PERS-05", "TC-DOC-10"],
    manual: ["links-related", "start-tiles", "links-associate-role", "start-preview"],
  },
  {
    key: "links-read-version-history",
    number: "1.14",
    level: 1,
    path: "links",
    name: { ro: "Citește istoricul versiunilor unui obiect", en: "Read an object's version history" },
    description: {
      ro: "Știi că fiecare salvare face o versiune nouă, vezi contorul de versiuni crescând și te miști înapoi și înainte printre versiuni.",
      en: "Know that every save makes a new version, watch the version counter rise, and step back and forth through the versions.",
    },
    predecessors: [],
    screens: DETAIL_SCREENS,
    cases: ["TC-PROP-02"],
    manual: ["links-versions", "intro-versions", "links-example-version", "links-classify-classification"],
  },
  {
    key: "import-prepare-folder",
    number: "1.15",
    level: 1,
    path: "import",
    name: { ro: "Pregătește un dosar de proprietate pentru import", en: "Prepare a property folder for import" },
    description: {
      ro: "Știi cum trebuie să arate dosarul și fișierele lui și citești pașii „Informare”, „Precondiții”, „Structură” și „Restricții” de la începutul importului.",
      en: "Know what the folder and its files must look like, and read the „Informare”, „Precondiții”, „Structură” and „Restricții” steps at the start of the import.",
    },
    predecessors: [],
    screens: ["admin-import"],
    cases: ["TC-ICON-06"],
    manual: ["import-folder-structure", "import-folder-files", "import-folder-shared", "import-overview", "import-folder"],
  },
  {
    key: "workspace-global-search",
    number: "1.16",
    level: 1,
    path: "workspace",
    name: { ro: "Găsește orice cu „Căutare globală”", en: "Find anything with „Căutare globală”" },
    description: {
      ro: "Cauți într-un singur loc persoanele, proprietățile și actele și deschizi ce ai găsit.",
      en: "Search persons, properties and documents in one place and open what you found.",
    },
    predecessors: [],
    screens: ["admin-global-search"],
    cases: ["TC-SRCH-01"],
    manual: ["reports-search-filters", "reports-search", "reports-search-results", "reports-example-tag", "start-sidebar"],
  },
  {
    key: "workspace-log-an-interaction",
    number: "1.17",
    level: 1,
    path: "workspace",
    name: { ro: "Înregistrează de mână o interacțiune", en: "Log an interaction by hand" },
    description: {
      ro: "Notezi un apel telefonic, o întâlnire sau un mesaj cu o persoană, fără niciun cont conectat, în cele cinci secțiuni ale formularului.",
      en: "Record a phone call, a meeting or a message with a person, with no account connected, in the form's five sections.",
    },
    predecessors: [],
    screens: ["interactions"],
    cases: ["TC-INT-02", "TC-INT-07"],
    manual: ["reports-interactions-log", "persons-interactions", "reports-interactions-links", "reports-interactions"],
  },

  // ── Level 2 — Intermediate ──────────────────────────────────────────────────────────────────────────────────
  {
    key: "persons-person-from-id-card",
    number: "2.1",
    level: 2,
    path: "persons",
    name: { ro: "Adaugă o persoană fizică dintr-o carte de identitate", en: "Add a natural person from an identity card" },
    description: {
      ro: "Din „Adaugă persoană” citești o carte de identitate și primești persoana completată, cu tatăl și mama create și legate ca „Tată” și „Mamă”.",
      en: "From „Adaugă persoană”, read an identity card and get the person filled in, with the father and mother created and linked as „Tată” and „Mamă”.",
    },
    predecessors: ["persons-add-natural-person-by-hand", "documents-read-pages"],
    screens: ["natural-persons-list", "natural-person-detail"],
    cases: ["TC-PERS-08"],
    manual: ["persons-id-card-manual", "persons-id-card-document", "persons-id-card", "persons-example-parents", "import-scanning-people"],
  },
  {
    key: "persons-keep-identity-current",
    number: "2.2",
    level: 2,
    path: "persons",
    name: {
      ro: "Ține identitatea unei persoane la zi: CNP-ul și decesul",
      en: "Keep a person's identity current: the CNP and a death",
    },
    description: {
      ro: "Știi de ce un CNP salvat nu se mai schimbă, bifezi „Decedat” cu data decesului și vezi vârsta oprindu-se la deces.",
      en: "Know why a saved CNP cannot change, tick „Decedat” with the date of death, and see the age stop at death.",
    },
    predecessors: ["persons-add-natural-person-by-hand", "links-read-version-history"],
    screens: ["natural-person-detail"],
    cases: ["TC-PERS-03", "TC-PERS-11"],
    manual: ["persons-identity-cnp", "persons-identity-death", "persons-example-death", "links-versions"],
  },
  {
    key: "persons-link-relatives",
    number: "2.3",
    level: 2,
    path: "persons",
    name: { ro: "Leagă rudele unei persoane", en: "Link a person's relatives" },
    description: {
      ro: "Legi două persoane ca părinte și copil sau ca rude și citești legătura corect din ambele capete, inclusiv în fișa „Arbore de moștenire” a persoanei.",
      en: "Link two persons as parent and child or as relatives, and read the link correctly from both ends, including in the person's „Arbore de moștenire” tile.",
    },
    predecessors: ["persons-add-natural-person-by-hand", "links-associate-two-records"],
    screens: ["natural-person-detail", "associate-person"],
    cases: ["TC-ASSOC-09", "TC-INHER-02"],
    manual: ["persons-relatives-link", "persons-relatives-tree", "links-associate-role", "persons-example-tree", "links-associate-remove"],
  },
  {
    key: "properties-draw-corners",
    number: "2.4",
    level: 2,
    path: "properties",
    name: { ro: "Desenează și corectează colțurile unei parcele", en: "Draw and correct a parcel's corners" },
    description: {
      ro: "Desenezi forma pe „Hartă”, închizi poligonul, tragi un colț, editezi un punct în „Puncte de contur” și vezi suprafața calculată după salvare.",
      en: "Draw the shape on „Hartă”, close the polygon, drag a corner, edit a point in „Puncte de contur” and see the calculated area after saving.",
    },
    predecessors: ["properties-add-property-by-hand", "properties-read-the-map"],
    screens: ["property-detail"],
    cases: ["TC-PROP-04", "TC-PROP-08", "TC-PROP-09", "TC-ICON-04"],
    manual: ["properties-corners-draw", "properties-corners-table", "properties-corners-map", "properties-example-draw", "properties-example-corner"],
  },
  {
    key: "properties-from-coordinate-file",
    number: "2.5",
    level: 2,
    path: "properties",
    name: { ro: "Creează o parcelă dintr-un fișier cu coordonate", en: "Create a parcel from a coordinate file" },
    description: {
      ro: "Încarci un fișier cu colțurile unei parcele și primești proprietatea cu forma ei pe hartă și cu suprafața calculată.",
      en: "Load a file with a parcel's corners and get the property with its shape on the map and its area calculated.",
    },
    predecessors: ["properties-add-property-by-hand", "properties-read-the-map"],
    screens: ["properties-list", "property-detail"],
    cases: ["TC-PROP-03", "TC-PROP-15"],
    manual: ["properties-coord-file", "properties-example-file", "properties-corners-table"],
  },
  {
    key: "documents-fill-identification",
    number: "2.6",
    level: 2,
    path: "documents",
    name: { ro: "Completează identificarea și detaliile unui act", en: "Fill in a document's identification and details" },
    description: {
      ro: "Scrii emitentul, numărul și data în „Identificarea actului”, completezi câmpurile tipului și listele lui derulante și citești „Fără valoare” acolo unde nu e nimic ales.",
      en: "Write the issuer, number and date in „Identificarea actului”, fill in the type's fields and drop-down lists, and read „Fără valoare” where nothing is chosen.",
    },
    predecessors: ["documents-create-document", "documents-read-pages", "documents-choose-document-type"],
    screens: ["document-detail"],
    cases: ["TC-DOC-02", "TC-DOC-03", "TC-DOC-04", "TC-DOC-06", "TC-DOC-18"],
    manual: ["documents-identification", "documents-type", "documents-sale", "documents-list", "documents-example-sale"],
  },
  {
    key: "documents-add-parties",
    number: "2.7",
    level: 2,
    path: "documents",
    name: { ro: "Adaugă părțile unui act, cu rol și cotă-parte", en: "Add a document's parties, with role and share" },
    description: {
      ro: "Legi persoane fizice și firme de un act, fiecare cu rolul ei, și scrii cota-parte doar pentru rolurile care dețin o cotă.",
      en: "Link natural persons and firms to a document, each with its role, and write the share only for the roles that hold one.",
    },
    predecessors: ["persons-add-judicial-person", "documents-choose-document-type", "links-associate-two-records"],
    screens: ["document-detail", "associate-party"],
    cases: ["TC-ASSOC-01", "TC-ASSOC-10", "TC-DOC-07", "TC-DOC-09"],
    manual: ["documents-parties", "links-associate-role", "companies-people-records", "links-associate-kinds", "links-associate-remove"],
  },
  {
    key: "links-link-records-both-ways",
    number: "2.8",
    level: 2,
    path: "links",
    name: {
      ro: "Leagă actele, proprietățile și persoanele din orice direcție",
      en: "Link documents, properties and persons from either end",
    },
    description: {
      ro: "Legi un act de o proprietate, o persoană de o proprietate, cu rol, sau o persoană fizică de o firmă, pornind din oricare dintre ele, și citești legătura din ambele capete.",
      en: "Link a document to a property, a person to a property with a role, or a natural person to a firm, starting from either of them, and read the link from both ends.",
    },
    predecessors: ["persons-add-judicial-person", "links-associate-two-records", "workspace-global-search"],
    screens: ["associate-person", "associate-document", "associate-property"],
    cases: ["TC-ASSOC-02", "TC-ASSOC-03", "TC-ASSOC-04", "TC-ASSOC-05", "TC-ASSOC-06", "TC-ASSOC-11"],
    manual: ["links-associate-kinds", "links-associate-screen", "links-related", "links-example-owner", "companies-people-representatives"],
  },
  {
    key: "links-references-and-parts",
    number: "2.9",
    level: 2,
    path: "links",
    name: {
      ro: "Leagă un act de înscrisul citat și o proprietate de cea care o cuprinde",
      en: "Link a document to the deed it cites, and a property to the one it is part of",
    },
    description: {
      ro: "Faci legături care au un sens — un act care citează alt înscris, o proprietate inclusă în alta — și le citești corect din ambele capete.",
      en: "Make links that have a direction — a document citing another deed, a property included in another — and read them correctly from both ends.",
    },
    predecessors: ["links-associate-two-records", "links-read-related-tile"],
    screens: ["associate-reference"],
    cases: ["TC-ASSOC-07", "TC-ASSOC-08"],
    manual: ["links-references-documents", "links-references-properties", "links-references", "links-example-title", "links-related"],
  },
  {
    key: "links-restore-a-version",
    number: "2.10",
    level: 2,
    path: "links",
    name: { ro: "Întoarce un obiect la o versiune mai veche", en: "Return an object to an earlier version" },
    description: {
      ro: "Mergi înapoi la o versiune, o compari cu cea curentă și o faci din nou curentă cu „Fă curentă”, fără să pierzi celelalte versiuni.",
      en: "Go back to a version, compare it with the current one and make it current again with „Fă curentă”, without losing the other versions.",
    },
    predecessors: ["workspace-read-a-record-screen", "links-read-version-history"],
    screens: DETAIL_SCREENS,
    cases: ["TC-VER-01", "TC-VER-02"],
    manual: ["links-versions", "links-example-version", "intro-versions"],
  },
  {
    key: "links-classify-and-tag",
    number: "2.11",
    level: 2,
    path: "links",
    name: { ro: "Clasifică un obiect și pune-i etichete", en: "Classify an object and tag it" },
    description: {
      ro: "Alegi importanța, relevanța și proveniența în „Clasificare”, pui și scoți etichete în „Etichete și grupuri”, găsești obiectele după o etichetă și, în norul etichetelor, redenumești și unești etichete.",
      en: "Choose importance, relevance and provenance in „Clasificare”, add and remove tags in „Etichete și grupuri”, find objects by a tag and, in the tag cloud, rename and merge tags.",
    },
    predecessors: ["workspace-read-a-record-screen", "links-read-related-tile"],
    screens: ["admin-tags"],
    cases: [
      "TC-TILES-08",
      "TC-TILES-09",
      "TC-TILES-10",
      "TC-TILES-16",
      "TC-TILES-17",
      "TC-TAG-01",
      "TC-TAG-02",
      "TC-TAG-03",
      "TC-ICON-05",
    ],
    manual: ["links-classify-tags", "links-classify-classification", "admin-groups-tags", "reports-search-filters", "reports-example-tag"],
  },
  {
    key: "import-run-an-import",
    number: "2.12",
    level: 2,
    path: "import",
    name: { ro: "Rulează un import pas cu pas, până la „Rezultat”", en: "Run an import step by step, to „Rezultat”" },
    description: {
      ro: "Alegi dosarul, treci prin „Duplicate”, „Deja în sistem”, „Scanare” și „Evaluare” și citești în „Rezultat” ce acte și pagini au intrat în arhivă.",
      en: "Pick the folder, go through „Duplicate”, „Deja în sistem”, „Scanare” and „Evaluare”, and read in „Rezultat” which documents and pages entered the archive.",
    },
    predecessors: ["workspace-read-help", "documents-create-document", "import-prepare-folder"],
    screens: ["admin-import"],
    cases: ["TC-IMP-01"],
    manual: ["import-overview", "import-duplicates", "import-scanning-classify", "import-result-evaluation", "import-result-report"],
  },
  {
    key: "workspace-arrange-tiles",
    number: "2.13",
    level: 2,
    path: "workspace",
    name: { ro: "Așază fișele și previzualizează alături", en: "Arrange the tiles and preview side by side" },
    description: {
      ro: "Tragi o fișă într-un loc liber, o urci cu dublu-clic, deschizi un obiect legat ca previzualizare lângă cel pe care lucrezi și, dintr-o listă, lângă tabel.",
      en: "Drag a tile into a free place, raise it with a double-click, open a linked object as a preview beside the one you are working on and, from a list, beside the table.",
    },
    predecessors: ["workspace-sign-in-and-navigate", "workspace-find-in-a-list", "workspace-read-a-record-screen"],
    screens: DETAIL_SCREENS,
    cases: [
      "TC-TILES-05",
      "TC-TILES-06",
      "TC-TILES-11",
      "TC-TILES-12",
      "TC-TILES-13",
      "TC-TILES-15",
      "TC-TILES-18",
      "TC-TILES-19",
      "TC-TILES-20",
      "TC-TILES-21",
      "TC-TILES-22",
    ],
    manual: ["start-tiles", "start-preview", "links-related", "admin-settings-account"],
  },
  {
    key: "workspace-read-interaction-history",
    number: "2.14",
    level: 2,
    path: "workspace",
    name: { ro: "Citește și filtrează istoricul interacțiunilor", en: "Read and filter the interaction history" },
    description: {
      ro: "Citești interacțiunile, cele mai noi întâi, le filtrezi din bara de unelte și din coloane și le vezi pe fișa „Interacțiuni” a unei persoane.",
      en: "Read the interactions, newest first, filter them from the toolbar and the columns, and see them on a person's „Interacțiuni” tile.",
    },
    predecessors: ["workspace-find-in-a-list", "workspace-log-an-interaction"],
    screens: ["interactions", "natural-person-detail", "judicial-person-detail"],
    cases: ["TC-INT-01", "TC-INT-06", "TC-PERS-07"],
    manual: ["reports-interactions-history", "reports-interactions-person", "persons-interactions", "reports-example-reply"],
  },
  {
    key: "links-groups-and-stamps",
    number: "2.15",
    level: 2,
    path: "links",
    name: { ro: "Strânge obiecte în grupuri și aplică-le ștampile", en: "Gather objects into groups and stamp them" },
    description: {
      ro: "Faci un grup de proprietăți, vezi câți membri are și de ce o proprietate intră în cel mult trei grupuri, creezi o ștampilă și o aplici unei persoane, apoi le regăsești din ambele capete.",
      en: "Make a group of properties, see how many members it has and why a property joins at most three groups, create a stamp and apply it to a person, then find both again from either end.",
    },
    predecessors: ["workspace-find-in-a-list", "links-read-related-tile"],
    screens: ["admin-groups", "admin-group-editor", "admin-stamps", "admin-stamp-applicator"],
    cases: ["TC-GRP-01", "TC-GRP-02", "TC-GRP-03", "TC-GRP-04", "TC-STAMP-01", "TC-STAMP-02", "TC-MAP-07"],
    manual: ["links-classify-groups", "links-classify-stamps", "admin-groups-groups", "admin-groups-stamps", "reports-search-filters"],
  },

  // ── Level 3 — Advanced ──────────────────────────────────────────────────────────────────────────────────────
  {
    key: "persons-id-card-from-the-archive",
    number: "3.1",
    level: 3,
    path: "persons",
    name: {
      ro: "Creează persoanele dintr-o carte de identitate aflată deja în arhivă",
      en: "Create the persons from an identity card already in the archive",
    },
    description: {
      ro: "Pe actul unei cărți de identitate apeși „Creează persoane din CI”: titularul e legat de act, apoi tatăl și mama, fiecare verificat înainte de a fi creat.",
      en: "On an identity card's document, press „Creează persoane din CI”: the holder is linked to the document, then the father and mother, each checked before it is created.",
    },
    predecessors: ["persons-person-from-id-card", "persons-link-relatives"],
    screens: ["document-detail", "natural-person-detail"],
    cases: ["TC-PERS-10"],
    manual: ["persons-id-card-document", "import-scanning-people", "persons-id-card", "persons-identity-cnp"],
  },
  {
    key: "persons-read-inheritance-tree",
    number: "3.2",
    level: 3,
    path: "persons",
    name: { ro: "Citește arborele de moștenire al unei familii", en: "Read a family's inheritance tree" },
    description: {
      ro: "Deschizi „Arbori de moștenire”, schimbi cu rotița câte generații vezi, citești fiecare familie pe banda ei și deschizi o persoană din arbore.",
      en: "Open „Arbori de moștenire”, change with the wheel how many generations you see, read each family on its own lane, and open a person from the tree.",
    },
    predecessors: ["persons-keep-identity-current", "persons-link-relatives"],
    screens: ["natural-person-detail"],
    cases: ["TC-INHER-01"],
    manual: ["reports-inheritance-levels", "reports-inheritance", "persons-relatives-tree"],
  },
  {
    key: "properties-measure-on-the-map",
    number: "3.3",
    level: 3,
    path: "properties",
    name: {
      ro: "Măsoară pe hartă: rigla, unghiurile și suprafața unei zone",
      en: "Measure on the map: the ruler, the angles and an area",
    },
    description: {
      ro: "Măsori o distanță cu rigla, citești unghiurile la colțuri și afli suprafața unei zone delimitate de colțurile unei proprietăți sau a unui poligon desenat liber, din „Instrumente → Calcul suprafață”.",
      en: "Measure a distance with the ruler, read the angles at the corners, and find the area of a zone bounded by a property's corners or by a polygon drawn freely, from „Instrumente → Calcul suprafață”.",
    },
    predecessors: ["properties-read-the-map", "properties-draw-corners"],
    screens: ["properties-map"],
    cases: ["TC-MAP-02", "TC-MAP-03", "TC-MAP-04"],
    manual: ["map-area-delimited", "map-area-free", "map-area", "map-ruler-distance", "map-ruler-angles"],
  },
  {
    key: "properties-side-road-calculation",
    number: "3.4",
    level: 3,
    path: "properties",
    name: {
      ro: "Calculează un drum lateral pe un teren și citește istoricul calculului",
      en: "Calculate a side road on a plot and read the calculation's history",
    },
    description: {
      ro: "Încarci fișierul de împărțire, citești previzualizarea, care nu e încă salvată, salvezi calculul și îl regăsești în istoric.",
      en: "Load the division file, read the preview, which is not saved yet, save the calculation and find it again in the history.",
    },
    predecessors: ["properties-draw-corners", "properties-from-coordinate-file"],
    screens: ["admin-calculation", "admin-calculation-history", "admin-calculation-run"],
    cases: ["TC-CALC-01"],
    manual: ["tools-side-road", "tools-side-road-file", "tools-side-road-road", "tools-side-road-create", "tools-side-road-history"],
  },
  {
    key: "documents-sale-contract",
    number: "3.5",
    level: 3,
    path: "documents",
    name: { ro: "Procesează un contract de vânzare-cumpărare", en: "Work a sale contract" },
    description: {
      ro: "Pui vânzătorii și cumpărătorii pe grupe, cu cota lor, compui „Obiectul vânzării” din proprietăți și îl recompui după o schimbare; te orientezi în filele și panourile formularului.",
      en: "Put the sellers and the buyers in their groups, with their shares, compose „Obiectul vânzării” from the properties and recompose it after a change; find your way through the form's tabs and panels.",
    },
    predecessors: ["documents-fill-identification", "documents-add-parties"],
    screens: ["document-detail"],
    cases: ["TC-DOC-05", "TC-DOC-19", "TC-DOC-22"],
    manual: ["documents-sale", "documents-parties", "documents-example-sale", "links-related", "documents-type"],
  },
  {
    key: "documents-addendum-and-certificate",
    number: "3.6",
    level: 3,
    path: "documents",
    name: {
      ro: "Procesează actele care se sprijină pe alte acte: actul adițional și certificatul de moștenitor",
      en: "Work the documents that rest on others: the addendum and the certificate of inheritance",
    },
    description: {
      ro: "Legi actul adițional de contractul pe care îl modifică, pui pe un certificat de moștenitor defunctul și moștenitorii ca părți și știi de ce antecontractul are alt formular decât contractul.",
      en: "Link the addendum to the contract it amends, put the deceased and the heirs on a certificate of inheritance as parties, and know why the preliminary contract has a different form from the contract.",
    },
    predecessors: ["documents-add-parties", "links-references-and-parts"],
    screens: ["document-detail", "associate-reference", "associate-party"],
    cases: ["TC-DOC-11", "TC-DOC-20", "TC-ASSOC-12", "TC-ASSOC-14"],
    // #39.47: the antecontract's section in place of the certificate's worked example, so the skill's „de ce
    // antecontractul are alt formular” is taught and asked.
    manual: ["documents-dependent-addendum", "documents-dependent-inheritance", "links-references-documents", "documents-antecontract", "documents-parties"],
  },
  {
    key: "links-follow-a-chain",
    number: "3.7",
    level: 3,
    path: "links",
    name: {
      ro: "Urmărește un lanț de la un act la fiecare parcelă și persoană atinsă",
      en: "Follow a chain from a document to every parcel and person it touches",
    },
    description: {
      ro: "Pornești de la un act sau de la o persoană și, din „Legături” în „Legături”, ajungi la fiecare proprietate, persoană și înscris citat legate de el.",
      en: "Start from a document or a person and, from „Legături” to „Legături”, reach every property, person and cited deed linked to it.",
    },
    predecessors: ["workspace-global-search", "links-link-records-both-ways", "links-references-and-parts"],
    screens: DETAIL_SCREENS,
    cases: ["TC-PROP-07", "TC-PERS-05", "TC-DOC-10"],
    manual: ["links-related", "links-references-documents", "links-references-properties", "links-associate-kinds", "documents-dependent-inheritance"],
  },
  {
    key: "links-work-in-two-windows",
    number: "3.8",
    level: 3,
    path: "links",
    name: { ro: "Lucrează în siguranță în două ferestre", en: "Work safely in two windows" },
    description: {
      ro: "Deschizi același obiect în două ferestre, vezi cum cealaltă urmează și înțelegi de ce o salvare învechită este refuzată în loc să șteargă munca altcuiva.",
      en: "Open the same object in two windows, watch the other one follow, and understand why a stale save is refused rather than wiping out someone else's work.",
    },
    predecessors: ["links-restore-a-version", "workspace-arrange-tiles"],
    screens: DETAIL_SCREENS,
    cases: ["TC-TABS-01", "TC-INT-04"],
    manual: ["links-two-windows", "reports-interactions-edit", "start-preview", "links-versions"],
  },
  {
    key: "import-big-and-special-folders",
    number: "3.9",
    level: 3,
    path: "import",
    name: {
      ro: "Importă dosare mari, dosare deja importate și dosarele „comune” și „flotante”",
      en: "Import big folders, folders already imported, and the „comune” and „flotante” folders",
    },
    description: {
      ro: "Reiei un dosar deja importat și citești „Deja în sistem”, imporți cinci proprietăți deodată și știi unde ajung fișierele din „comune” și din „flotante”.",
      en: "Take up a folder already imported and read „Deja în sistem”, import five properties at once, and know where the files in „comune” and „flotante” end up.",
    },
    predecessors: ["import-prepare-folder", "import-run-an-import"],
    screens: ["admin-import"],
    cases: ["TC-IMP-02", "TC-IMP-03", "TC-IMP-04"],
    manual: ["import-duplicates-archive", "import-folder-shared", "import-folder-structure", "import-example-again", "import-result-run"],
  },
  {
    key: "import-check-the-ai-reading",
    number: "3.10",
    level: 3,
    path: "import",
    name: {
      ro: "Verifică ce a citit AI-ul la import și confirmă părțile propuse",
      en: "Check what the AI read during an import and confirm the proposed parties",
    },
    description: {
      ro: "Citești panourile completate de AI pe un contract, confirmi sau corectezi părțile pe care le propune și imporți o carte de identitate cu părinții titularului.",
      en: "Read the panels the AI filled in on a contract, confirm or correct the parties it proposes, and import an identity card with the holder's parents.",
    },
    predecessors: ["documents-add-parties", "import-run-an-import"],
    screens: ["admin-import"],
    cases: ["TC-AI-01", "TC-IMP-05", "TC-IMP-06"],
    manual: ["import-scanning-read", "import-scanning-people", "documents-identification", "documents-sale", "persons-id-card-document"],
  },
  {
    key: "workspace-reference-data",
    number: "3.11",
    level: 3,
    path: "workspace",
    name: {
      ro: "Administrează datele de referință: valori, roluri și tipuri de acte",
      en: "Manage the reference data: values, roles and document types",
    },
    description: {
      ro: "Adaugi, redenumești, unești și ștergi valori, configurezi un rol și legăturile lui și pui pe pagina unui tip de act formularul și rolurile lui.",
      en: "Add, rename, merge and delete values, configure a role and its links, and set a document type's form and roles on its page.",
    },
    predecessors: ["documents-choose-document-type", "documents-add-parties"],
    screens: ["admin-value-lists"],
    cases: [
      "TC-VL-01",
      "TC-VL-02",
      "TC-VL-03",
      "TC-VL-04",
      "TC-VL-05",
      "TC-VL-06",
      "TC-VL-07",
      "TC-VL-08",
      "TC-VL-09",
      "TC-VL-10",
      "TC-VL-11",
    ],
    manual: ["admin-reference-data-values", "admin-reference-data-roles", "admin-reference-data-document-types", "admin-reference-data", "admin-example-role"],
  },
  {
    key: "workspace-settings-and-users",
    number: "3.12",
    level: 3,
    path: "workspace",
    name: { ro: "Ajustează aplicația: setări, implicite și utilizatori", en: "Fit the application: settings, defaults and users" },
    description: {
      ro: "Schimbi o setare și o pui la loc exact, salvezi setul tău de fișe în „Implicitele mele”, alegi furnizorii din „Costuri” și răspunzi unei cereri de acces.",
      en: "Change a setting and put it back exactly, save your own set of tiles in „Implicitele mele”, choose the providers in „Costuri”, and answer an access request.",
    },
    predecessors: ["workspace-sign-in-and-navigate", "workspace-arrange-tiles"],
    screens: ["admin-settings", "admin-users"],
    cases: ["TC-SET-01", "TC-SET-02", "TC-SET-03", "TC-SET-04", "TC-USERS-01", "TC-AUTH-02"],
    manual: ["admin-settings-thresholds", "admin-settings-account", "admin-settings-costs", "admin-users", "admin-example-threshold"],
  },
  {
    key: "workspace-write-help",
    number: "3.13",
    level: 3,
    path: "workspace",
    name: { ro: "Scrie textele de ajutor ale unui ecran", en: "Write a screen's help texts" },
    description: {
      ro: "În „Informații de ajutor” scrii, în română și în engleză, la ce folosește un ecran, cum se lucrează pe el și indiciile lui cu bec.",
      en: "In „Informații de ajutor”, write in Romanian and in English what a screen is for, how it is worked, and its light-bulb hints.",
    },
    predecessors: ["workspace-read-help", "workspace-arrange-tiles"],
    screens: ["admin-help-content"],
    cases: ["TC-HELP-01"],
    manual: ["admin-help", "learning-help-proposals", "learning-help", "start-help"],
  },
  {
    key: "workspace-interactions-links-and-export",
    number: "3.14",
    level: 3,
    path: "workspace",
    name: {
      ro: "Leagă interacțiunile de acte, etichete și proprietăți și exportă-le",
      en: "Link interactions to documents, tags and properties, and export them",
    },
    description: {
      ro: "Legi o interacțiune de actele, etichetele și proprietatea ei, o schimbi sau o ștergi și descarci cu „Exportă” rândurile filtrate, pentru Excel.",
      en: "Link an interaction to its documents, tags and property, change or delete it, and download the filtered rows with „Exportă”, for Excel.",
    },
    predecessors: ["workspace-log-an-interaction", "links-classify-and-tag", "workspace-read-interaction-history"],
    screens: ["interactions"],
    cases: ["TC-INT-03", "TC-INT-04", "TC-INT-05"],
    manual: ["reports-interactions-links", "reports-interactions-edit", "reports-interactions-export", "reports-example-export", "reports-interactions-log"],
  },

  // ── Level 4 — Expert ────────────────────────────────────────────────────────────────────────────────────────
  {
    key: "persons-reconstruct-an-inheritance",
    number: "4.1",
    level: 4,
    path: "persons",
    name: { ro: "Reconstituie o moștenire", en: "Reconstruct an inheritance" },
    description: {
      ro: "Pui laolaltă familia în timp — actele fiecărei persoane, „Acte comune”, anul care estompează — cu certificatul de moștenitor și părțile lui, până știi cine a moștenit ce.",
      en: "Put the family together over time — each person's documents, „Acte comune”, the year that fades — with the certificate of inheritance and its parties, until you know who inherited what.",
    },
    predecessors: ["persons-id-card-from-the-archive", "persons-read-inheritance-tree", "documents-addendum-and-certificate"],
    screens: ["natural-person-detail", "document-detail"],
    cases: ["TC-INHER-03"],
    manual: ["reports-inheritance-documents", "reports-inheritance-year", "documents-dependent-inheritance", "documents-parties", "reports-example-family"],
  },
  {
    key: "properties-parcel-dossier",
    number: "4.2",
    level: 4,
    path: "properties",
    name: { ro: "Întocmește dosarul complet al unei parcele", en: "Assemble a parcel's complete dossier" },
    description: {
      ro: "Aduni pentru o parcelă forma și suprafața ei, actele, proprietarii cu cotele lor, parcelele în care e inclusă sau care o compun și grupurile din care face parte, fiecare verificat pe hartă.",
      en: "Gather for a parcel its shape and area, its documents, its owners with their shares, the parcels it belongs to or is made of, and the groups it is in, each checked on the map.",
    },
    predecessors: ["links-groups-and-stamps", "properties-measure-on-the-map", "links-follow-a-chain"],
    screens: ["property-detail", "properties-map"],
    cases: ["TC-PROP-07", "TC-ASSOC-08"],
    manual: ["links-related", "properties-corners-table", "links-references-properties", "links-classify-groups", "map-what-groups"],
  },
  {
    key: "documents-chain-of-title",
    number: "4.3",
    level: 4,
    path: "documents",
    name: { ro: "Urmărește titlul unei proprietăți prin acte", en: "Trace a property's title through its documents" },
    description: {
      ro: "Urmărești, de la cel mai vechi act la cel mai nou, vânzările, actele adiționale și moștenirile prin care o proprietate a trecut de la un proprietar la altul, cu cotele de fiecare dată.",
      en: "Follow, from the oldest document to the newest, the sales, addenda and inheritances through which a property passed from one owner to the next, with the shares each time.",
    },
    predecessors: ["documents-sale-contract", "documents-addendum-and-certificate", "links-follow-a-chain"],
    screens: ["document-detail", "property-detail"],
    cases: ["TC-DOC-19", "TC-DOC-20"],
    manual: ["links-references-documents", "documents-dependent-addendum", "documents-dependent-inheritance", "documents-parties", "links-example-title"],
  },
  {
    key: "links-audit-the-history",
    number: "4.4",
    level: 4,
    path: "links",
    name: {
      ro: "Verifică istoria unui obiect și repară o greșeală fără să pierzi nimic",
      en: "Audit an object's history and repair a mistake without losing anything",
    },
    description: {
      ro: "Afli din versiuni ce s-a schimbat și când, găsești legătura sau valoarea greșită, o repari și știi că versiunea veche rămâne în istoric.",
      en: "Learn from the versions what changed and when, find the wrong link or value, repair it, and know the old version stays in the history.",
    },
    predecessors: ["links-follow-a-chain", "links-work-in-two-windows"],
    screens: DETAIL_SCREENS,
    cases: ["TC-VER-01", "TC-VER-02", "TC-TABS-01"],
    manual: ["links-versions", "links-example-version", "links-associate-remove", "links-classify-classification", "links-two-windows"],
  },
  {
    key: "import-teach-a-new-document-type",
    number: "4.5",
    level: 4,
    path: "import",
    name: {
      ro: "Învață aplicația un tip nou de act cu „Distilare Tipizate”",
      en: "Teach the application a new document type with DocTypeEngine",
    },
    description: {
      ro: "Încarci în „Distilare Tipizate” actele-model ale unui tip, citești formularul propus, îl corectezi și îl salvezi, ca importurile următoare să citească singure acel tip.",
      en: "Give DocTypeEngine the sample documents of a type, read the proposed form, correct it and save it, so that the next imports read that type by themselves.",
    },
    predecessors: ["import-big-and-special-folders", "import-check-the-ai-reading", "workspace-reference-data"],
    screens: ["admin-doc-type-engine"],
    cases: ["TC-DOC-13", "TC-DOC-11"],
    manual: ["tools-doc-type-engine", "tools-doc-type-engine-pick", "tools-doc-type-engine-review", "tools-doc-type-engine-save", "tools-doc-type-engine-cost"],
  },
  {
    key: "workspace-keep-the-archive-in-order",
    number: "4.6",
    level: 4,
    path: "workspace",
    name: { ro: "Ține arhiva în ordine", en: "Keep the archive in order" },
    description: {
      ro: "Unești valorile duble din datele de referință, fuzionezi etichetele, ții textele de ajutor la zi și ajustezi setările după cum funcționează lucrurile în realitate.",
      en: "Merge duplicate values in the reference data, merge tags, keep the help texts up to date, and fit the settings to how the business works.",
    },
    predecessors: ["workspace-reference-data", "workspace-settings-and-users", "workspace-write-help"],
    screens: ["admin-value-lists", "admin-tags", "admin-help-content", "admin-settings"],
    cases: ["TC-VL-02", "TC-TAG-02"],
    manual: ["admin-reference-data-values", "admin-groups-tags", "admin-settings-thresholds", "learning-help-proposals", "admin-example-merge"],
  },
];

/**
 * Test cases no skill draws on, each with the reason — `skills-catalogue.test.ts` fails on any other uncovered
 * case, so a new case forces a decision about which skill it exercises.
 */
export const SKILLS_UNCOVERED_CASES: Readonly<Record<string, string>> = {
  "TC-LAYOUT-01":
    "The other screens measured at fixed widths (1400 and 2400 px): a statement about layout, not something a user does or understands.",
};

export function skillByKey(key: string): Skill | undefined {
  return SKILLS.find((s) => s.key === key);
}

/** The skills that list `key` among their predecessors — the arrows out of a box. */
export function successorsOf(key: string, skills: readonly Skill[] = SKILLS): Skill[] {
  return skills.filter((s) => s.predecessors.includes(key));
}

export function levelInfo(level: SkillLevel): SkillLevelInfo {
  const info = SKILL_LEVELS.find((l) => l.level === level);
  if (!info) throw new Error(`Unknown skill level ${level}`);
  return info;
}

export function pathInfo(key: SkillPathKey): SkillPath {
  const info = SKILL_PATHS.find((p) => p.key === key);
  if (!info) throw new Error(`Unknown skill path ${key}`);
  return info;
}
