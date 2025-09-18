import "@testing-library/jest-dom/vitest";

// Globally mock toast to avoid long-lived timers in tests
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

