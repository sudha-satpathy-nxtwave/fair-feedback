import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, Save, Loader2, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { hashPin } from "@/lib/pinHash";
import { toast } from "sonner";

interface ConfigRow {
  id: string;
  master_pin_hash: string;
  co_admin_pin_hash: string | null;
}

const CoAdminPinAdmin = () => {
  const [config, setConfig] = useState<ConfigRow | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("admin_config")
      .select("id, master_pin_hash, co_admin_pin_hash")
      .limit(1)
      .maybeSingle();
    setConfig(data);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const save = async () => {
    if (pin.length < 4) return toast.error("PIN must be ≥ 4 digits");
    if (!config) return;
    setBusy(true);
    const hash = await hashPin(pin);
    const { error } = await supabase
      .from("admin_config")
      .update({ co_admin_pin_hash: hash })
      .eq("id", config.id);
    setBusy(false);
    if (error) return toast.error("Failed to save");
    setPin("");
    toast.success("Co-Admin PIN saved");
    refresh();
  };

  const clear = async () => {
    if (!config) return;
    if (!confirm("Remove the Co-Admin PIN? Anyone using it will lose access.")) return;
    setBusy(true);
    const { error } = await supabase
      .from("admin_config")
      .update({ co_admin_pin_hash: null })
      .eq("id", config.id);
    setBusy(false);
    if (error) return toast.error("Failed to clear");
    toast.success("Co-Admin PIN removed");
    refresh();
  };

  if (loading) {
    return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3 max-w-sm"
    >
      <div>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" />
          Co-Admin PIN
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          A second PIN that grants Co-Admin access (can use bulk upload, but cannot change PINs).
        </p>
      </div>

      {config?.co_admin_pin_hash && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-success/10 text-success border border-success/20">
          <Check className="w-3.5 h-3.5" />
          A Co-Admin PIN is currently set.
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-semibold text-foreground">
          {config?.co_admin_pin_hash ? "Replace PIN" : "Set PIN"}
        </label>
        <Input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="••••"
        />
        <div className="flex gap-2">
          <Button onClick={save} disabled={busy || pin.length < 4} size="sm" className="gap-1.5">
            <Save className="w-3.5 h-3.5" />
            {busy ? "Saving..." : "Save"}
          </Button>
          {config?.co_admin_pin_hash && (
            <Button onClick={clear} disabled={busy} size="sm" variant="outline" className="gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default CoAdminPinAdmin;
