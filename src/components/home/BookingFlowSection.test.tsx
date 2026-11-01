import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingFlowSection } from "./BookingFlowSection";

const viewport = vi.hoisted(() => ({ isInView: false, canAnimate: true }));
vi.mock("@/hooks/useInView", async () => {
  const { useRef } = await import("react");
  return { useInView: () => ({ ref: useRef<HTMLDivElement>(null), ...viewport }) };
});

let mobile = false;
let resize: () => void;
const disconnect = vi.fn();

function mount() {
  return render(<MemoryRouter><BookingFlowSection /></MemoryRouter>);
}

beforeEach(() => {
  mobile = false;
  viewport.isInView = false;
  viewport.canAnimate = true;
  disconnect.mockClear();
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect = disconnect;
  });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function () {
    if (this.classList.contains("booking-track")) return { left: 100, top: 200, width: mobile ? 320 : 1200, height: mobile ? 620 : 240 } as DOMRect;
    const markers = Array.from(this.parentElement?.parentElement?.querySelectorAll("[data-step-marker]") ?? []);
    const index = markers.indexOf(this);
    const x = mobile ? 40 : 200 + index * 400;
    const y = mobile ? [40, 240, 540][index] : 48;
    const size = mobile ? 80 : 96;
    return { left: 100 + x - size / 2, top: 200 + y - size / 2, width: size, height: size } as DOMRect;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Booking guide motion", () => {
  it("uses the same measured curve for the connecting line and ball, starting only in view", () => {
    const view = mount();
    const line = view.container.querySelector(".booking-track > svg path")!;
    const path = line.getAttribute("d");
    expect(path).toMatch(/^M200 48 C/);
    expect(path).toContain("600 48");
    expect(path).toMatch(/1000 48$/);
    expect((view.container.querySelector(".booking-ball") as HTMLElement).style.offsetPath).toBe(`path("${path}")`);
    expect(view.container.querySelector(".booking-track")).toHaveAttribute("data-playing", "false");
    viewport.isInView = true;
    view.rerender(<MemoryRouter><BookingFlowSection /></MemoryRouter>);
    expect(view.container.querySelector(".booking-track")).toHaveAttribute("data-playing", "true");
  });

  it("recalculates the path through all three mobile markers after a resize", () => {
    const view = mount();
    mobile = true;
    act(() => resize());
    const path = view.container.querySelector(".booking-track > svg path")!.getAttribute("d");
    expect(path).toBe("M40 40 L40 240 L40 540");
    expect((view.container.querySelector(".booking-ball") as HTMLElement).style.offsetPath).toBe(`path("${path}")`);
  });

  it("keeps the guide static when the visibility hook disables motion and cleans up sizing", () => {
    viewport.isInView = true;
    viewport.canAnimate = false;
    const view = mount();
    expect(view.container.querySelector(".booking-track")).toHaveAttribute("data-playing", "false");
    expect(view.container.querySelectorAll("[data-step-marker]")).toHaveLength(3);
    view.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("keeps a responsive connecting line without ResizeObserver", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const view = mount();
    mobile = true;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(view.container.querySelector(".booking-track > svg path")).toHaveAttribute("d", "M40 40 L40 240 L40 540");
  });
});
