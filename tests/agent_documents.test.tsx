import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "a@example.com", user_metadata: {} }, loading: false }),
}));

// Hoisted mocks to satisfy Vitest hoisting rules
const hoisted = vi.hoisted(() => ({
  supabaseImpl: { 
    from: vi.fn() as any,
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        remove: vi.fn(),
      })),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
  toastObj: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: hoisted.toastObj }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: hoisted.supabaseImpl,
}));

import AgentDocuments from "@/components/agents/AgentDocuments";

function setupDocumentsMock({
  documentsResult = { data: [], error: null },
  uploadResult = { error: null },
  insertResult = { data: { id: "doc-1", title: "Test Document" }, error: null },
  deleteResult = { error: null },
}: {
  documentsResult?: { data: any[]; error: any };
  uploadResult?: { error: any };
  insertResult?: { data: any; error: any };
  deleteResult?: { error: any };
} = {}) {
  hoisted.supabaseImpl.from.mockImplementation((table: string) => {
    if (table === "documents") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => documentsResult,
            }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: async () => insertResult,
          }),
        }),
        delete: () => ({
          eq: () => ({
            eq: async () => deleteResult,
          }),
        }),
      };
    }
    throw new Error("unexpected table " + table);
  });

  hoisted.supabaseImpl.storage.from.mockReturnValue({
    upload: vi.fn().mockResolvedValue(uploadResult),
    remove: vi.fn().mockResolvedValue({ error: null }),
  });

  hoisted.supabaseImpl.functions.invoke.mockResolvedValue({ data: null, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AgentDocuments", () => {
  it("shows message when no agent is selected", () => {
    render(<AgentDocuments agentId={null} />);
    
    expect(screen.getByText("Save the agent first to manage documents.")).toBeInTheDocument();
  });

  it("loads and displays documents for an agent", async () => {
    const mockDocuments = [
      {
        id: "doc-1",
        title: "Test Document",
        storage_path: "user-1/test.pdf",
        mime: "application/pdf",
        created_at: "2024-01-01T00:00:00Z",
        latest_version: 1,
      },
    ];

    setupDocumentsMock({
      documentsResult: { data: mockDocuments, error: null },
    });

    render(<AgentDocuments agentId="agent-1" />);

    await waitFor(() => {
      expect(screen.getByText("Test Document")).toBeInTheDocument();
    });

    expect(screen.getByText("Documents (1)")).toBeInTheDocument();
  });

  it("shows empty state when no documents exist", async () => {
    setupDocumentsMock({
      documentsResult: { data: [], error: null },
    });

    render(<AgentDocuments agentId="agent-1" />);

    await waitFor(() => {
      expect(screen.getByText("No documents uploaded yet. Upload a PDF to get started.")).toBeInTheDocument();
    });
  });

  it("handles file upload successfully", async () => {
    setupDocumentsMock({
      documentsResult: { data: [], error: null },
      uploadResult: { error: null },
      insertResult: { data: { id: "doc-1", title: "test" }, error: null },
    });

    render(<AgentDocuments agentId="agent-1" />);

    // Create a mock PDF file
    const file = new File(["test content"], "test.pdf", { type: "application/pdf" });
    
    const fileInput = screen.getByRole("textbox", { hidden: true }) as HTMLInputElement;
    await userEvent.upload(fileInput, file);

    const uploadButton = screen.getByRole("button", { name: /upload pdf/i });
    await userEvent.click(uploadButton);

    await waitFor(() => {
      expect(hoisted.toastObj.success).toHaveBeenCalledWith("test.pdf uploaded successfully");
    });
  });

  it("validates file type and shows error for non-PDF files", async () => {
    setupDocumentsMock();

    render(<AgentDocuments agentId="agent-1" />);

    // Create a mock non-PDF file
    const file = new File(["test content"], "test.txt", { type: "text/plain" });

    const fileInput = screen.getByRole("textbox", { hidden: true }) as HTMLInputElement;
    await userEvent.upload(fileInput, file);

    const uploadButton = screen.getByRole("button", { name: /upload pdf/i });
    await userEvent.click(uploadButton);

    await waitFor(() => {
      expect(hoisted.toastObj.error).toHaveBeenCalledWith("Only PDF files are supported");
    });

    // Verify button is re-enabled after validation error
    await waitFor(() => {
      expect(uploadButton).not.toBeDisabled();
      expect(uploadButton).toHaveTextContent("Upload PDF");
    });
  });

  it("validates file size and shows error for large files", async () => {
    setupDocumentsMock();

    render(<AgentDocuments agentId="agent-1" />);

    // Create a mock large file (over 50MB)
    const largeContent = new Array(51 * 1024 * 1024).fill("a").join("");
    const file = new File([largeContent], "large.pdf", { type: "application/pdf" });

    const fileInput = screen.getByRole("textbox", { hidden: true }) as HTMLInputElement;
    await userEvent.upload(fileInput, file);

    const uploadButton = screen.getByRole("button", { name: /upload pdf/i });
    await userEvent.click(uploadButton);

    await waitFor(() => {
      expect(hoisted.toastObj.error).toHaveBeenCalledWith("File size must be less than 50MB");
    });

    // Verify button is re-enabled after validation error
    await waitFor(() => {
      expect(uploadButton).not.toBeDisabled();
      expect(uploadButton).toHaveTextContent("Upload PDF");
    });
  });

  it("handles document deletion with confirmation", async () => {
    const mockDocuments = [
      {
        id: "doc-1",
        title: "Test Document",
        storage_path: "user-1/test.pdf",
        mime: "application/pdf",
        created_at: "2024-01-01T00:00:00Z",
        latest_version: 1,
      },
    ];

    setupDocumentsMock({
      documentsResult: { data: mockDocuments, error: null },
      deleteResult: { error: null },
    });

    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<AgentDocuments agentId="agent-1" />);

    await waitFor(() => {
      expect(screen.getByText("Test Document")).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: "" }); // Trash icon button
    await userEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete "Test Document"?');
    
    await waitFor(() => {
      expect(hoisted.toastObj.success).toHaveBeenCalledWith("Document deleted successfully");
    });

    confirmSpy.mockRestore();
  });

  it("cancels deletion when user declines confirmation", async () => {
    const mockDocuments = [
      {
        id: "doc-1",
        title: "Test Document",
        storage_path: "user-1/test.pdf",
        mime: "application/pdf",
        created_at: "2024-01-01T00:00:00Z",
        latest_version: 1,
      },
    ];

    setupDocumentsMock({
      documentsResult: { data: mockDocuments, error: null },
    });

    // Mock window.confirm to return false
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<AgentDocuments agentId="agent-1" />);

    await waitFor(() => {
      expect(screen.getByText("Test Document")).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: "" }); // Trash icon button
    await userEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    
    // Should not call delete APIs
    expect(hoisted.supabaseImpl.storage.from().remove).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("properly manages upload button state during upload process", async () => {
    setupDocumentsMock({
      documentsResult: { data: [], error: null },
      uploadResult: { error: null },
      insertResult: { data: { id: "doc-1", title: "test" }, error: null },
    });

    render(<AgentDocuments agentId="agent-1" />);

    // Create a mock PDF file
    const file = new File(["test content"], "test.pdf", { type: "application/pdf" });

    const fileInput = screen.getByRole("textbox", { hidden: true }) as HTMLInputElement;
    const uploadButton = screen.getByRole("button", { name: /upload pdf/i });

    // Initially button should be disabled (no file selected)
    expect(uploadButton).toBeDisabled();

    // Upload file
    await userEvent.upload(fileInput, file);

    // Button should be enabled after file selection
    await waitFor(() => {
      expect(uploadButton).not.toBeDisabled();
      expect(uploadButton).toHaveTextContent("Upload PDF");
    });

    // Click upload button
    await userEvent.click(uploadButton);

    // Button should show uploading state and be disabled
    await waitFor(() => {
      expect(uploadButton).toBeDisabled();
      expect(uploadButton).toHaveTextContent("Uploading...");
    });

    // After upload completes, button should be reset
    await waitFor(() => {
      expect(uploadButton).toBeDisabled(); // Should be disabled again (no file selected)
      expect(uploadButton).toHaveTextContent("Upload PDF");
    });

    // Verify success toast was shown
    expect(hoisted.toastObj.success).toHaveBeenCalledWith("test.pdf uploaded successfully");
  });

  it("resets upload button state after upload failure", async () => {
    setupDocumentsMock({
      documentsResult: { data: [], error: null },
      uploadResult: { error: new Error("Storage error") },
    });

    render(<AgentDocuments agentId="agent-1" />);

    // Create a mock PDF file
    const file = new File(["test content"], "test.pdf", { type: "application/pdf" });

    const fileInput = screen.getByRole("textbox", { hidden: true }) as HTMLInputElement;
    const uploadButton = screen.getByRole("button", { name: /upload pdf/i });

    // Upload file
    await userEvent.upload(fileInput, file);

    // Click upload button
    await userEvent.click(uploadButton);

    // Wait for upload to fail and button to reset
    await waitFor(() => {
      expect(uploadButton).not.toBeDisabled(); // Should be enabled again with same file
      expect(uploadButton).toHaveTextContent("Upload PDF");
    });

    // Verify error toast was shown
    await waitFor(() => {
      expect(hoisted.toastObj.error).toHaveBeenCalled();
    });
  });
});
