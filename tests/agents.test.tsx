import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "a@example.com", user_metadata: {} }, loading: false }),
}));


// Stub AgentConfigForm to keep this test focused on list rendering
vi.mock("@/components/agents/AgentConfigForm", () => ({
  default: () => <div data-testid="agent-form" />,
}));

const mockSelectChain = {
  order: async () => ({ data: [
    { id: "a1", name: "Agent A", updated_at: new Date().toISOString() },
    { id: "a2", name: "Agent B", updated_at: new Date().toISOString() },
  ], error: null }),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => mockSelectChain,
      insert: () => ({ error: null }),
      update: () => ({ error: null }),
      delete: () => ({ error: null }),
      eq: () => ({ data: null, error: null }),
    }),
  },
}));

import Agents from "@/pages/Agents";

describe("Agents page", () => {
  it("renders the user's agents list", async () => {
    render(
      <MemoryRouter>
        <Agents />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Your agents/i)).toBeInTheDocument();
    expect(await screen.findByText("Agent A")).toBeInTheDocument();
    expect(await screen.findByText("Agent B")).toBeInTheDocument();
  });
});

