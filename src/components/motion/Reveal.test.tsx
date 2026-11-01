import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Reveal } from "./Reveal";

let intersect: IntersectionObserverCallback;
let preferenceChange: () => void;
let preference: MediaQueryList;
const observe = vi.fn();
const disconnect = vi.fn();
const removeListener = vi.fn();
const constructed = vi.fn();

beforeEach(() => {
  observe.mockClear(); disconnect.mockClear(); removeListener.mockClear(); constructed.mockClear();
  preference = {
    matches: false, media: "(prefers-reduced-motion: reduce)", onchange: null,
    addEventListener: vi.fn((_type, listener) => { preferenceChange = listener as () => void; }),
    removeEventListener: removeListener, addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  };
  vi.spyOn(window, "matchMedia").mockReturnValue(preference);
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback; constructed(); }
    observe = observe;
    disconnect = disconnect;
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const show = () => render(<Reveal><button>Book a court</button></Reveal>);

describe("Progressive motion", () => {
  it("reveals content once it enters the viewport and releases its observer", () => {
    show();
    const wrapper = screen.getByRole("button", { name: "Book a court" }).parentElement;
    expect(wrapper).toHaveClass("motion-reveal--pending");
    act(() => intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(wrapper).not.toHaveClass("motion-reveal--pending");
    expect(wrapper).toHaveClass("motion-reveal--visible");
    expect(disconnect).toHaveBeenCalled();
  });
  it("keeps content visible when the browser has no observer support", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    show();
    expect(screen.getByRole("button").parentElement).not.toHaveClass("motion-reveal--pending");
    expect(constructed).not.toHaveBeenCalled();
  });
  it("skips observer animation when reduced motion is requested", () => {
    Object.defineProperty(preference, "matches", { value: true });
    show();
    expect(screen.getByRole("button").parentElement).not.toHaveClass("motion-reveal--pending");
    expect(constructed).not.toHaveBeenCalled();
  });
  it("immediately reveals pending content if reduced motion is enabled during the session", () => {
    show();
    Object.defineProperty(preference, "matches", { value: true });
    act(() => preferenceChange());
    expect(screen.getByRole("button").parentElement).not.toHaveClass("motion-reveal--pending");
    expect(disconnect).toHaveBeenCalled();
  });
  it("removes the preference listener and observer on unmount", () => {
    const view = show();
    view.unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(removeListener).toHaveBeenCalledWith("change", preferenceChange);
  });
});
