/**
 * The GET handlers under `src/app/api/admin` that every signed-in account may
 * call, and the screen that needs each one.                    (Slice #36.20)
 *
 * Since Slice #38.21 every account with an app_users row has full access, so
 * this list and the guard differ only for an account WITHOUT a row — the
 * screens below still work for it, as they did for a `user` before.
 *
 * WHY A LIST AND NOT A RULE
 *   Every POST, PUT, PATCH and DELETE under `/api/admin` requires full access
 *   (`requireFullAccess()` in `current-role.ts`). A GET is guarded the same way
 *   UNLESS an ordinary screen — one a `user` works on — reads it: Căutare
 *   globală is `/api/admin/global-search`, and the role and value pickers on the
 *   record forms and association screens read their lists from here. A blanket
 *   guard would break those screens for exactly the account it protects.
 *
 *   So the exception is written down, one route at a time, with the screen that
 *   needs it, and `src/__tests__/admin-api-role-guard.test.ts` fails the push
 *   when a GET is neither guarded nor listed here. Adding a line is a decision a
 *   reviewer sees, with its reason beside it — the same shape as
 *   `CATALOGUE_OPTED_OUT` and `HELP_OPTED_OUT`.
 *
 * Keys are the route as its folder spells it, under `src/app/api/admin`.
 *
 * PURE MODULE — no React, no DB. Read by a files-only jest suite in CI.
 */
export const ADMIN_API_OPEN_READS: Readonly<Record<string, string>> = {
  "global-search":
    "Căutare globală (/admin/global-search, open to every role since #36.20) and the sidebar's quick search, which every role sees.",
  "document-document-roles":
    "The „Tip relație\" picker on a document's „Asociază Document\" screen (/documents/[id]/associate-reference).",
  "property-property-roles":
    "The „Tip relație\" picker on a property's „Asociere proprietate corelată\" screen (/properties/[id]/associate-reference).",
  "doc-type-person-roles/distinct-roles":
    "The „Rol\" picker on the person and company „Asociere act\" screens, via role-offers.ts and role-whitelists.ts.",
  "value-lists/[list]":
    "Every closed list a record form offers: document types and institutions (document form, Acte filter), tarla and property types (property form), judicial-person types, person roles (use-lookup-options.ts, role-whitelists.ts).",
};

/**
 * Route files OUTSIDE `src/app/api/admin` whose only screens are admin
 * screens, and the screen each serves.                          (Slice #37.03)
 *
 * ⚠️ **A ROUTE IS NOT OPEN BECAUSE OF WHERE ITS FOLDER IS.** FU-222: five admin
 * screens — „Grupuri", „Ștampile", „Etichete", „Setări", „Calcul" — write
 * through routes that were never moved under `/api/admin`, so the guard above
 * never walked them and none checked the role: a `user` could create a group,
 * delete a stamp, rename a tag across every record, change the dashboard's
 * time frames or commit a calculation by request, with no screen offering it.
 * So the guard walks these files too, by name, and holds them to the same rule:
 * every POST, PUT, PATCH and DELETE requires full access, and a GET does unless
 * it is in `OUTSIDE_ADMIN_OPEN_READS` below.
 *
 * The list was made from a grep of every `fetch` of these routes in `src/`
 * (2026-09-26): nothing outside `src/app/admin/**` writes any of them. Keys
 * are the route as its folder spells it, under `src/app/api`. A new admin-only
 * route outside `/api/admin` belongs here the day it is written; better still,
 * it belongs under `/api/admin`.
 */
export const ADMIN_ONLY_ROUTES_OUTSIDE_ADMIN_API: Readonly<Record<string, string>> = {
  groups: "„Grupuri\" (/admin/groups): the list, „Adaugă grup nou\", „Șterge\".",
  "groups/[id]": "The group editor (/admin/groups/[id]) and „Grupuri\"'s „Șterge\".",
  stamps: "„Ștampile\" (/admin/stamps): the list and „+ Creare ștampilă\".",
  "stamps/[id]": "„Aplică ștampila\" (/admin/stamps/[id]) and „Ștampile\"'s „Șterge\".",
  tags: "„Etichete\" (/admin/tags): rename and merge a tag across every record.",
  "time-frames": "„Setări\" (/admin/settings): the dashboard's and lists' day counts.",
  "calculation/commit": "„Calcul\" (/admin/calculation): commits the parcels and their group.",
  "calculation/preview": "„Calcul\" (/admin/calculation): the preview before a commit.",
  "calculation/runs": "The calculation history (/admin/calculation/history).",
  "calculation/runs/[id]": "One calculation run (/admin/calculation/history/[id]).",
};

/**
 * GETs among `ADMIN_ONLY_ROUTES_OUTSIDE_ADMIN_API` that a screen a `user`
 * works on also reads, so they stay open to every role.        (Slice #37.03)
 */
export const OUTSIDE_ADMIN_OPEN_READS: Readonly<Record<string, string>> = {
  groups: "The „Grup\" filter on „Persoane Juridice\" (judicial-persons/list-view.tsx).",
  tags: "The tag picker on every record's „META INFO\" tab (entity-metadata-tab.tsx).",
  "time-frames": "The dashboard's day counts and the lists' „Nou!\" badge (hooks/use-time-frames.ts).",
};

/**
 * Writing routes outside `/api/admin` that stay open to every role BY DECISION,
 * and the decision.                                             (Slice #37.03)
 *
 * FU-223, decided 2026-09-26 as the #37.03 header recommended, overturnable in
 * one line by Adrian: a `user` may accept the fields „Descoperire AI" finds on
 * a document, which extends that document type's form for every document of
 * the type. The feature lives on the document screen a `user` works on every
 * day; closing these two routes would break that screen for the very person
 * the guard protects. If the decision is overturned, both get
 * `requireFullAccess()`, the accept step is hidden for a `user`, and they leave
 * this list — the guard then holds them like the rest.
 */
export const OUTSIDE_ADMIN_OPEN_WRITES: Readonly<Record<string, string>> = {
  "document-types/[id]/template-fields":
    "PUT — the DocTypeEngine's save (doc-type-engine.tsx). Open to a `user` by FU-223's decision, whose reason — „Descoperire AI\" on the document screen — left with Slice #37.85; closing it is FU-298.",
  "document-types/resolve":
    "POST — turns a classifier's answer into a lookup_document_type row. Kept open with template-fields by FU-223's decision (#37.03 header), although its only caller today is the import wizard (bulk-import-dialog.tsx, an admin screen).",
};
