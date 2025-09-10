import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

function App() {
  return (
    <MemoryRouter initialEntries={["/secret"]}>
      <Routes>
        <Route
          path="/secret"
          element={
            <ProtectedRoute>
              <div data-testid="secret">Secret</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div data-testid="login">Login</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  it("redirects unauthenticated users to /login", async () => {
    render(<App />);
    expect(await screen.findByTestId("login")).toBeInTheDocument();
  });
});

