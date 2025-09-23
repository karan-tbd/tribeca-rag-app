import Header from "@/components/Header";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { ENABLE_PROCESSING_PROGRESS_TOASTS } from "@/config/featureFlags";
import AgentDocuments from "@/components/agents/AgentDocuments";

export default function Documents() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Array<{ id: string; title: string; created_at: string; agent: { name: string } }>>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [agentId, setAgentId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const canUpload = useMemo(() => !!user && !!file && !!agentId, [user, file, agentId]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: docs } = await supabase
        .from("documents")
        .select("id, title, created_at, agent:agents(name)")
        .order("created_at", { ascending: false });
      setDocuments(docs ?? []);

      const { data: ags } = await supabase
        .from("agents")
        .select("id, name")
        .order("updated_at", { ascending: false });
      setAgents(ags ?? []);
      if (ags && ags.length > 0) setAgentId(ags[0].id);
    })();
  }, [user]);
  // Fire-and-forget progress toasts for processing, behind a flag
  const startProcessingToasts = (documentId: string) => {
    if (!ENABLE_PROCESSING_PROGRESS_TOASTS) return () => {};
    toast({ title: "Starting PDF processing…" });

    const timers: number[] = [];
    const schedule = [
      { ms: 800, title: "Processing 10%" },
      { ms: 2000, title: "Processing 25%" },
      { ms: 4500, title: "Processing 50%" },
      { ms: 8000, title: "Processing 75%" },
      { ms: 11000, title: "Processing 90%" },
    ];

    schedule.forEach(s => {
      const id = window.setTimeout(() => toast({ title: s.title }), s.ms);
      timers.push(id);
    });

    const channel = supabase
      .channel(`doc-progress-${documentId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'documents', filter: `id=eq.${documentId}` }, (payload) => {
        const status = (payload.new as any)?.processing_status as string | undefined;
        if (!status) return;
        if (status === 'processed') {
          toast({ title: 'Processing complete. Ready for search.' });
          cleanup();
        } else if (status === 'failed') {
          const err = (payload.new as any)?.processing_error || 'Processing failed';
          toast({ title: 'Processing failed', description: String(err) });
          cleanup();
        }
      })
      .subscribe();

    const cleanup = () => {
      timers.forEach(t => clearTimeout(t));
      try { channel.unsubscribe(); } catch {}
    };

    const hardTimeout = window.setTimeout(() => cleanup(), 60000);
    timers.push(hardTimeout);

    return cleanup;
  };


  const onUpload = async () => {
    if (!user || !file || !agentId) return;
    try {
      setUploading(true);
      if (file.type !== "application/pdf") {
        toast({ title: "Only PDFs are supported right now." });
        return;
      }
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: sErr } = await supabase.storage.from("documents").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/pdf",
      });
      if (sErr) throw sErr;

      const title = file.name.replace(/\.[^.]+$/, "");
      const { data, error: iErr } = await supabase.from("documents").insert({
        user_id: user.id,
        agent_id: agentId,
        storage_path: path,
        title,
        mime: file.type || "application/pdf",
      }).select().single();
      if (iErr) throw iErr;
      toast({ title: "Uploaded", description: `${file.name} uploaded.` });

      // Trigger document processing
      try {
        await supabase.functions.invoke('process-document', {
          body: { documentId: data.id }
        });
        if (ENABLE_PROCESSING_PROGRESS_TOASTS) {
          toast({ title: "Processing", description: "Document is being processed for search." });
        }
        startProcessingToasts(data.id);
      } catch (processError) {
        console.error('Processing failed:', processError);
        toast({ title: "Warning", description: "Upload succeeded but processing failed." });
      }

      const { data: docs } = await supabase
        .from("documents")
        .select("id, title, created_at, agent:agents(name)")
        .order("created_at", { ascending: false });
      setDocuments(docs ?? []);
      setFile(null);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message ?? "RLS or bucket error." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-4xl p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Documents</h1>
        <div className="space-y-3">
          {agents.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No agents yet. Create an agent first to upload documents.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              <select
                className="border rounded px-2 py-2 text-sm"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <AgentDocuments agentId={agentId} />
        </div>
      </main>
    </div>
  );
}

