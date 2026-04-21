import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Upload, Image as ImageIcon, Loader2, UserPlus, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useLocalAuth } from "@/contexts/LocalAuthContext";
import { toast } from "sonner";

const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const Setup = () => {
  const navigate = useNavigate();
  const { setSession, session } = useLocalAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"signin" | "register">("register");

  // Register form
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Sign-in form
  const [signinUsername, setSigninUsername] = useState("");
  const [signinBusy, setSigninBusy] = useState(false);

  useEffect(() => {
    if (session?.role === "instructor" && session.username) {
      navigate("/dashboard");
    }
  }, [session, navigate]);

  const handleFile = (f: File | null) => {
    setQrFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = (e) => setQrPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setQrPreview(null);
    }
  };

  const handleRegister = async () => {
    const slug = slugify(username);
    if (!slug) return toast.error("Enter a username");
    if (!displayName.trim()) return toast.error("Enter your display name");
    setBusy(true);

    // 1. Check if username taken
    const { data: existing } = await supabase
      .from("instructor_profiles")
      .select("username")
      .eq("username", slug)
      .maybeSingle();
    if (existing) {
      setBusy(false);
      return toast.error("Username already taken — try signing in instead");
    }

    // 2. Upload QR if provided
    let qrUrl: string | null = null;
    if (qrFile) {
      const ext = qrFile.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${slug}/qr.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("instructor-qrs")
        .upload(path, qrFile, { upsert: true, contentType: qrFile.type });
      if (upErr) {
        setBusy(false);
        return toast.error(`QR upload failed: ${upErr.message}`);
      }
      const { data: pub } = supabase.storage.from("instructor-qrs").getPublicUrl(path);
      qrUrl = pub.publicUrl;
    }

    // 3. Insert profile
    const { error } = await supabase.from("instructor_profiles").insert({
      username: slug,
      display_name: displayName.trim(),
      qr_image_url: qrUrl,
    });
    setBusy(false);
    if (error) return toast.error(`Setup failed: ${error.message}`);

    setSession({ role: "instructor", username: slug, displayName: displayName.trim() });
    toast.success(`Welcome, ${displayName}!`);
    navigate("/dashboard");
  };

  const handleSignIn = async () => {
    const slug = slugify(signinUsername);
    if (!slug) return toast.error("Enter your username");
    setSigninBusy(true);
    const { data, error } = await supabase
      .from("instructor_profiles")
      .select("username, display_name")
      .eq("username", slug)
      .maybeSingle();
    setSigninBusy(false);
    if (error || !data) return toast.error("Username not found");
    setSession({ role: "instructor", username: data.username, displayName: data.display_name });
    toast.success(`Welcome back, ${data.display_name}!`);
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-border/50 bg-card/70 backdrop-blur-xl p-6 sm:p-8 space-y-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Instructor Setup</h1>
            <p className="text-xs text-muted-foreground">Register or continue as an existing instructor</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="register" className="gap-1.5">
              <UserPlus className="w-3.5 h-3.5" />
              Register
            </TabsTrigger>
            <TabsTrigger value="signin" className="gap-1.5">
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Username (unique)</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. john-smith"
              />
              {username && (
                <p className="text-[11px] text-muted-foreground">→ Saved as: <span className="font-mono">{slugify(username)}</span></p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Display Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="John Smith"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                Session QR Image (optional)
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="w-full gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                {qrFile ? qrFile.name : "Choose QR image"}
              </Button>
              {qrPreview && (
                <div className="rounded-lg border border-border bg-white p-2 flex justify-center">
                  <img src={qrPreview} alt="QR preview" className="max-h-32" />
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">Upload a custom QR (e.g. branded). Otherwise an auto-generated one is shown in your dashboard.</p>
            </div>
            <Button onClick={handleRegister} disabled={busy} className="w-full gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {busy ? "Setting up..." : "Create Profile & Sign In"}
            </Button>
          </TabsContent>

          <TabsContent value="signin" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Your Username</label>
              <Input
                value={signinUsername}
                onChange={(e) => setSigninUsername(e.target.value)}
                placeholder="e.g. john-smith"
                onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
              />
            </div>
            <Button onClick={handleSignIn} disabled={signinBusy} className="w-full gap-2">
              {signinBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {signinBusy ? "Checking..." : "Continue"}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Forgot your username? Ask an admin to look it up in the dashboard.
            </p>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default Setup;
