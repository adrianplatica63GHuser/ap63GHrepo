/**
 * What a record is called when it has no name of its own.      (Slice #37.57)
 *
 * A row, a button or a chip that used to fall back to the record's system ID
 * (`title ?? code`, `nickname ?? code`) falls back to words instead — „Act fără
 * titlu", „Proprietate fără poreclă", „Persoană fără nume" (`shared.unnamed`).
 * The system ID is shown in one place only: the first panel's corner.
 */
export type UnnamedKind = "document" | "property" | "person";

/** The `shared.unnamed` key for a target type as the groups and stamps spell it. */
export function unnamedKindOf(targetType: string): UnnamedKind {
  if (targetType === "DOCUMENT") return "document";
  if (targetType === "PROPERTY") return "property";
  return "person";
}
