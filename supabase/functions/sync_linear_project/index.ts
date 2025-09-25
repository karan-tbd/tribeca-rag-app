// Supabase Edge Function: sync_linear_project
// Deno runtime
// Reads the caller's Linear API token from public.users and performs a simple GraphQL query to test connectivity.
// Expects JSON body: { user_id: string, projectId?: string }

import { getSupabaseAdmin } from "../_shared/supabase.ts";

const supabase = getSupabaseAdmin();

Deno.serve(async (req) => {
  try {
    const { user_id, projectId } = await req.json().catch(() => ({ user_id: undefined }));
    if (!user_id) {
      return json({ error: "Missing user_id" }, 400);
    }

    const { data, error } = await supabase
      .from("users")
      .select("linear_api_token")
      .eq("id", user_id)
      .single();

    if (error) return json({ error: error.message }, 500);
    const token = data?.linear_api_token as string | null;
    if (!token) return json({ error: "No Linear API token found for user." }, 400);

    // Minimal GraphQL query; switch to project-specific queries later
    const query = projectId
      ? `query($id: String!) { project(id: $id) { id name description } }`
      : `query { viewer { id name } }`;

    const variables = projectId ? { id: projectId } : undefined;

    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    const linear = await res.json();
    if (!res.ok) {
      return json({ error: "Linear API error", linear }, res.status);
    }

    return json({ ok: true, linear });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

