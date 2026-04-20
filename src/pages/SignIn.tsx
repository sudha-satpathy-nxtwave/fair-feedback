import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogIn, ShieldCheck, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SignIn = () => {
  const { user, roleInfo, loading, signIn, refreshRole } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  // sign in
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // sign up
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suSubmitting, setSuSubmitting] = useState(false);
  const [suError, setSuError] = useState("");

  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [checkingBootstrap, setCheckingBootstrap] = useState(true);
  const navigate = useNavigate();

  // Detect if any admin exists (used to decide if signup is allowed for first-run bootstrap)
  useEffect(() => {
    (async () => {
      setCheckingBootstrap(true);
      const { count } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      const hasNoAdmin = (count ?? 0) === 0;
      setNeedsBootstrap(hasNoAdmin);
      // Default to signup tab if no admin exists yet
      if (hasNoAdmin && !user) setTab("signup");
      setCheckingBootstrap(false);
    })();
  }, [user]);

  if (loading || checkingBootstrap) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (user && roleInfo) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!needsBootstrap) {
      setSuError("Public signup is disabled. Ask your admin to create an account for you.");
      return;
    }
    if (suPassword.length < 6) {
      setSuError("Password must be at least 6 characters.");
      return;
    }
    setSuSubmitting(true);
    setSuError("");

    const redirectUrl = `${window.location.origin}/signin`;
    const { data, error } = await supabase.auth.signUp({
      email: suEmail.trim(),
      password: suPassword,
      options: { emailRedirectTo: redirectUrl },
    });

    if (error) {
      setSuError(error.message);
      setSuSubmitting(false);
      return;
    }

    // If session is returned (auto-confirm enabled), claim admin immediately
    if (data.session && data.user) {
      const { error: roleErr } = await supabase
        .from("user_roles")
        .insert({ user_id: data.user.id, role: "admin" });
      if (roleErr) {
        toast.error(`Account created but admin claim failed: ${roleErr.message}`);
      } else {
        await refreshRole();
        toast.success("Admin account created! Redirecting…");
        navigate("/dashboard");
      }
    } else {
      toast.success("Check your email to confirm your account, then sign in.");
      setTab("signin");
    }
    setSuSubmitting(false);
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
            <h1 className="text-lg font-bold text-foreground">Welcome</h1>
            <p className="text-xs text-muted-foreground">
              {needsBootstrap ? "First-time setup — create your admin account" : "Admin & instructor access"}
            </p>
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

        <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
          <TabsList className="grid w-full grid-cols-2 mb-5">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup" disabled={!needsBootstrap}>
              Sign Up {needsBootstrap && <span className="ml-1 text-[10px] text-primary">(Admin)</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
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

              {error && <p className="text-sm text-destructive font-medium">{error}</p>}

              <Button type="submit" disabled={submitting} className="w-full h-11 gap-2 rounded-xl">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                Sign In
              </Button>
            </form>

            {!needsBootstrap && (
              <p className="text-xs text-muted-foreground text-center mt-5">
                Accounts are created by your admin. No public signup.
              </p>
            )}
          </TabsContent>

          <TabsContent value="signup">
            {needsBootstrap ? (
              <>
                <div className="mb-4 p-3 rounded-xl bg-primary/8 border border-primary/30">
                  <p className="text-xs text-foreground">
                    <strong>First-time setup:</strong> The first account created becomes the Admin. After that, only the
                    admin can create new accounts from the dashboard.
                  </p>
                </div>
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-foreground">Admin Email</label>
                    <Input
                      type="email"
                      autoComplete="email"
                      required
                      value={suEmail}
                      onChange={(e) => setSuEmail(e.target.value)}
                      className="bg-secondary/50 border-border/60"
                      placeholder="you@school.edu"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-foreground">Password</label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                      value={suPassword}
                      onChange={(e) => setSuPassword(e.target.value)}
                      className="bg-secondary/50 border-border/60"
                      placeholder="min 6 characters"
                    />
                  </div>

                  {suError && <p className="text-sm text-destructive font-medium">{suError}</p>}

                  <Button type="submit" disabled={suSubmitting} className="w-full h-11 gap-2 rounded-xl">
                    {suSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Create Admin Account
                  </Button>
                </form>
              </>
            ) : (
              <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
                <p className="text-sm font-semibold text-foreground">Signup is disabled</p>
                <p className="text-xs text-muted-foreground mt-1">
                  An admin already exists. Ask them to create an account for you from the dashboard.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default SignIn;
