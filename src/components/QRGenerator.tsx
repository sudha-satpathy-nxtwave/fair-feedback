import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QrCode, Copy, Check } from "lucide-react";

const QRGenerator = () => {
  const [sessionId, setSessionId] = useState("");
  const [generated, setGenerated] = useState("");
  const [copied, setCopied] = useState(false);

  const feedbackUrl = generated
    ? `${window.location.origin}/feedback?session=${encodeURIComponent(generated)}`
    : "";

  const handleGenerate = () => {
    if (sessionId.trim()) {
      setGenerated(sessionId.trim().toLowerCase().replace(/\s+/g, "-"));
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(feedbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold text-foreground">Generate Session QR</h2>
        <p className="text-sm text-muted-foreground">Create a QR code for students to scan</p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="e.g. react-day-3"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          className="bg-secondary/50 border-border/60 text-base"
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
        />
        <Button onClick={handleGenerate} disabled={!sessionId.trim()} className="shrink-0">
          <QrCode className="w-4 h-4 mr-1.5" />
          Generate
        </Button>
      </div>

      {generated && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 pt-2"
        >
          <div className="bg-card p-4 rounded-xl border border-border">
            <QRCodeSVG value={feedbackUrl} size={200} level="H" />
          </div>
          <div className="w-full space-y-2">
            <p className="text-xs text-muted-foreground text-center font-medium">
              Session: <span className="text-foreground">{generated}</span>
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="w-full text-xs"
            >
              {copied ? (
                <><Check className="w-3 h-3 mr-1.5" /> Copied!</>
              ) : (
                <><Copy className="w-3 h-3 mr-1.5" /> Copy Link</>
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default QRGenerator;
