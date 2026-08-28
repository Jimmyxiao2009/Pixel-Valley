import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom has no matchMedia; scenes read it for prefers-reduced-motion.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// jsdom implements no Pointer Capture; MapStage/NeighborhoodScene pan with it.
for (const name of ["hasPointerCapture", "setPointerCapture", "releasePointerCapture"] as const) {
  if (!(name in Element.prototype)) {
    Object.defineProperty(Element.prototype, name, {
      configurable: true,
      value: name === "hasPointerCapture" ? () => false : () => {},
    });
  }
}

// jsdom implements no scrolling; the conversation log pins itself to the end.
if (!Element.prototype.scrollTo) {
  Object.defineProperty(Element.prototype, "scrollTo", {
    configurable: true,
    value: () => {},
  });
}

// jsdom has no ResizeObserver; useElementSize measures the stage with it.
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof window.ResizeObserver;
}

// jsdom has no rAF-driven layout; MapStage lerps with it.
if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = ((callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 0)) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((handle: number) =>
    window.clearTimeout(handle)) as typeof window.cancelAnimationFrame;
}
