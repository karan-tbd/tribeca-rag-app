import { z } from "zod";

export const agentSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional().or(z.literal("")),
  system_prompt: z.string().max(4000).optional().or(z.literal("")),
  query_template: z.string().max(2000).optional().or(z.literal("")),
  embed_model: z.string().default("text-embedding-3-small"),
  gen_model: z.string().default("gpt-4o-mini"),
  k: z.coerce.number().int().min(1).max(20).default(5),
  sim_threshold: z.coerce.number().min(0).max(1).default(0.75),
  fail_safe_threshold: z.coerce.number().min(0).max(1).default(0.5),
});

export type AgentFormValues = z.infer<typeof agentSchema>;

