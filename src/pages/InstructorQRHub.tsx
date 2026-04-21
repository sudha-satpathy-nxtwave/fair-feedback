import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Download, Copy, Check, QrCode, Plus, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Instructor {
  id: string;            // username slug
  displayName: string;
  qrImageUrl?: string | null;
}

const QRCard = ({ instructor }: { instructor: Instructor }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/feedback?instructor=${encodeURIComponent(instructor.displayName)}&ref=${instructor.id}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    if (instructor.qrImageUrl) {
      // Direct download of uploaded image
      const a = document.createElement("a");
      a.href = instructor.qrImageUrl;
      a.download = `${instructor.id}_qr.png`;
      a.target = "_blank";
      a.click();
      return;
    }
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const size = 720;
    canvas.width = size;
    canvas.height = size + 80;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 40, 40, size - 80, size - 80);
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 28px 'Plus Jakarta Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(instructor.displayName, size / 2, size + 30);
      ctx.font = "16px 'Plus Jakarta Sans', sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("Scan to give feedback", size / 2, size + 60);
      const link = document.createElement("a");
      link.download = `${instructor.id}_qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      className="rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/30 p-5 space-y-4"
    >
      <div>
        <h3 className="text-base font-bold text-foreground capitalize">{instructor.displayName}</h3>
        <p className="text-xs text-muted-foreground font-mono">/{instructor.id}</p>
        {instructor.qrImageUrl && (
          <p className="text-[10px] text-primary mt-0.5 flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />Custom QR
          </p>
        )}
      </div>

      <div ref={ref} className="bg-white p-4 rounded-xl flex items-center justify-center min-h-[212px]">
        {instructor.qrImageUrl ? (
          <img src={instructor.qrImageUrl} alt={`${instructor.displayName} QR`} className="max-h-44 object-contain" />
        ) : (
          <QRCodeSVG value={url} size={180} level="H" />
        )}
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={handleCopy} className="flex-1 gap-1.5 text-xs">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy Link"}
        </Button>
        <Button size="sm" onClick={handleDownload} className="flex-1 gap-1.5 text-xs">
          <Download className="w-3.5 h-3.5" />
          Download
        </Button>
      </div>
    </motion.div>
  );
};

const InstructorQRHub = () => {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from("instructor_profiles")
      .select("username, display_name, qr_image_url")
      .order("display_name");
    setInstructors(
      (profiles ?? []).map((p) => ({
        id: p.username,
        displayName: p.display_name,
        qrImageUrl: p.qr_image_url,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const id = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (instructors.some((i) => i.id === id)) {
      toast.info("Instructor already in list");
      return;
    }
    const { error } = await supabase.from("instructor_profiles").insert({
      username: id,
      display_name: trimmed,
    });
    if (error) {
      toast.error(`Failed: ${error.message}`);
      return;
    }
    setNewName("");
    toast.success(`Added ${trimmed}`);
    load();
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto space-y-6"
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Instructor QR Hub</h1>
              <p className="text-xs text-muted-foreground">Permanent feedback links per instructor</p>
            </div>
          </div>
          <Link to="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Dashboard
            </Button>
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Add new instructor (no custom QR)</label>
            <Input
              placeholder="e.g. John Smith"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="h-9"
            />
            <p className="text-[10px] text-muted-foreground">
              Instructors normally self-register at <code>/setup</code> where they can also upload a custom QR.
            </p>
          </div>
          <Button size="sm" onClick={handleAdd} disabled={!newName.trim()} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-12">Loading...</p>
        ) : instructors.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            No instructors yet. Add one above or have them register at <code>/setup</code>.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {instructors.map((inst) => (
              <QRCard key={inst.id} instructor={inst} />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default InstructorQRHub;
