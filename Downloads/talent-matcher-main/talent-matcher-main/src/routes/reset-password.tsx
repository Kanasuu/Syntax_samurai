import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GraduationCap, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

function ResetPasswordPage() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase redirects here with access_token in the URL hash
    // The auth listener in AuthProvider will pick up the session automatically
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    // Also check if we already have a session (user clicked the link)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSuccess(true);
      toast.success("Password updated successfully!");
      setTimeout(() => nav({ to: "/login" }), 3000);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen grid place-items-center px-4" style={{ background: "var(--gradient-subtle)" }}>
        <div className="w-full max-w-md text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 grid place-items-center">
            <CheckCircle className="h-7 w-7 text-green-600" />
          </div>
          <h1 className="font-display text-2xl">Password updated!</h1>
          <p className="text-sm text-muted-foreground">Redirecting you to sign in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center px-4" style={{ background: "var(--gradient-subtle)" }}>
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <div className="h-9 w-9 rounded-md grid place-items-center text-primary-foreground" style={{ background: "var(--gradient-primary)" }}><GraduationCap className="h-5 w-5" /></div>
          <span className="font-display text-xl">Placement Cell</span>
        </Link>
        <div className="rounded-xl border bg-card p-7 shadow-[var(--shadow-soft)]">
          <h1 className="font-display text-2xl">Set new password</h1>
          <p className="text-sm text-muted-foreground mt-1">Choose a strong new password for your account.</p>
          {!ready ? (
            <div className="text-sm text-muted-foreground mt-5 py-4 text-center">
              Loading your session... If this takes too long, try clicking the reset link from your email again.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4 mt-5">
              <div>
                <Label htmlFor="password">New password</Label>
                <Input id="password" type="password" required minLength={6} placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="confirm">Confirm password</Label>
                <Input id="confirm" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Updating..." : "Update password"}</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
