/**
 * META INFO's two toggles show their state in the icon.            (Slice #37.44)
 *
 * „Marchează ca verificat" (A031) is BadgeCheck — outlined, then filled while
 * „✓ Verificat" shows — and its name follows the three words it had. The add
 * buttons (A032, A039) are Plus (Link for a cross-reference) while closed and
 * ChevronUp while open, where they showed a bare „▲".
 */
import { render, screen } from "@testing-library/react";
import { Link as LinkIcon, Plus } from "lucide-react";

import { AddToggleButton, MarkReviewedButton } from "@/components/metadata-buttons";

const LABELS = { mark: "Marchează ca verificat", marking: "Se marchează…", marked: "✓ Verificat" };

function iconClass(button: HTMLElement): string {
  return button.querySelector("svg")?.getAttribute("class") ?? "";
}

describe("MarkReviewedButton — three states", () => {
  it("before: an outlined BadgeCheck, named „Marchează ca verificat”", () => {
    render(<MarkReviewedButton reviewed={false} reviewing={false} labels={LABELS} onClick={() => {}} />);
    const b = screen.getByRole("button", { name: "Marchează ca verificat" });
    expect(iconClass(b)).toContain("lucide-badge-check");
    expect(b.querySelector("svg")).not.toHaveAttribute("data-filled");
    expect(b).toBeEnabled();
    expect(b).toHaveAttribute("aria-pressed", "false");
  });

  it("while marking: the spinner, named „Se marchează…”", () => {
    render(<MarkReviewedButton reviewed={false} reviewing labels={LABELS} onClick={() => {}} />);
    const b = screen.getByRole("button", { name: "Se marchează…" });
    expect(iconClass(b)).toContain("animate-spin");
    expect(b).toBeDisabled();
  });

  it("after: a FILLED BadgeCheck, named „✓ Verificat”, pressed", () => {
    render(<MarkReviewedButton reviewed reviewing={false} labels={LABELS} onClick={() => {}} />);
    const b = screen.getByRole("button", { name: "✓ Verificat" });
    expect(iconClass(b)).toContain("lucide-badge-check");
    expect(b.querySelector("svg")).toHaveAttribute("data-filled");
    expect(b.querySelector("svg")).toHaveAttribute("fill", "currentColor");
    expect(b).toHaveAttribute("aria-pressed", "true");
  });
});

describe("AddToggleButton — Plus / ChevronUp", () => {
  it("closed: its own icon, named by what it adds", () => {
    render(<AddToggleButton open={false} icon={Plus} labelAdd="+ Adaugă în grup" labelHide="Ascunde" onClick={() => {}} />);
    const b = screen.getByRole("button", { name: "+ Adaugă în grup" });
    expect(iconClass(b)).toContain("lucide-plus");
    expect(b).toHaveAttribute("aria-expanded", "false");
  });

  it("open: ChevronUp, named „Ascunde” — the „▲” had no name", () => {
    render(<AddToggleButton open icon={Plus} labelAdd="+ Adaugă în grup" labelHide="Ascunde" onClick={() => {}} />);
    const b = screen.getByRole("button", { name: "Ascunde" });
    expect(iconClass(b)).toContain("lucide-chevron-up");
    expect(b).toHaveAttribute("aria-expanded", "true");
  });

  it("a cross-reference's closed icon is Link", () => {
    render(<AddToggleButton open={false} icon={LinkIcon} labelAdd="+ Adaugă trimitere" labelHide="Ascunde" onClick={() => {}} />);
    expect(iconClass(screen.getByRole("button", { name: "+ Adaugă trimitere" }))).toContain("lucide-link");
  });
});
