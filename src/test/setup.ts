import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

class ResizeObserverMock implements ResizeObserver {
  disconnect = vi.fn();

  observe = vi.fn();

  unobserve = vi.fn();
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: vi.fn(() => ({
    arc: vi.fn(),
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    closePath: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    fill: vi.fn(),
    fillText: vi.fn(),
    lineTo: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
    moveTo: vi.fn(),
    restore: vi.fn(),
    roundRect: vi.fn(),
    save: vi.fn(),
    setTransform: vi.fn(),
    stroke: vi.fn(),
  })),
});

vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
vi.stubGlobal("cancelAnimationFrame", vi.fn());
