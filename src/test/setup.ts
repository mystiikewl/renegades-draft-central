import '@testing-library/jest-dom';

// jsdom lacks ResizeObserver; Radix ScrollArea/Select need it.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverMock as typeof ResizeObserver;
