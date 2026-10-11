/** Slice #39.11: a name as the tree's search compares it — lower case, no diacritics, single spaces. */
export function foldForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
