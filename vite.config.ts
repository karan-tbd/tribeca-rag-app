import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: "./tests/setup.ts",
    include: ["tests/**/*.test.{ts,tsx}"],
    pool: "forks",
    threads: false,
    singleThread: true,
    testTimeout: 15_000, // Increased timeout for CI
    hookTimeout: 15_000,
    // Exclude heavy scripts from test discovery
    exclude: ["**/scripts/**", "**/node_modules/**", "**/dist/**"],
  },
}));
