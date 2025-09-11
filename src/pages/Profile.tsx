import Header from "@/components/Header";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ id: string; email: string; name: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("id, email, name, avatar_url")
        .eq("id", user.id)
        .single();
      setProfile(data ?? null);
    })();
  }, [user]);

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-3xl p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Profile</h1>
        {profile ? (
          <div className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><span className="font-medium">ID:</span> {profile.id}</div>
            <div><span className="font-medium">Email:</span> {profile.email}</div>
            <div><span className="font-medium">Name:</span> {profile.name ?? "—"}</div>
            <div><span className="font-medium">Avatar URL:</span> {profile.avatar_url ?? "—"}</div>
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">Loading…</div>
        )}
      </main>
    </div>
  );
}

