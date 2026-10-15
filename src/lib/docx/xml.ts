/**
 * XML text escaping, for the WordprocessingML and SVG the app writes by hand.   (Slice #39.36; shared #39.37)
 * PURE.
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
