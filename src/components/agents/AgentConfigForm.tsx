import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { agentSchema, type AgentFormValues } from "@/lib/validations";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AgentDocuments from "./AgentDocuments";

interface AgentConfigFormProps {
  agentId?: string | null;
  onSave?: () => void;
}

export default function AgentConfigForm({ agentId: propAgentId, onSave }: AgentConfigFormProps) {
  const { user } = useAuth();
  const [agentId, setAgentId] = useState<string | null>(propAgentId || null);
  const form = useForm<AgentFormValues>({ resolver: zodResolver(agentSchema), defaultValues: { k: 5, sim_threshold: 0.75, fail_safe_threshold: 0.5 } });

  useEffect(() => {
    setAgentId(propAgentId || null);
    
    if (!user) return;
    
    if (propAgentId) {
      // Load specific agent
      (async () => {
        const { data, error } = await supabase
          .from("agents")
          .select("*")
          .eq("id", propAgentId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) {
          console.error(error);
        } else if (data) {
          form.reset({
            name: data.name,
            description: data.description ?? "",
            system_prompt: data.system_prompt ?? "",
            query_template: data.query_template ?? "",
            embed_model: data.embed_model ?? "text-embedding-3-small",
            gen_model: data.gen_model ?? "gpt-4o-mini",
            k: data.k ?? 5,
            sim_threshold: data.sim_threshold ?? 0.75,
            fail_safe_threshold: data.fail_safe_threshold ?? 0.5,
          });
        }
      })();
    } else {
      // Reset form for new agent
      form.reset({
        name: "",
        description: "",
        system_prompt: "",
        query_template: "",
        embed_model: "text-embedding-3-small",
        gen_model: "gpt-4o-mini",
        k: 5,
        sim_threshold: 0.75,
        fail_safe_threshold: 0.5,
      });
    }
  }, [user, propAgentId, form]);

  const onSubmit = async (values: AgentFormValues) => {
    if (!user) return;
    const payload = {
      id: agentId ?? undefined,
      user_id: user.id,
      config_version: 1,
      ...values,
      updated_at: new Date().toISOString(),
    } as any;
    const { data, error } = await supabase.from("agents").upsert(payload).select().single();
    if (error) {
      console.error(error);
      toast.error("Failed to save agent");
    } else {
      setAgentId(data.id);
      toast.success("Agent saved");
      onSave?.();
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Name</label>
          <Input {...form.register("name")} placeholder="My Agent" />
          {form.formState.errors.name && (
            <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium">Description</label>
          <Textarea {...form.register("description")} rows={2} />
        </div>
        <div>
          <label className="text-sm font-medium">System Prompt</label>
          <Textarea {...form.register("system_prompt")} rows={4} />
        </div>
        <div>
          <label className="text-sm font-medium">Query Template</label>
          <Textarea {...form.register("query_template")} rows={3} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Embedding Model</label>
            <Input {...form.register("embed_model")} placeholder="text-embedding-3-small" />
          </div>
          <div>
            <label className="text-sm font-medium">Generation Model</label>
            <Input {...form.register("gen_model")} placeholder="gpt-4o-mini" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium">k</label>
            <Input type="number" {...form.register("k", { valueAsNumber: true })} />
          </div>
          <div>
            <label className="text-sm font-medium">Similarity Threshold</label>
            <Input type="number" step="0.01" {...form.register("sim_threshold", { valueAsNumber: true })} />
          </div>
          <div>
            <label className="text-sm font-medium">Fail-safe Threshold</label>
            <Input type="number" step="0.01" {...form.register("fail_safe_threshold", { valueAsNumber: true })} />
          </div>
        </div>
        <Button type="submit">Save</Button>
      </form>

      {/* Documents Section */}
      <AgentDocuments agentId={agentId} />
    </div>
  );
}

