import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";

export default function Settings() {
  const { user } = useAuth();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const saveToken = async () => {
    if (!user) return;
    setLoading(true);
    setMessage(null);
    const { error } = await supabase
      .from("users")
      .update({ linear_api_token: token })
      .eq("id", user.id);
    if (error) setMessage(error.message);
    else setMessage("Saved Linear API token.");
    setLoading(false);
  };

  const testConnection = async () => {
    if (!user) return;
    setLoading(true);
    setMessage(null);
    const { data, error } = await supabase.functions.invoke("sync_linear_project", {
      body: { user_id: user.id },
    });
    if (error) setMessage(error.message);
    else setMessage(`Linear response: ${JSON.stringify(data?.linear?.data ?? data)}`);
    setLoading(false);
  };

  return (
    <div>
      <Header />
      <main className="p-6 space-y-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold">Settings</h1>

        <div className="space-y-2">
          <label className="text-sm font-medium">Linear API Token</label>
          <Input
            type="password"
            placeholder="lin_api_..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={saveToken} disabled={!user || loading || !token}>
              {loading ? "Saving..." : "Save"}
            </Button>
            <Button variant="secondary" onClick={testConnection} disabled={!user || loading}>
              {loading ? "Testing..." : "Test Linear Connection"}
            </Button>
          </div>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </div>
      </main>
    </div>
  );
}

