import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "a@example.com", user_metadata: {} }, loading: false }),
}));

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "@/integrations/supabase/client";
import { toast as toastExport } from "@/hooks/use-toast";
import Agents from "@/pages/Agents";

describe("Agents page RLS/error handling", () => {
  it("shows empty state and does not crash when list load is denied by RLS", async () => {
    (supabase.from as any).mockImplementation((table: string) => {
      if (table !== "agents") throw new Error("unexpected table " + table);
      return {
        select: () => ({
          order: async () => ({ data: null, error: { message: "permission denied for table agents" } }),
        }),
        delete: () => ({ error: null }),
      };
    });

    render(
      <MemoryRouter>
        <Agents />
      </MemoryRouter>
    );

    expect(await screen.findByText(/No agents yet/i)).toBeInTheDocument();
    expect(toastExport).toHaveBeenCalled();
  });

  it("sanity", () => {
    expect(true).toBe(true);
  });
});

