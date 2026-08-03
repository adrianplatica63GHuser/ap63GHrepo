/**
 * Slice #23.05.UX — contract tests for the shared button styling helper.
 *
 * These are not cosmetic assertions. Each block pins one of the properties the
 * slice exists to guarantee, so that a future edit to `button-styles.ts` cannot
 * quietly reintroduce the defect Adrian reported.
 */

import {
  BUTTON_SIZES,
  BUTTON_VARIANTS,
  SURFACED_VARIANTS,
  buttonClass,
  type ButtonVariant,
} from "@/lib/ui/button-styles";

/** Split a class string into a set for order-independent membership checks. */
function classes(s: string): Set<string> {
  return new Set(s.split(" ").filter(Boolean));
}

describe("buttonClass — the state rule", () => {
  it.each(SURFACED_VARIANTS)(
    "%s carries the neutral disabled surface, with no colour fill",
    (variant) => {
      const c = classes(buttonClass({ variant }));
      expect(c).toContain("disabled:bg-white");
      expect(c).toContain("disabled:border-wire");
      expect(c).toContain("disabled:text-fade");
      expect(c).toContain("disabled:shadow-none");
    },
  );

  it("emits the exact same disabled half for every surfaced variant", () => {
    // An inert control must not hint at what colour it would have been.
    const disabledHalves = SURFACED_VARIANTS.map((variant) =>
      [...classes(buttonClass({ variant }))]
        .filter((k) => k.includes("disabled:") && k !== "disabled:cursor-not-allowed")
        .sort()
        .join(" "),
    );
    expect(new Set(disabledHalves).size).toBe(1);
  });

  it.each(BUTTON_VARIANTS)("%s carries a strong enabled treatment", (variant) => {
    const expected: Record<ButtonVariant, string> = {
      primary: "bg-cta",
      secondary: "bg-cta-pale",
      danger: "bg-danger",
      ghost: "bg-cta-pale",
      bare: "text-cta",
      "bare-danger": "text-danger",
    };
    expect(classes(buttonClass({ variant }))).toContain(expected[variant]);
  });

  it.each(BUTTON_VARIANTS)("%s never uses disabled:opacity-*", (variant) => {
    // The whole defect: an opacity dip is not a visible state change on a white
    // button. If this ever reappears here, the slice has been undone.
    expect(buttonClass({ variant })).not.toMatch(/disabled:opacity-/);
  });

  it.each(["bare", "bare-danger"] as const)(
    "%s changes colour when disabled rather than fading",
    (variant) => {
      // A glyph with no surface has nothing to neutralise, so the rule is
      // adapted (colour -> wire) rather than abandoned back to an opacity dip.
      const c = classes(buttonClass({ variant }));
      expect(c).toContain("disabled:text-wire");
      expect(c).not.toContain("disabled:bg-white");
      expect(c).not.toContain("disabled:border-wire");
    },
  );

  it("keeps bare-danger in the destructive tone while enabled", () => {
    const c = classes(buttonClass({ variant: "bare-danger" }));
    expect(c).toContain("text-danger");
    expect(c).toContain("enabled:hover:text-danger-d");
    // ...but without growing a surface, which is what separates it from `danger`.
    expect(c).toContain("bg-transparent");
    expect(c).not.toContain("bg-danger");
  });
});

describe("buttonClass — hover cannot repaint a disabled button", () => {
  it.each(BUTTON_VARIANTS)("%s scopes every hover rule to :enabled", (variant) => {
    const bareHovers = [...classes(buttonClass({ variant }))].filter(
      (k) => /(^|:)hover:/.test(k) && !k.includes("enabled:hover:"),
    );
    // A disabled <button> still matches :hover in every browser, so a bare
    // hover: rule would repaint an inert control on mouse-over.
    expect(bareHovers).toEqual([]);
  });
});

describe("buttonClass — a child's colour cannot defeat the hover state", () => {
  it("makes secondary force its label colour onto descendants", () => {
    // Regression: the "Câmpuri afișate" pickers render their label inside
    // <span className="text-fade">. A colour on a child beats inheritance from
    // the button, so the label stayed #595F6A on the #334155 hover fill —
    // 1.63:1, unreadable. `secondary` is the only variant that inverts its
    // label colour on hover, so it is the only one defeatable this way.
    const c = classes(buttonClass({ variant: "secondary" }));
    expect(c).toContain("enabled:hover:text-white");
    expect(c).toContain("enabled:hover:**:text-white");
    expect(c).toContain("dark:enabled:hover:**:text-zinc-100");
  });

  it("leaves the resting label colour alone", () => {
    // The override is hover-only: at rest a muted child label is legitimate
    // (text-fade on bg-cta-pale is 5.8:1) and the design uses it deliberately.
    const c = classes(buttonClass({ variant: "secondary" }));
    expect([...c].filter((k) => k.startsWith("**:"))).toEqual([]);
  });
});

describe("buttonClass — accessibility", () => {
  it.each(BUTTON_VARIANTS)("%s keeps the not-allowed cursor", (variant) => {
    expect(classes(buttonClass({ variant }))).toContain("disabled:cursor-not-allowed");
  });

  it.each(BUTTON_VARIANTS)("%s is visible to keyboard focus", (variant) => {
    // Before this slice there were zero focus-visible: rules anywhere in src/.
    const c = classes(buttonClass({ variant }));
    expect(c).toContain("focus-visible:outline-2");
    expect(c).toContain("focus-visible:outline-focus");
    expect(c).toContain("focus-visible:outline-offset-2");
  });
});

