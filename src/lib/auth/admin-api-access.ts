/**
 * The GET handlers under `src/app/api/admin` that every signed-in role may
 * call, and the screen that needs each one.                    (Slice #36.20)
 *
 * WHY A LIST AND NOT A RULE
 *   Every POST, PUT, PATCH and DELETE under `/api/admin` requires a superuser
 *   (`requireSuperuser()` in `current-role.ts`). A GET is guarded the same way
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
