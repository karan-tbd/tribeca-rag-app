import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ENABLE_PROCESSING_PROGRESS_TOASTS } from "@/config/featureFlags";
import { Upload, FileText, Trash2, Calendar, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";

interface Document {
  id: string;
  title: string;
  storage_path: string;
  mime: string;
  created_at: string;
  latest_version: number;
  processing_status: 'pending' | 'processing' | 'processed' | 'failed';
  processed_at?: string;
  chunk_count: number;
  processing_error?: string;
  processing_started_at?: string;
  embedding_model?: string; // Will be populated from chunks
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

        // For processed documents, get the embedding model from chunks
        const documentsWithEmbeddingInfo = await Promise.all(
          (data || []).map(async (doc) => {
            if (doc.processing_status === 'processed' && doc.chunk_count > 0) {
              const { data: chunk } = await supabase
                .from("chunks")
                .select("embedding_model")
                .eq("document_id", doc.id)
                .limit(1)
                .single();

              return { ...doc, embedding_model: chunk?.embedding_model };
            }
            return doc;
          })
        );

        setDocuments(documentsWithEmbeddingInfo);
      } catch (error) {
        console.error("Failed to load documents:", error);
        toast.error("Failed to load documents");
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();

    // Set up real-time subscription for document status updates
    const subscription = supabase
      .channel('document_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `agent_id=eq.${agentId}`
        },
        (payload) => {
          console.log('Document updated:', payload);
          setDocuments(prev =>
            prev.map(doc =>
              doc.id === payload.new.id
                ? { ...doc, ...payload.new }
                : doc
            )
          );
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, agentId]);

  const clearFileInput = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Helper function to get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processing':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Processing...
          </Badge>
        );
      case 'processed':
        return (
          <Badge variant="default" className="flex items-center gap-1 bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3" />
            Ready for search
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  // Helper function to get processing progress
  const getProcessingProgress = (document: Document) => {
    if (document.processing_status === 'processed') return 100;
    if (document.processing_status === 'processing') return 50;
    if (document.processing_status === 'failed') return 0;
    return 0;
  };

  // Fire-and-forget progress toasts for processing, behind a flag
  const startProcessingToasts = (documentId: string) => {
    if (!ENABLE_PROCESSING_PROGRESS_TOASTS) return () => {};
    // Start toast immediately
    toast.info("Starting PDF processing…");

    const timers: number[] = [];
    const schedule = [
      { ms: 800, msg: "Processing 10%" },
      { ms: 2000, msg: "Processing 25%" },
      { ms: 4500, msg: "Processing 50%" },
      { ms: 8000, msg: "Processing 75%" },
      { ms: 11000, msg: "Processing 90%" },
    ];

    schedule.forEach(s => {
      const id = window.setTimeout(() => toast.message(s.msg), s.ms);
      timers.push(id);
    });

    // Subscribe to doc status to finish early
    const channel = supabase
      .channel(`doc-progress-${documentId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'documents', filter: `id=eq.${documentId}` }, (payload) => {
        const status = (payload.new as any)?.processing_status as string | undefined;
        if (!status) return;
        if (status === 'processed') {
          toast.success('Processing complete. Ready for search.');
          cleanup();
        } else if (status === 'failed') {
          const err = (payload.new as any)?.processing_error || 'Processing failed';
          toast.error(err);
          cleanup();
        }
      })
      .subscribe();

    const cleanup = () => {
      timers.forEach(t => clearTimeout(t));
      try { channel.unsubscribe(); } catch {}
    };

    // Also auto-cleanup after 60s
    const hardTimeout = window.setTimeout(() => cleanup(), 60000);
    timers.push(hardTimeout);

    return cleanup;
  };

  const handleReprocess = async (document: Document) => {
    if (!user) return;
    try {
      // Optimistic UI: set to processing
      setDocuments(prev => prev.map(d => d.id === document.id ? { ...d, processing_status: 'processing' } as Document : d));

      const { error } = await supabase.functions.invoke("process-document", {
        body: { documentId: document.id },
      });
      if (error) {
        throw error as any;
      }
      if (ENABLE_PROCESSING_PROGRESS_TOASTS) {
        toast.success("Reprocessing started");
      }
      startProcessingToasts(document.id);
    } catch (e: any) {
      console.error("Reprocess failed:", e);
      toast.error(e?.message || "Failed to start reprocessing");
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

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
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

      // Create document record with initial processing status
      const title = file.name.replace(/\.[^.]+$/, "");
      const { data, error: dbError } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          agent_id: agentId,
          storage_path: path,
          title,
          mime: file.type,
          processing_status: 'pending',
          chunk_count: 0
        })
        .select()
        .single();

      if (dbError) throw dbError;

      toast.success(`${file.name} uploaded successfully`);

      // Trigger document processing
      try {
        const { data: _processData, error: processError } = await supabase.functions.invoke("process-document", {
          body: { documentId: data.id },
        });

        if (processError) {
          console.error("Processing invocation failed:", processError);
          toast.error("Upload succeeded but processing failed to start");
        } else {
          if (ENABLE_PROCESSING_PROGRESS_TOASTS) {
            toast.success("Document is being processed for search");
          }
          // Kick off progress toasts (auto-cleans up on processed/failed)
          startProcessingToasts(data.id);
        }
      } catch (processError) {
        console.error("Processing failed:", processError);
        toast.error("Upload succeeded but processing failed to start");
      }

      // Refresh documents list and clear file input
      setDocuments((prev) => [data as unknown as Document, ...prev]);
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
            Upload PDF files (max 10MB) to add knowledge to this agent.
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
          <div className="space-y-3">
            {documents.map((document) => (
              <div
                key={document.id}
                className="p-4 border rounded-lg space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{document.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(document.created_at)}
                        <span>•</span>
                        <span>v{document.latest_version}</span>
                        {document.chunk_count > 0 && (
                          <>
                            <span>•</span>
                            <span>{document.chunk_count} chunks</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(document.processing_status)}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReprocess(document)}
                      disabled={document.processing_status === 'processing'}
                      className="flex items-center gap-1"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Reprocess
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(document)}
                      className="text-destructive hover:text-destructive"
                      disabled={document.processing_status === 'processing'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Processing progress bar */}
                {document.processing_status === 'processing' && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Processing document...</span>
                      <span>{getProcessingProgress(document)}%</span>
                    </div>
                    <Progress value={getProcessingProgress(document)} className="h-2" />
                  </div>
                )}

                {/* Error message */}
                {document.processing_status === 'failed' && document.processing_error && (
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                    <strong>Processing failed:</strong> {document.processing_error}
                  </div>
                )}

                {/* Success info */}
                {document.processing_status === 'processed' && document.processed_at && (
                  <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                    <strong>Processed successfully</strong> on {formatDate(document.processed_at)}
                    {document.chunk_count > 0 && ` • ${document.chunk_count} chunks created`}
                    {document.embedding_model && ` • Using ${document.embedding_model}`}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
