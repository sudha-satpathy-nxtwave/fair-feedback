import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogIn, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SignIn = () => {
  const { user, roleInfo, loading, signIn, refreshRole } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const navigate = useNavigate();

  // Detect if any admin exists (used for first-run bootstrap UI)
  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      setNeedsBootstrap((count ?? 0) === 0);
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (user && roleInfo) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const { error } = await signIn(email.trim(), password);
    if (error) {
      setError(error);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    navigate("/dashboard");
  };

  const claimAdmin = async () => {
    if (!user) {
      toast.error("Sign in first, then claim admin.");
      return;
    }
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role: "admin" });
    if (error) {
      toast.error(`Failed: ${error.message}`);
      return;
    }
    await refreshRole();
    toast.success("You are now the Admin");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-md rounded-3xl border border-border/60 bg-card/70 backdrop-blur-xl p-7 sm:p-8 shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.25)]"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Sign In</h1>
            <p className="text-xs text-muted-foreground">Admin & instructor access</p>
          </div>
        </div>

        {user && !roleInfo && needsBootstrap && (
          <div className="mb-5 p-4 rounded-xl bg-amber-500/8 border border-amber-500/30 space-y-2">
            <p className="text-sm font-semibold text-foreground">No admin account yet</p>
            <p className="text-xs text-muted-foreground">
              Your signed-in account ({user.email}) has no role. Claim the admin role for first-time setup.
            </p>
            <Button onClick={claimAdmin} size="sm" className="gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Claim Admin Role
            </Button>
          </div>
        )}

        {user && !roleInfo && !needsBootstrap && (
          <div className="mb-5 p-4 rounded-xl bg-destructive/8 border border-destructive/30">
            <p className="text-sm text-destructive font-semibold">No role assigned</p>
            <p className="text-xs text-muted-foreground mt-1">
              Contact an admin to grant you instructor access.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Email</label>
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-secondary/50 border-border/60"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Password</label>
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-secondary/50 border-border/60"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}

          <Button type="submit" disabled={submitting} className="w-full h-11 gap-2 rounded-xl">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Sign In
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-5">
          Accounts are created by your admin. No public signup.
        </p>
      </motion.div>
    </div>
  );
};

export default SignIn;
