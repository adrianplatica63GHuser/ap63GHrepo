/**
 * May this reader open „Roluri pe Document"?          (Slice #34.16, D-16(b))
 *
 * Three server pages ask it so that `NoRolesForTypeNote` can decide whether its
 * sentence carries a link. It is NOT a permission check: nothing is gated by
 * the answer. The door on Reference Data is `app/admin/layout.tsx`, and the
 * door on the association itself is `assertRoleMayBeAttached` in the query
 * layer (#34.15); neither of them trusts this.
 *
 * ⚠️ **`superuser`, SPELLED THE WAY THAT LAYOUT SPELLS IT.** The question is
 * „will this link work", and the only thing that decides that is the redirect
 * in `app/admin/layout.tsx`. A cleverer predicate would be a second opinion
 * about one redirect, and the day that rule changes only one of the two would
 * move. `getCurrentAppUser` reports UAT mode (Ciprian's box, which has no
 * `app_users` rows) as a superuser, which is exactly whom that layout admits,
 * so the link is offered where it works.
 *
 * ⚠️ **IT SWALLOWS THE THROW, AND THAT IS THE WHOLE REASON THIS IS A FUNCTION
 * RATHER THAN ONE LINE IN EACH PAGE.** `getCurrentAppUser` deliberately does
 * not fail closed — `current-role.ts` spends a paragraph on why a failed
 * `app_users` read throws rather than quietly returning the lower role — which
 * is right for every other caller, because every other caller is guarding
 * something. Here a role-lookup blip would 500 the whole „Asociază persoană"
 * screen over a decoration. Degrading to „sentence without link" is the honest
 * failure for a cosmetic answer, and it is the same shape as the neighbouring
 * carried-roles read, whose own header says a second red line for a list the
 * user never asked for by name would cost more than it explains.
 *
 * ⚠️ **IT COSTS A ROUND TRIP PER RENDER, AND THAT IS ACCEPTED RATHER THAN
 * OVERLOOKED.** `getCurrentAppUser` is an HTTPS call to the Supabase Auth API
 * plus an `app_users` select, neither request-cached, and this runs on all
 * three association pages including every visit where the type IS configured
 * and the note never shows. An adversarial round raised it; the answer is that
 * these are pages a user navigates to deliberately, each already doing its own
 * database read, and the alternatives are worse — a client read means a second
 * `queryFn` under a shared key, and deferring it means the server cannot answer
 * a question the client has already had to ask. `cache()` is applied so that
 * anything else in the same render pass reuses the answer rather than paying
 * again; it does not remove the first call, and is not pretended to.
 */

import { cache } from "react";
import { getCurrentAppUser } from "./current-role";

export const canConfigureRoles = cache(async (): Promise<boolean> => {
  try {
    const appUser = await getCurrentAppUser();
    return appUser?.role === "superuser";
  } catch {
    return false;
  }
});
