import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { GraduationCap, Sparkles, BellRing, Briefcase, ArrowRight } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const { user, role, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && user && role) {
      nav({ to: role === "admin" ? "/admin" : "/student" });
    }
  }, [loading, user, role, nav]);

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md grid place-items-center text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-display text-lg">Placement Cell</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <Link to="/register"><Button size="sm">Get started</Button></Link>
        </div>
      </header>

      <section className="container mx-auto px-4 py-20 md:py-28 text-center max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 text-accent" /> AI-powered semantic matching
        </div>
        <h1 className="font-display text-5xl md:text-7xl mt-6 leading-[1.05] text-primary">
          Where students meet
          <span className="block" style={{ background: "var(--gradient-accent)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>their next opportunity.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
          A modern placement cell for engineering colleges. Officers post roles, students apply,
          and an AI advisor ranks every match in real time.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/register"><Button size="lg">Create account <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
          <Link to="/login"><Button size="lg" variant="outline">Sign in</Button></Link>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-24 grid md:grid-cols-3 gap-4 max-w-5xl">
        {[
          { icon: Briefcase, title: "Curated opportunities", body: "Officers publish jobs and internships with eligibility rules — students see only what fits." },
          { icon: Sparkles, title: "AI recommendations", body: "Upload a resume and the AI advisor explains exactly why each role matches your profile." },
          { icon: BellRing, title: "Realtime updates", body: "Notifications stream live the moment new matches appear or your application status changes." },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="h-10 w-10 rounded-md grid place-items-center bg-secondary text-primary"><f.icon className="h-5 w-5" /></div>
            <h3 className="font-display text-xl mt-4">{f.title}</h3>
            <p className="text-sm text-muted-foreground mt-2">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
