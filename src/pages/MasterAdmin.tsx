import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, KeyRound, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useLocalAuth } from "@/contexts/LocalAuthContext";
import { hashPin, verifyPin } from "@/lib/pinHash";
import { toast } from "sonner";

type Mode = "loading" | "setup" | "signin";

const MasterAdmin = () => {
  const navigate = useNavigate();
  const { setSession } = useLocalAuth();
  const [mode, setMode] = useState<Mode>("loading");
  const [configId, setConfigId] = useState<string | null>(null);
  const [storedUsername, setStoredUsername] = useState<string | null>(null);
  const [masterHash, setMasterHash] = useState<string | null>(null);

  // Form state
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("admin_config")
        .select("id, username, master_pin_hash")
        .limit(1)
        .maybeSingle();
      if (error) {
        toast.error("Could not load admin config");
        setMode("setup");
        return;
      }
      if (!data) {
        setMode("setup");
      } else {
        setConfigId(data.id);
        setStoredUsername((data as { username: string | null }).username ?? null);
        setMasterHash(data.master_pin_hash);
        setMode("signin");
      }
    })();
  }, []);

  const handleSetup = async () => {
    const trimmedUser = username.trim().toLowerCase();
    if (!trimmedUser) return toast.error("Choose a username");
    if (pin.length < 4) return toast.error("PIN must be at least 4 digits");
    if (pin !== confirmPin) return toast.error("PINs don't match");
    setBusy(true);
    const hash = await hashPin(pin);
    const { error } = await supabase
      .from("admin_config")
      .insert({ master_pin_hash: hash, username: trimmedUser });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("singleton") ? "A master admin already exists" : "Failed to save");
      return;
    }
    setSession({ role: "admin", username: trimmedUser });
    toast.success(`Master admin "${trimmedUser}" created. Welcome!`);
    setTimeout(() => navigate("/dashboard"), 400);
  };

  const handleSignIn = async () => {
    const trimmedUser = username.trim().toLowerCase();
    if (!trimmedUser) return toast.error("Enter your username");
    if (pin.length < 4) return toast.error("Enter your PIN");
    setBusy(true);
    if (storedUsername && trimmedUser !== storedUsername) {
      setBusy(false);
      return toast.error("Invalid username or PIN");
    }
    if (masterHash && (await verifyPin(pin, masterHash))) {
      setSession({ role: "admin", username: trimmedUser });
      toast.success("Signed in as Master Admin");
      navigate("/dashboard");
      return;
    }
    setBusy(false);
    toast.error("Invalid username or PIN");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-border/50 bg-card/70 backdrop-blur-xl p-8 space-y-6 shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.3)]"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Master Admin</h1>
            <p className="text-xs text-muted-foreground">
              {mode === "setup" ? "First-time setup" : "Restricted access"}
            </p>
          </div>
        </div>

        {mode === "loading" && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {mode === "setup" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              No master admin exists yet. Set your unique username and PIN — only one master admin can exist.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Master Username
              </label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. principal"
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Master PIN (min 4 digits)</label>
              <Input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="••••"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Confirm PIN</label>
              <Input
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="••••"
                autoComplete="new-password"
              />
            </div>
            <Button onClick={handleSetup} disabled={busy} className="w-full gap-2 h-11">
              <KeyRound className="w-4 h-4" />
              {busy ? "Creating..." : "Create Master Admin"}
            </Button>
          </div>
        )}

        {mode === "signin" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your master admin username and PIN.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Username
              </label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                autoComplete="username"
                onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">PIN</label>
              <Input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="••••"
                autoComplete="current-password"
                onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
              />
            </div>
            <Button onClick={handleSignIn} disabled={busy || pin.length < 4} className="w-full gap-2 h-11">
              <Lock className="w-4 h-4" />
              {busy ? "Verifying..." : "Unlock Dashboard"}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default MasterAdmin;
