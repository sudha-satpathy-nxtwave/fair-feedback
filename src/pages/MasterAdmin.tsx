import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP, InputOTPGroup, InputOTPSlot,
} from "@/components/ui/input-otp";
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
  const [masterHash, setMasterHash] = useState<string | null>(null);
  const [coAdminHash, setCoAdminHash] = useState<string | null>(null);

  // Form state
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("admin_config")
        .select("id, master_pin_hash, co_admin_pin_hash")
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
        setMasterHash(data.master_pin_hash);
        setCoAdminHash(data.co_admin_pin_hash);
        setMode("signin");
      }
    })();
  }, []);

  const handleSetup = async () => {
    if (pin.length < 4) return toast.error("PIN must be at least 4 digits");
    if (pin !== confirmPin) return toast.error("PINs don't match");
    setBusy(true);
    const hash = await hashPin(pin);
    const { data, error } = await supabase
      .from("admin_config")
      .insert({ master_pin_hash: hash })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) {
      toast.error("Failed to save PIN");
      return;
    }
    setSession({ role: "admin" });
    toast.success("Master PIN set. You're signed in.");
    navigate("/dashboard");
  };

  const handleSignIn = async () => {
    if (pin.length < 4) return toast.error("Enter your PIN");
    setBusy(true);
    if (masterHash && (await verifyPin(pin, masterHash))) {
      setSession({ role: "admin" });
      toast.success("Signed in as Admin");
      navigate("/dashboard");
      return;
    }
    if (coAdminHash && (await verifyPin(pin, coAdminHash))) {
      setSession({ role: "co-admin" });
      toast.success("Signed in as Co-Admin");
      navigate("/dashboard");
      return;
    }
    setBusy(false);
    toast.error("Invalid PIN");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-border/50 bg-card/70 backdrop-blur-xl p-8 space-y-6"
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
              No master PIN exists yet. Set one now — this becomes the key to admin access.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">New Master PIN (min 4 digits)</label>
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
            <Button onClick={handleSetup} disabled={busy} className="w-full gap-2">
              <KeyRound className="w-4 h-4" />
              {busy ? "Saving..." : "Set Master PIN"}
            </Button>
          </div>
        )}

        {mode === "signin" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your Master or Co-Admin PIN.
            </p>
            <div className="flex justify-center">
              <InputOTP maxLength={8} value={pin} onChange={(v) => setPin(v.replace(/\D/g, ""))}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button onClick={handleSignIn} disabled={busy || pin.length < 4} className="w-full gap-2">
              <Lock className="w-4 h-4" />
              {busy ? "Verifying..." : "Unlock"}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default MasterAdmin;
