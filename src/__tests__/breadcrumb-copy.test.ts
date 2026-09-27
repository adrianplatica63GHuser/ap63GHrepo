/**
 * The breadcrumb says what the screen it names says.          (Slice #37.07)
 *
 * FU-070: the Romanian crumb for the documents list said „Documente" while the
 * list's own title, the sidebar and the help all say „Acte".
 */
import ro from "../../messages/ro-RO.json";

describe("the breadcrumb's words", () => {
  it("FU-070: calls the documents list „Acte”, as its title does", () => {
    expect(ro.navigation.breadcrumb.documents).toBe(ro.document.listTitle);
    expect(ro.navigation.breadcrumb.documents).toBe("Acte");
  });
});