describe("buttonClass — dark mode", () => {
  it.each(SURFACED_VARIANTS)("%s defines both dark states", (variant) => {
    const all = buttonClass({ variant });
    expect(all).toMatch(/\bdark:bg-/);
    expect(all).toMatch(/\bdark:disabled:bg-zinc-900\b/);
  });

  it("does not paint the light-mode primary fill in dark mode", () => {
    // bg-cta (#334155) on a zinc-900 page is a 1.69:1 contrast — an enabled
    // primary button would be all but invisible. It must lighten instead.
    const c = classes(buttonClass({ variant: "primary" }));
    expect(c).not.toContain("dark:bg-cta");
    expect(c).toContain("dark:bg-slate-400");
  });

  it("keeps danger red in dark mode rather than inverting it", () => {
    // An inverted red reads as pink and stops signalling "destructive".
    expect(classes(buttonClass({ variant: "danger" }))).toContain("dark:bg-red-600");
  });
});

describe("buttonClass — sizes", () => {
  it("defaults to md", () => {
    expect(buttonClass({ variant: "primary" })).toBe(
      buttonClass({ variant: "primary", size: "md" }),
    );
  });

  it.each(BUTTON_SIZES)("%s declares exactly one text size and one x/y padding", (size) => {
    const keys = [...classes(buttonClass({ variant: "primary", size }))];
    expect(keys.filter((k) => /^text-(xs|sm|base|lg)$/.test(k))).toHaveLength(1);
    expect(keys.filter((k) => /^px-/.test(k))).toHaveLength(1);
    expect(keys.filter((k) => /^py-/.test(k))).toHaveLength(1);
  });

  it("gives every size a distinct geometry", () => {
    const geometries = BUTTON_SIZES.map((size) =>
      [...classes(buttonClass({ variant: "primary", size }))]
        .filter((k) => /^(px|py|text)-/.test(k))
        .sort()
        .join(" "),
    );
    expect(new Set(geometries).size).toBe(BUTTON_SIZES.length);
  });

  it.each(BUTTON_SIZES)("the bare variants take the %s text size but no padding", (size) => {
    for (const variant of ["bare", "bare-danger"] as const) {
      const keys = [...classes(buttonClass({ variant, size }))];
      expect(keys.filter((k) => /^p[xy]?-/.test(k))).toEqual(["p-0"]);
      expect(keys.filter((k) => /^text-(xs|sm|base|lg)$/.test(k))).toHaveLength(1);
    }
  });

  it("transcribes the two reference strings the slice was specified against", () => {
    // import-wizard.tsx:363 primary — px-4 py-2 text-sm
    const lg = classes(buttonClass({ variant: "primary", size: "lg" }));
    expect(lg).toContain("px-4");
    expect(lg).toContain("py-2");
    expect(lg).toContain("text-sm");

    // bulk-import-dialog.tsx:~968 secondary — px-3 py-1.5 text-sm
    const md = classes(buttonClass({ variant: "secondary", size: "md" }));
    expect(md).toContain("px-3");
    expect(md).toContain("py-1.5");
    expect(md).toContain("text-sm");
  });
});

describe("buttonClass — pill", () => {
  it("is rounded-md by default", () => {
    const c = classes(buttonClass({ variant: "secondary" }));
    expect(c).toContain("rounded-md");
    expect(c).not.toContain("rounded-full");
  });

  it("swaps to rounded-full, never emitting both", () => {
    // `rounded-full` and `rounded-md` are conflicting utilities, so this has to
    // be a helper option rather than something the caller appends.
    const c = classes(buttonClass({ variant: "secondary", pill: true }));
    expect(c).toContain("rounded-full");
    expect(c).not.toContain("rounded-md");
  });

  it("changes nothing else about the button", () => {
    const flat = buttonClass({ variant: "primary", size: "xs" });
    const round = buttonClass({ variant: "primary", size: "xs", pill: true });
    expect(round.replace("rounded-full", "rounded-md")).toBe(flat);
  });

  it.each(["bare", "bare-danger"] as const)(
    "is ignored for %s, which has no surface to round",
    (variant) => {
      expect(buttonClass({ variant, pill: true })).toBe(buttonClass({ variant }));
    },
  );
});

describe("buttonClass — className passthrough", () => {
  it("appends layout extras", () => {
    expect(buttonClass({ variant: "primary", className: "w-full ml-4" })).toMatch(
      /\bw-full ml-4$/,
    );
  });

  it("ignores an empty or whitespace-only className", () => {
    const plain = buttonClass({ variant: "primary" });
    expect(buttonClass({ variant: "primary", className: "" })).toBe(plain);
    expect(buttonClass({ variant: "primary", className: "   " })).toBe(plain);
  });

  it("never emits doubled or trailing whitespace", () => {
    const s = buttonClass({ variant: "ghost", size: "xs", className: "gap-2" });
    expect(s).not.toMatch(/\s{2,}/);
    expect(s).toBe(s.trim());
  });
});

describe("buttonClass — shared base", () => {
  it.each(BUTTON_VARIANTS)("%s is laid out consistently", (variant) => {
    const c = classes(buttonClass({ variant }));
    expect(c).toContain("inline-flex");
    expect(c).toContain("items-center");
    expect(c).toContain("justify-center");
    expect(c).toContain("font-medium");
    expect(c).toContain("transition-colors");
  });
});
