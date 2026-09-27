/**
 * FU-224 — a certificate party's quality shows where the role does.  (Slice #37.07)
 */
import { roleOrQualityLabel } from "@/lib/documents/role-or-quality";

const WORDS = { DEFUNCT: "Defunct", MOSTENITOR: "Moștenitor" };

describe("FU-224: „Rol” says the role, else the quality, else „—”", () => {
  it("prefers the role", () => {
    expect(roleOrQualityLabel("Vânzător", "DEFUNCT", WORDS)).toBe("Vânzător");
  });
  it("says the quality when there is no role", () => {
    expect(roleOrQualityLabel(null, "DEFUNCT", WORDS)).toBe("Defunct");
    expect(roleOrQualityLabel(null, "MOSTENITOR", WORDS)).toBe("Moștenitor");
  });
  it("says „—” when there is neither, or the quality is not one it knows", () => {
    expect(roleOrQualityLabel(null, null, WORDS)).toBe("—");
    expect(roleOrQualityLabel(undefined, "ALTCEVA", WORDS)).toBe("—");
  });
});
