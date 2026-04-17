import { useState, useEffect } from "react";
import { KeyRound, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getLocalDateString } from "@/lib/dateUtils";

interface Props {
  instructorId: string;
}

const SessionCodeAdmin = ({ instructorId }: Props) => {
  const [code, setCode] = useState("");
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const today = getLocalDateString();

  useEffect(() => {
    if (!instructorId) return;
    supabase
      .from("session_codes")
      .select("code")
      .eq("instructor_id", instructorId)
      .eq("active_date", today)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setCurrentCode(data.code);
      });
  }, [instructorId, today]);

  const handleSave = async () => {
    if (code.length !== 4 || !instructorId) return;
    setSaving(true);

    const { error } = await supabase.from("session_codes").upsert(
      { instructor_id: instructorId, code, active_date: today },
      { onConflict: "instructor_id,active_date" }
    );

    setSaving(false);

    if (error) {
      toast.error("Failed to save code");
      return;
    }

    setCurrentCode(code);
    toast.success("Session code saved!");
  };

  return (
    <div className="space-y-6 max-w-sm">
      <div>
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" />
          Session Code for Today
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Set a 4-digit code students must enter to access the feedback form.
        </p>
      </div>

      {currentCode && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
          <Check className="w-4 h-4 text-green-500" />
          <span className="text-sm font-semibold text-foreground tracking-widest">{currentCode}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(currentCode); toast.info("Code copied!"); }}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="space-y-3">
        <label className="text-sm font-semibold text-foreground">
          {currentCode ? "Update Code" : "Set New Code"}
        </label>
        <InputOTP maxLength={4} value={code} onChange={setCode}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
          </InputOTPGroup>
        </InputOTP>
        <Button onClick={handleSave} disabled={code.length !== 4 || saving} size="sm" className="gap-1.5">
          <KeyRound className="w-3.5 h-3.5" />
          {saving ? "Saving..." : "Save Code"}
        </Button>
      </div>
    </div>
  );
};

export default SessionCodeAdmin;
