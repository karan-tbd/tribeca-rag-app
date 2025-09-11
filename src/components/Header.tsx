import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";

export default function Header() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const name = (user?.user_metadata as any)?.full_name as string | undefined;
  const avatar = (user?.user_metadata as any)?.avatar_url as string | undefined;

  const initials = (name ?? user?.email ?? "?")
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <header className="w-full border-b bg-background">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/dashboard" className="font-semibold">Tribeca</Link>
          <Link to="/agents" className="text-muted-foreground hover:text-foreground">Agents</Link>
          <Link to="/documents" className="text-muted-foreground hover:text-foreground">Documents</Link>
          <Link to="/profile" className="text-muted-foreground hover:text-foreground">Profile</Link>
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatar} alt={name ?? ""} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="text-sm hidden sm:inline">{name ?? user?.email}</span>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    </header>
  );
}

