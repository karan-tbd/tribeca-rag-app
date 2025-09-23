import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Globally mock toast to avoid long-lived timers in tests
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

// Global test cleanup to prevent memory leaks
afterEach(() => {
  cleanup(); // Clean up React components
  vi.clearAllMocks(); // Clear all mocks

  // Force garbage collection if available (when running with --expose-gc)
  if (global.gc) {
    global.gc();
  }
});

