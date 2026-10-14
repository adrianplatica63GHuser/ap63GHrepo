/**
 * Slice #39.35 — „Navighează": the button, disabled with its reason when there is nowhere to go, and the dialog —
 * the start, „Deschide în Google Maps" in a new tab, the QR code of the phone's link, „Copiază linkul".
 */
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { NavigateButton } from "@/components/maps/navigate-dialog";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join("|")}` : key,
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const SQUARE = [
  { lat: 44.37, lon: 25.97 },
  { lat: 44.37, lon: 25.974 },
  { lat: 44.372, lon: 25.974 },
  { lat: 44.372, lon: 25.97 },
];
const BASE = "https://www.google.com/maps/dir/?api=1&destination=44.371000%2C25.972000";

describe("„Navighează” (#39.35)", () => {
  it("opens the dialog: the link in a new tab, and the phone's link as a QR code", () => {
    render(<NavigateButton target={{ corners: SQUARE, address: null }} name="Livada" />);
    fireEvent.click(screen.getByRole("button", { name: "button" }));
    expect(screen.getByRole("dialog", { name: "title:Livada" })).toBeInTheDocument();
    const open = screen.getByRole("link", { name: "open" });
    expect(open).toHaveAttribute("href", `${BASE}&travelmode=driving`);
    expect(open).toHaveAttribute("target", "_blank");
    expect(open).toHaveAttribute("rel", "noopener noreferrer");
    const qr = screen.getByRole("img", { name: "qr" });
    expect(qr).toHaveAttribute("data-qr-text", `${BASE}&travelmode=driving&dir_action=navigate`);
    expect(qr.querySelector("path")?.getAttribute("d")).toMatch(/^M\d+ \d+h1v1h-1z/);
  });

  it("from a typed address: no link until it is written, then the origin in it", () => {
    render(<NavigateButton target={{ corners: SQUARE, address: null }} name="Livada" />);
    fireEvent.click(screen.getByRole("button", { name: "button" }));
    fireEvent.click(screen.getByRole("radio", { name: "startAddress" }));
    expect(screen.queryByRole("link", { name: "open" })).toBeNull();
    expect(screen.getByText("startAddressMissing")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "startAddressLabel" }), { target: { value: "Piața Unirii" } });
    expect(screen.getByRole("link", { name: "open" })).toHaveAttribute("href", `${BASE}&origin=Pia%C8%9Ba%20Unirii&travelmode=driving`);
  });

  it("disabled, saying why, with no shape and no address", () => {
    render(<NavigateButton target={{ corners: [], address: { country: "România" } }} name="X" />);
    const button = screen.getByRole("button", { name: "button" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("noTarget");
  });

  it("Escape closes it", () => {
    render(<NavigateButton target={{ corners: SQUARE, address: null }} name="Livada" />);
    fireEvent.click(screen.getByRole("button", { name: "button" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
