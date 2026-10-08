/**
 * The document type's own page: its tabs, and which one a URL opens. (Slice #38.39)
 *
 * Pure, so the tab a `?tab=` names is decided in one place a test can hold:
 * anything that is not one of the three opens „General", rather than a page
 * with no panel.
 */

export const DOCUMENT_TYPE_TABS = ["general", "form", "roles"] as const;
export type DocumentTypeTab = (typeof DOCUMENT_TYPE_TABS)[number];

export function documentTypeTabOf(param: string | null | undefined): DocumentTypeTab {
  return (DOCUMENT_TYPE_TABS as readonly string[]).includes(param ?? "") ? (param as DocumentTypeTab) : "general";
}

/** Where „Deschide" on the list goes: the type's page, by its immutable code. */
export function documentTypePageHref(code: string, tab?: DocumentTypeTab): string {
  const base = `/admin/value-lists/document-types/${encodeURIComponent(code)}`;
  return tab ? `${base}?tab=${tab}` : base;
}
