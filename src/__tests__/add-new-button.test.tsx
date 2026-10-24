/**
 * Slice 40.51 — „+" and a brand-new icon on the four lists' add buttons.
 *
 * Adrian, 2026-10-24: „two symbols only: a "+" and the icon of a map that looks "sparkling new" with some small rays or
 * sparkles coming out of it", and the same on the other three lists. `AddNewButton`: Plus, then `SparklingIcon` over
 * the list's Domeniu icon; no word; primary, md; its name and tooltip the whole „Adaugă …". The browser half is
 * TC-LAYOUT-02 step 9.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { Map, User } from "lucide-react";
import { AddNewButton, SparklingIcon } from "@/components/list/add-new-button";
import { buttonClass } from "@/lib/ui/button-styles";

jest.mock("next/link", () => ({ __esModule: true, default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

describe("the add button", () => {
  it("a link: „+”, then the icon with its rays; no word; named the whole „Adaugă …”", () => {
    render(<AddNewButton name="Adaugă persoană" icon={User} href="/natural-persons/new" />);
    const a = screen.getByRole("link", { name: "Adaugă persoană" });
    expect(a).toHaveAttribute("href", "/natural-persons/new");
    expect(a.textContent).toBe("");
    const icons = [...a.querySelectorAll("svg")].map((s) => (s.hasAttribute("data-sparkles") ? "sparkles" : (s.getAttribute("class") ?? "")));
    expect(icons[0]).toContain("lucide-plus");
    expect(icons[1]).toContain("lucide-user");
    expect(icons[2]).toBe("sparkles");
    expect(a.className).toContain(buttonClass({ variant: "primary", size: "md", className: "h-8.5 gap-2" }));
  });

  it("a button where the list opens a dialog (Proprietăți)", () => {
    const onClick = jest.fn();
    render(<AddNewButton name="Adaugă proprietate" icon={Map} onClick={onClick} />);
    const b = screen.getByRole("button", { name: "Adaugă proprietate" });
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(b.querySelector("svg")?.getAttribute("class")).toContain("lucide-plus");
  });

  it("the sparkles are decoration over any icon, in its stroke, off its top-right corner", () => {
    const { container } = render(<SparklingIcon icon={Map} size={18} />);
    const rays = container.querySelector("[data-sparkles]")!;
    expect(rays.getAttribute("aria-hidden")).toBe("true");
    expect(rays.getAttribute("stroke")).toBe("currentColor");
    expect((rays as SVGElement).style.right.startsWith("-")).toBe(true);
    expect((rays as SVGElement).style.top.startsWith("-")).toBe(true);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain("lucide-map");
  });
});
