import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "@/hooks/use-toast";
import { FEATURE_FLAGS } from "@/lib/flags";

export default function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingMicrosoft, setLoadingMicrosoft] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [email, setEmail] = useState("test@gmail.com");
  const [password, setPassword] = useState("test123");

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const signInWithGoogle = async () => {
    try {
      setLoadingGoogle(true);
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
    } catch (err: any) {
      console.error("Google sign-in failed", err);
      toast({ title: "Sign-in failed", description: err?.message ?? "Please try again." });
      setLoadingGoogle(false);
    }
  };
  const signInWithMicrosoft = async () => {
    try {
      setLoadingMicrosoft(true);
      await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: { redirectTo: window.location.origin, scopes: "email offline_access" },
      });
    } catch (err: any) {
      console.error("Microsoft sign-in failed", err);
      toast({ title: "Sign-in failed", description: err?.message ?? "Please try again." });
      setLoadingMicrosoft(false);
    }
  };

  const signInWithEmail = async () => {
    try {
      setLoadingEmail(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        toast({ title: "Sign-in failed", description: error.message });
      }
    } catch (err: any) {
      console.error("Email sign-in failed", err);
      toast({ title: "Sign-in failed", description: err?.message ?? "Please try again." });
    } finally {
      setLoadingEmail(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-muted-foreground">Continue to your dashboard using your organization account.</p>
        </div>
        <div className="space-y-4">
          {/* Email/Password Form */}
          {FEATURE_FLAGS.ENABLE_AUTH_EMAIL && (
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Development Login</div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                onClick={signInWithEmail}
                className="w-full"
                disabled={loadingEmail}
                variant="outline"
              >
                {loadingEmail ? "Signing in..." : "Sign in with Email"}
              </Button>
            </div>
          )}

          {/* OAuth Providers */}
          <div className="space-y-2">
            {FEATURE_FLAGS.ENABLE_AUTH_GOOGLE && (
              <Button onClick={signInWithGoogle} className="w-full" disabled={loadingGoogle}>
                {loadingGoogle ? "Redirecting to Google…" : "Continue with Google"}
              </Button>
            )}
            {FEATURE_FLAGS.ENABLE_AUTH_MICROSOFT && (
              <Button onClick={signInWithMicrosoft} className="w-full" disabled={loadingMicrosoft}>
                {loadingMicrosoft ? "Redirecting to Microsoft…" : "Continue with Microsoft"}
              </Button>
            )}
          </div>

          {/* No providers message */}
          {!FEATURE_FLAGS.ENABLE_AUTH_GOOGLE &&
           !FEATURE_FLAGS.ENABLE_AUTH_MICROSOFT &&
           !FEATURE_FLAGS.ENABLE_AUTH_EMAIL && (
            <div className="text-sm text-muted-foreground">No authentication providers are enabled.</div>
          )}
        </div>
      </div>
    </div>
  );
}
