import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "a@example.com", user_metadata: {} }, loading: false }),
}));

// Hoisted mocks to satisfy Vitest hoisting rules
const hoisted = vi.hoisted(() => ({
  supabaseImpl: { from: vi.fn() as any },
  toastObj: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: hoisted.toastObj }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: hoisted.supabaseImpl,
}));

import AgentConfigForm from "@/components/agents/AgentConfigForm";

function setupUpsertMock({
  upsertSingleResult = { data: { id: "new-1" }, error: null },
}: {
  upsertSingleResult?: { data: any; error: any };
}) {
  hoisted.supabaseImpl.from.mockImplementation((table: string) => {
    if (table !== "agents") throw new Error("unexpected table " + table);
    return {
      // Upsert returns a chainable object: .select().single()
      upsert: vi.fn(() => ({
        select: () => ({
          single: async () => upsertSingleResult,
        }),
      })),
      // For edit mode: .select().eq().eq().maybeSingle()
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AgentConfigForm", () => {
  it("saves a new agent successfully", async () => {
    setupUpsertMock({ upsertSingleResult: { data: { id: "new-1" }, error: null } });

    render(<AgentConfigForm />);

    const nameInput = await screen.findByPlaceholderText(/My Agent/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "My Test Agent");

    const saveBtn = screen.getByRole("button", { name: /save/i });
    await userEvent.click(saveBtn);

    // Expect a success toast
    expect(hoisted.toastObj.success).toHaveBeenCalled();
  });

  it("shows validation error for short name", async () => {
    setupUpsertMock({});

    render(<AgentConfigForm />);

    const nameInput = await screen.findByPlaceholderText(/My Agent/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "A");

    const saveBtn = screen.getByRole("button", { name: /save/i });
    await userEvent.click(saveBtn);

    // Zod default message
    expect(await screen.findByText(/at least 2 character/i)).toBeInTheDocument();
    expect(hoisted.toastObj.success).not.toHaveBeenCalled();
  });

  it("handles RLS/permission error on save", async () => {
    setupUpsertMock({ upsertSingleResult: { data: null, error: { message: "permission denied" } } });

    render(<AgentConfigForm />);

    const nameInput = await screen.findByPlaceholderText(/My Agent/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Another Agent");

    const saveBtn = screen.getByRole("button", { name: /save/i });
    await userEvent.click(saveBtn);

    expect(hoisted.toastObj.error).toHaveBeenCalled();
  });

  it("loads an existing agent and updates it (edit flow)", async () => {
    // Provide existing agent details via select().eq().eq().maybeSingle()
    hoisted.supabaseImpl.from.mockImplementation((table: string) => {
      if (table !== "agents") throw new Error("unexpected table " + table);
      return {
        upsert: vi.fn(() => ({
          select: () => ({ single: async () => ({ data: { id: "a1" }, error: null }) }),
        })),
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "a1",
                  name: "Existing Agent",
                  description: "",
                  system_prompt: "",
                  query_template: "",
                  embed_model: "text-embedding-3-small",
                  gen_model: "gpt-4o-mini",
                  k: 5,
                  sim_threshold: 0.75,
                  fail_safe_threshold: 0.5,
                },
                error: null,
              }),
            }),
          }),
        }),
      };
    });

    render(<AgentConfigForm agentId="a1" />);

    const nameInput = await screen.findByPlaceholderText(/My Agent/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Updated Name");

    const saveBtn = screen.getByRole("button", { name: /save/i });
    await userEvent.click(saveBtn);

    expect(hoisted.toastObj.success).toHaveBeenCalled();
  });

  it("sanity", () => {
    expect(true).toBe(true);
  });

});

