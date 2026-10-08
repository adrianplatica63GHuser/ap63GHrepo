/**
 * Does a typed e-mail address have the shape of one?            (Slice #38.31)
 *
 * Shape only: something, an „@", something, a dot, something — no spaces. It
 * does not look the domain up and does not refuse an unusual but valid
 * address; it catches the slip a person makes typing one (a missing „@", a
 * phone number in the e-mail box, a space). An empty value is no address and
 * is fine — the field is optional.
 *
 * PURE — imported by the firm's form schema and by its API schema alike.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@.]+$/;

export function isEmailShape(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  return v.length === 0 || EMAIL_SHAPE.test(v);
}
