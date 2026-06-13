import "@testing-library/jest-dom/vitest";

// recharts (ResponsiveContainer) usa ResizeObserver, ausente en jsdom.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = global.ResizeObserver || (ResizeObserverStub as unknown as typeof ResizeObserver);
