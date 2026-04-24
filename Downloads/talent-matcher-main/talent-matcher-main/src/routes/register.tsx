import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/register")({ component: RegisterPage });

function RegisterPage() {
  const { signUp, user, role } = useAuth();
  const nav = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"student" | "admin">("student");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user && role) nav({ to: role === "admin" ? "/admin" : "/student" }); }, [user, role, nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const { error, confirmEmail } = await signUp(email, password, fullName, accountType);
      if (error) {
        toast.error(error.message);
      } else if (confirmEmail) {
        toast.success("Account created! Please check your email to confirm your account before signing in.");
      } else {
        toast.success("Account created — you're signed in!");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10" style={{ background: "var(--gradient-subtle)" }}>
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <div className="h-9 w-9 rounded-md grid place-items-center text-primary-foreground" style={{ background: "var(--gradient-primary)" }}><GraduationCap className="h-5 w-5" /></div>
          <span className="font-display text-xl">Placement Cell</span>
        </Link>
        <div className="rounded-xl border bg-card p-7 shadow-[var(--shadow-soft)]">
          <h1 className="font-display text-2xl">Create your account</h1>
          <p className="text-sm text-muted-foreground mt-1">Choose your role to get started.</p>

          <div className="grid grid-cols-2 gap-2 mt-5">
            {(["student", "admin"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setAccountType(t)}
                className={`rounded-md border px-3 py-3 text-sm capitalize transition-all ${accountType === t ? "border-accent bg-accent/10 text-accent font-medium" : "hover:bg-secondary"}`}>
                {t === "admin" ? "Placement Officer" : "Student"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-4 mt-5">
            <div>
              <Label htmlFor="fullname">Full name</Label>
              <Input id="fullname" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating account..." : "Create account"}</Button>
          </form>
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Already have one? <Link to="/login" className="text-accent hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
