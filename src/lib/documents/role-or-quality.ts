/**
 * What the „Rol" cell of a person↔document link says.     (FU-224, Slice #37.07)
 *
 * A party added to a Certificat de Moștenitor carries a QUALITY — „Defunct" or
 * „Moștenitor" — and no person role; every other link carries a role and no
 * quality. The certificate's own „Părți" showed the quality, but its
 * „Persoane" tab and each person's „Acte" read only the role, so from the
 * person's end nothing said whether they were the deceased or the heir: „—".
 * Both tabs now say the role, else the quality, else „—".
 *
 * The words come from the caller's messages (`qualityDefunct` /
 * `qualityMostenitor`), passed in so this stays pure and each tab keeps its
 * own namespace.
 */
export type PartyQuality = "DEFUNCT" | "MOSTENITOR";

export function roleOrQualityLabel(
  roleName: string | null | undefined,
  quality: PartyQuality | string | null | undefined,
  words: { DEFUNCT: string; MOSTENITOR: string },
): string {
  if (roleName) return roleName;
  if (quality === "DEFUNCT") return words.DEFUNCT;
  if (quality === "MOSTENITOR") return words.MOSTENITOR;
  return "—";
}
