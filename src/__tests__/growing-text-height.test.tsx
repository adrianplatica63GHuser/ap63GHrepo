/**
 * GrowingText takes an explicit height from its content in every browser.
 *                                                               (Slice #37.51)
 *
 * Until #37.51 the scrollHeight height ran only where `field-sizing` was
 * missing. Chrome has it, and sizes a stacked field's grid row from the box's
 * `min-height` rather than from the height `field-sizing` gives it, so a
 * „Subiect" of three lines ran over „Note extinse" below it. The height is now
 * always set from `scrollHeight`; a box that is not laid out (a hidden tile) is
 * left to `min-height`, since a height taken from its zero scrollHeight would
 * leave a 2 px box when it shows.
 *
 * jsdom has no layout: `CSS.supports` is made to say yes to `field-sizing` (the
 * browser in which the bug lived), `scrollHeight` is stubbed, and
 * `getClientRects` is stubbed per case — jsdom always answers it empty.
 */
import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";

jest.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

import { GrowingText } from "@/components/forms/growing-text";

const LINE = 20;
const PAD = 8;
let contentLines = 3;
let laidOut = true;

beforeAll(() => {
  Object.defineProperty(window, "CSS", {
    configurable: true,
    value: { supports: (prop: string, value?: string) => prop === "field-sizing" && value === "content" },
  });
  Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
    configurable: true,
    get: () => contentLines * LINE + PAD,
  });
  jest.spyOn(HTMLTextAreaElement.prototype, "getClientRects").mockImplementation(
    () => (laidOut ? [{}] : []) as unknown as DOMRectList,
  );
});

beforeEach(() => {
  contentLines = 3;
  laidOut = true;
});

function Box({ initial }: { initial: string }) {
  const [v, setV] = useState(initial);
  return <GrowingText value={v} onValueChange={setV} width="28rem" data-testid="box" />;
}

describe("GrowingText's height (#37.51)", () => {
  it("is set from the content even where field-sizing is supported", () => {
    const { getByTestId } = render(<Box initial="three lines" />);
    // jsdom: offsetHeight and clientHeight are both 0, so the border adds nothing.
    expect((getByTestId("box") as HTMLTextAreaElement).style.height).toBe(`${3 * LINE + PAD}px`);
  });

  it("follows a value typed onto a fourth line", () => {
    const { getByTestId } = render(<Box initial="three lines" />);
    const box = getByTestId("box") as HTMLTextAreaElement;
    contentLines = 4;
    fireEvent.change(box, { target: { value: "four lines now" } });
    expect(box.style.height).toBe(`${4 * LINE + PAD}px`);
  });

  it("is left to min-height while the box is not laid out, and set once it is", () => {
    laidOut = false;
    const { getByTestId, rerender } = render(<Box initial="hidden" />);
    const box = getByTestId("box") as HTMLTextAreaElement;
    expect(box.style.height).toBe("");
    expect(box.style.minHeight).not.toBe("");
    laidOut = true;
    rerender(<Box initial="hidden" />);
    expect(box.style.height).toBe(`${3 * LINE + PAD}px`);
  });
});
