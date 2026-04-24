import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { signIn, user, role } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user && role) nav({ to: role === "admin" ? "/admin" : "/student" }); }, [user, role, nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) toast.error(error.message);
      else toast.success("Welcome back!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
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
          <h1 className="font-display text-2xl">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account.</p>
          <form onSubmit={onSubmit} className="space-y-4 mt-5">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="text-right">
              <Link to="/forgot-password" className="text-xs text-accent hover:underline">Forgot password?</Link>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</Button>
          </form>
          <p className="text-sm text-muted-foreground mt-4 text-center">
            No account? <Link to="/register" className="text-accent hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
