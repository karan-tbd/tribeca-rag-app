import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, FileText, Trash2, Calendar } from "lucide-react";

interface Document {
  id: string;
  title: string;
  storage_path: string;
  mime: string;
  created_at: string;
  latest_version: number;
}

interface AgentDocumentsProps {
  agentId: string | null;
}

export default function AgentDocuments({ agentId }: AgentDocumentsProps) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load documents for this agent
  useEffect(() => {
    if (!user || !agentId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    const loadDocuments = async () => {
      try {
        const { data, error } = await supabase
          .from("documents")
          .select("*")
          .eq("agent_id", agentId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setDocuments(data || []);
      } catch (error) {
        console.error("Failed to load documents:", error);
        toast.error("Failed to load documents");
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, [user, agentId]);

  const clearFileInput = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!user || !file || !agentId) return;

    setUploading(true);

    try {
      // Validate file type
      if (file.type !== "application/pdf") {
        toast.error("Only PDF files are supported");
        clearFileInput();
        return;
      }

      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        toast.error("File size must be less than 50MB");
        clearFileInput();
        return;
      }

      // Upload to storage
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: storageError } = await supabase.storage
        .from("documents")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (storageError) throw storageError;

      // Create document record
      const title = file.name.replace(/\.[^.]+$/, "");
      const { data, error: dbError } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          agent_id: agentId,
          storage_path: path,
          title,
          mime: file.type,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      toast.success(`${file.name} uploaded successfully`);

      // Trigger document processing
      try {
        await supabase.functions.invoke("process-document", {
          body: { documentId: data.id },
        });
        toast.success("Document is being processed for search");
      } catch (processError) {
        console.error("Processing failed:", processError);
        toast.error("Upload succeeded but processing failed");
      }

      // Refresh documents list and clear file input
      setDocuments((prev) => [data, ...prev]);
      clearFileInput();
    } catch (error: any) {
      console.error("Upload failed:", error);
      toast.error(error?.message || "Upload failed");
    } finally {
      // Always reset uploading state, regardless of success or failure
      setUploading(false);
    }
  };

  const handleDelete = async (document: Document) => {
    if (!user) return;

    if (!confirm(`Are you sure you want to delete "${document.title}"?`)) {
      return;
    }

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("documents")
        .remove([document.storage_path]);

      if (storageError) {
        console.error("Storage deletion failed:", storageError);
        // Continue with database deletion even if storage fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("documents")
        .delete()
        .eq("id", document.id)
        .eq("user_id", user.id);

      if (dbError) throw dbError;

      toast.success("Document deleted successfully");
      setDocuments((prev) => prev.filter((doc) => doc.id !== document.id));
    } catch (error: any) {
      console.error("Delete failed:", error);
      toast.error(error?.message || "Failed to delete document");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (!agentId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Save the agent first to manage documents.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documents ({documents.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="flex-1"
            />
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading..." : "Upload PDF"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Upload PDF files (max 50MB) to add knowledge to this agent.
          </p>
        </div>

        {/* Documents List */}
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No documents uploaded yet. Upload a PDF to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((document) => (
              <div
                key={document.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{document.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(document.created_at)}
                      <span>•</span>
                      <span>v{document.latest_version}</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(document)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
