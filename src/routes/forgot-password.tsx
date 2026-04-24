import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GraduationCap, ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
      toast.success("Password reset email sent!");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4" style={{ background: "var(--gradient-subtle)" }}>
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <div className="h-9 w-9 rounded-md grid place-items-center text-primary-foreground" style={{ background: "var(--gradient-primary)" }}><GraduationCap className="h-5 w-5" /></div>
          <span className="font-display text-xl">Placement Cell</span>
        </Link>
        <div className="rounded-xl border bg-card p-7 shadow-[var(--shadow-soft)]">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-accent/10 grid place-items-center">
                <Mail className="h-6 w-6 text-accent" />
              </div>
              <h1 className="font-display text-2xl">Check your email</h1>
              <p className="text-sm text-muted-foreground">
                We sent a password reset link to <span className="font-medium text-foreground">{email}</span>. Click the link in the email to set a new password.
              </p>
              <p className="text-xs text-muted-foreground">Didn't receive it? Check your spam folder or try again.</p>
              <Button variant="outline" className="w-full" onClick={() => setSent(false)}>Try another email</Button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl">Forgot password?</h1>
              <p className="text-sm text-muted-foreground mt-1">Enter your email and we'll send you a reset link.</p>
              <form onSubmit={onSubmit} className="space-y-4 mt-5">
                <div>
                  <Label htmlFor="email">Email address</Label>
                  <Input id="email" type="email" required placeholder="you@university.edu" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Sending..." : "Send reset link"}</Button>
              </form>
            </>
          )}
          <p className="text-sm text-muted-foreground mt-4 text-center">
            <Link to="/login" className="text-accent hover:underline inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
