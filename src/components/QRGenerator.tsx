import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QrCode, Copy, Check } from "lucide-react";
import { getLocalDateString } from "@/lib/dateUtils";

const QRGenerator = () => {
  const [instructorName, setInstructorName] = useState("");
  // FIX: use local-timezone date, not UTC, so it matches what SessionCodeAdmin saves.
  const [date, setDate] = useState(() => getLocalDateString());
  const [generated, setGenerated] = useState<{ instructor: string; date: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const sessionId = generated
    ? `${generated.instructor.trim().toLowerCase().replace(/\s+/g, "-")}_${generated.date}`
    : "";

  const feedbackUrl = sessionId
    ? `${window.location.origin}/feedback?instructor=${encodeURIComponent(generated!.instructor.trim())}&date=${generated!.date}`
    : "";

  const handleGenerate = () => {
    if (instructorName.trim() && date) {
      setGenerated({ instructor: instructorName.trim(), date });
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

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">Instructor Name</label>
          <Input
            placeholder="e.g. John Smith"
            value={instructorName}
            onChange={(e) => setInstructorName(e.target.value)}
            className="bg-secondary/50 border-border/60 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">Date</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-secondary/50 border-border/60 text-base"
          />
        </div>
        <Button onClick={handleGenerate} disabled={!instructorName.trim() || !date} className="w-full">
          <QrCode className="w-4 h-4 mr-1.5" />
          Generate QR Code
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
              Instructor: <span className="text-foreground">{generated.instructor}</span>
              {" · "}
              Date: <span className="text-foreground">{generated.date}</span>
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
