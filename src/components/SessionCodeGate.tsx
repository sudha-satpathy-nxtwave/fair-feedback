import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";

interface SessionCodeGateProps {
  instructorId: string;
  onVerified: () => void;
}

const SessionCodeGate = ({ instructorId, onVerified }: SessionCodeGateProps) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 4) {
      setError("Please enter a 4-digit code.");
      return;
    }

    setLoading(true);
    setError("");

    const today = new Date().toISOString().split("T")[0];

    const { data, error: dbError } = await supabase
      .from("session_codes")
      .select("code")
      .eq("instructor_id", instructorId)
      .eq("active_date", today)
      .maybeSingle();

    setLoading(false);

    if (dbError) {
      setError("Could not verify code. Please try again.");
      return;
    }

    if (!data) {
      setError("No session code set for today. Contact your instructor.");
      return;
    }

    if (data.code !== code) {
      setError("Invalid code. Please check with your instructor.");
      return;
    }

    onVerified();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 text-center"
    >
      <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Lock className="w-7 h-7 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-foreground">Enter Session Code</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your instructor will share a 4-digit code to unlock the feedback form.
        </p>
      </div>

      <div className="flex justify-center">
        <InputOTP maxLength={4} value={code} onChange={setCode}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      {error && (
        <p className="text-sm text-destructive font-medium">{error}</p>
      )}

      <Button
        onClick={handleVerify}
        disabled={code.length !== 4 || loading}
        className="w-full h-11 rounded-xl gap-2"
      >
        <ShieldCheck className="w-4 h-4" />
        {loading ? "Verifying..." : "Unlock Session"}
      </Button>
    </motion.div>
  );
};

export default SessionCodeGate;
