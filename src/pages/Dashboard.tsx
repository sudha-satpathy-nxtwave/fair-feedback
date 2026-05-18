import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, Navigate } from "react-router-dom";
import {
  BookOpen, Download, Users, MessageSquare, QrCode, ListChecks,
  LogOut, Shield, FileSpreadsheet, Loader2, Image as ImageIcon, RefreshCw,
  BarChart2, CalendarCheck, ExternalLink, Copy, Check,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useLocalAuth } from "@/contexts/LocalAuthContext";
import RosterAttendanceTable from "@/components/RosterAttendanceTable";
import RollingNumber from "@/components/RollingNumber";

import BulkStudentUpload from "@/components/BulkStudentUpload";
import BulkSubjectUpload from "@/components/BulkSubjectUpload";
import InstructorAdminList from "@/components/InstructorAdminList";
import { Input } from "@/components/ui/input";
import { getLocalDateString } from "@/lib/dateUtils";
import { toast } from "sonner";

interface FeedbackRow {
  id: string;
  student_id: string;
  session_id: string;
  understanding_rating: number;
  instructor_rating: number;
  description: string;
  ai_score: number | null;
  category?: string;
  attendance_marked: boolean;
  created_at: string;
}

interface InstructorProfile {
  username: string;
  display_name: string;
  qr_image_url: string | null;
}

// ── Admin-level Google Sheet URL card ─────────────────────────────────────────
const AdminSheetUrlCard = () => {
  const [configId, setConfigId] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [viewUrl, setViewUrl] = useState("");
  const [draftWebhook, setDraftWebhook] = useState("");
  const [draftView, setDraftView] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("admin_config")
      .select("id, admin_sheet_webhook_url, admin_sheet_view_url")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setConfigId(data.id);
          const d = data as { admin_sheet_webhook_url?: string | null; admin_sheet_view_url?: string | null };
          setWebhookUrl(d.admin_sheet_webhook_url ?? "");
          setViewUrl(d.admin_sheet_view_url ?? "");
        }
      });
  }, []);

  const save = async () => {
    if (!configId) return;
    setSaving(true);
    const { error } = await supabase
      .from("admin_config")
      .update({
        admin_sheet_webhook_url: draftWebhook.trim() || null,
        admin_sheet_view_url: draftView.trim() || null,
      } as Record<string, unknown>)
      .eq("id", configId);
    setSaving(false);
    if (error) { toast.error("Failed to save admin sheet URLs"); return; }
    setWebhookUrl(draftWebhook.trim());
    setViewUrl(draftView.trim());
    setEditing(false);
    toast.success("Admin Google Sheet URLs saved.");
  };

  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          Admin Feedback Sheet
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          All feedback responses are sent here with full student details (NIAT ID, Name, Section).
        </p>
      </div>
      {editing ? (
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Webhook URL (Apps Script exec URL)</label>
            <Input className="h-8 text-xs" placeholder="https://script.google.com/macros/s/.../exec"
              value={draftWebhook} onChange={(e) => setDraftWebhook(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">View URL (your Google Sheet browser URL)</label>
            <Input className="h-8 text-xs" placeholder="https://docs.google.com/spreadsheets/d/.../edit"
              value={draftView} onChange={(e) => setDraftView(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-8" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {webhookUrl && viewUrl
            ? <span className="text-xs text-success font-medium">✓ Admin sheet fully configured</span>
            : webhookUrl || viewUrl
            ? <span className="text-xs text-warning font-medium">⚠ Both URLs are needed</span>
            : <span className="text-xs text-muted-foreground italic">No admin sheet configured</span>}
          <Button size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => { setDraftWebhook(webhookUrl); setDraftView(viewUrl); setEditing(true); }}>
            {webhookUrl || viewUrl ? "Edit URLs" : "Set URLs"}
          </Button>
        </div>
      )}
    </div>
  );
};

const Dashboard = () => {
  const { session, signOut, loading: authLoading } = useLocalAuth();
  const navigate = useNavigate();

  const isAdmin = session?.role === "admin" || session?.role === "co-admin";
  const lockedInstructor = session?.role === "instructor" ? session.username ?? "" : null;
  const today = getLocalDateString();

  const [allInstructors, setAllInstructors] = useState<InstructorProfile[]>([]);
  const [instructorFilter, setInstructorFilter] = useState(lockedInstructor ?? "");
  const [allFeedback, setAllFeedback] = useState<FeedbackRow[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [rosterCount, setRosterCount] = useState(0);
  const [rosterRows, setRosterRows] = useState<{ section: string; student_id: string; original_index?: number }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; subject_name: string }[]>([]);
  const [qrOpen, setQrOpen] = useState(false);
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [qrUploadBusy, setQrUploadBusy] = useState(false);
  const [qrGenerateBusy, setQrGenerateBusy] = useState(false);
  const [sheetViewUrl, setSheetViewUrl] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [copiedQrLink, setCopiedQrLink] = useState(false);
  // Analytics state
  const [subjectAttendanceData, setSubjectAttendanceData] = useState<{ name: string; count: number }[]>([]);
  const [subjectFeedbackData, setSubjectFeedbackData] = useState<{ name: string; count: number }[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [dateFeedbackCount, setDateFeedbackCount] = useState(0);
  // Increment to force analytics charts to re-fetch after bulk attendance changes
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0);
  const triggerAnalyticsRefresh = () => setAnalyticsRefreshKey((k) => k + 1);

  const normalize = (str: string = "") =>
    str.toLowerCase().replace("section", "").trim();

  // Load instructor profiles
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("instructor_profiles")
        .select("username, display_name, qr_image_url")
        .order("display_name");
      if (data) setAllInstructors(data as InstructorProfile[]);
    })();
  }, []);

  // Load the correct Google Sheet view URL for this user
  useEffect(() => {
    if (isAdmin) {
      // Admin: load from admin_config
      supabase
        .from("admin_config")
        .select("admin_sheet_view_url")
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          setSheetViewUrl((data as { admin_sheet_view_url?: string | null })?.admin_sheet_view_url ?? "");
        });
    } else if (lockedInstructor) {
      // Instructor: load from their own profile
      supabase
        .from("instructor_profiles")
        .select("google_sheet_view_url")
        .eq("username", lockedInstructor)
        .single()
        .then(({ data }) => {
          setSheetViewUrl((data as { google_sheet_view_url?: string | null })?.google_sheet_view_url ?? "");
        });
    }
  }, [isAdmin, lockedInstructor]);

  // Load subjects
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("subjects")
        .select("id, subject_name")
        .order("subject_name");
      if (data) setSubjects(data);
    })();
  }, []);

  // Load feedback + subscribe to real-time inserts so stats/graphs update instantly
  useEffect(() => {
    // Initial load
    (async () => {
      const { data, error } = await supabase
        .from("attendance_feedback")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) setAllFeedback(data as FeedbackRow[]);
      setDbLoading(false);
    })();

    // Real-time subscription — fires whenever a student submits feedback
    const channel = supabase
      .channel("dashboard-feedback-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "attendance_feedback" },
        (payload) => {
          // Prepend new row so the All Responses table updates immediately
          setAllFeedback((prev) => [payload.new as FeedbackRow, ...prev]);
          // Bump the refresh key so analytics stats + charts re-fetch from DB
          setAnalyticsRefreshKey((k) => k + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const knownInstructorIds = useMemo(() => {
    const set = new Set<string>(allInstructors.map((i) => i.username));
    allFeedback.forEach((f) => set.add(f.session_id.split("_")[0]));
    return [...set].filter(Boolean).sort();
  }, [allInstructors, allFeedback]);

  // Admin: "all" view shows global data; instructors are locked to their own.
  const activeInstructor = lockedInstructor || instructorFilter;
  const isGlobalView = isAdmin && !activeInstructor;

  const activeProfile = useMemo(
    () => allInstructors.find((i) => i.username === activeInstructor),
    [allInstructors, activeInstructor]
  );

  const displayName =
    activeProfile?.display_name ||
    session?.displayName ||
    (isAdmin ? `Admin ${session?.username ?? ""}`.trim() : activeInstructor) ||
    "Admin";

  // Reset section filter when instructor view changes
  useEffect(() => {
    setSelectedSection("all");
  }, [activeInstructor, isGlobalView]);

  // Unified data-loading effect — roster count + all analytics in one atomic pass.
  // Runs whenever any relevant filter (section, date, instructor) changes.
  useEffect(() => {
    (async () => {
      // ── 1. Fetch full roster ────────────────────────────────────────────────
      const { data: rosterData } = await supabase
        .from("students_master")
        .select("section, student_id, original_index")
        .order("original_index", { ascending: true });
      const rows = (rosterData ?? []) as { section: string; student_id: string; original_index?: number }[];
      setRosterRows(rows);
      const sections = [...new Set(rows.map((r) => r.section).filter(Boolean))];
      setAvailableSections(sections);

      // ── 2. Build section-filtered student id set ───────────────────────────
      const sectionRows = selectedSection === "all"
        ? rows
        : rows.filter((r) => normalize(r.section) === normalize(selectedSection));
      setRosterCount(sectionRows.length);

      const sectionStudentIds: Set<string> | null = selectedSection === "all"
        ? null
        : new Set(sectionRows.map((r) => r.student_id));

      // ── 3. Subject-wise attendance for selected date ────────────────────────
      const { data: attRows } = await supabase
        .from("daily_attendance")
        .select("student_id, subject_id, status")
        .eq("date", selectedDate)
        .eq("status", "Present");

      const attFiltered = (attRows ?? []).filter((r: any) =>
        sectionStudentIds ? sectionStudentIds.has(r.student_id) : true
      );

      const attBySubject = new Map<string, number>();
      for (const row of attFiltered as any[]) {
        if (!row.subject_id) continue;
        attBySubject.set(row.subject_id, (attBySubject.get(row.subject_id) ?? 0) + 1);
      }

      // Sessions conducted = distinct subjects with present students on this date
      setSessionCount(new Set<string>(attBySubject.keys()).size);

      // ── 4. Subject-wise feedback for selected date ──────────────────────────
      const dayStart = `${selectedDate}T00:00:00`;
      const dayEnd   = `${selectedDate}T23:59:59`;
      let fbQuery = supabase
        .from("attendance_feedback")
        .select("student_id, subject_id, session_id, created_at")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd);

      // Scope feedback to the active instructor (non-admin must only see their own)
      if (!isGlobalView && activeInstructor) {
        fbQuery = fbQuery.like("session_id", `${activeInstructor}_%`);
      }

      const { data: fbRows } = await fbQuery;

      const fbFiltered = (fbRows ?? []).filter((r: any) =>
        sectionStudentIds ? sectionStudentIds.has(r.student_id) : true
      );

      const fbBySubject = new Map<string, number>();
      for (const row of fbFiltered as any[]) {
        if (!row.subject_id) continue;
        fbBySubject.set(row.subject_id, (fbBySubject.get(row.subject_id) ?? 0) + 1);
      }

      setDateFeedbackCount(fbFiltered.length);

      // ── 5. Build chart data ────────────────────────────────────────────────
      const subjectMap = new Map(subjects.map((s) => [s.id, s.subject_name]));

      setSubjectAttendanceData(
        [...attBySubject.entries()]
          .map(([id, count]) => ({ name: subjectMap.get(id) ?? id, count }))
          .sort((a, b) => b.count - a.count)
      );
      setSubjectFeedbackData(
        [...fbBySubject.entries()]
          .map(([id, count]) => ({ name: subjectMap.get(id) ?? id, count }))
          .sort((a, b) => b.count - a.count)
      );
    })();
  }, [selectedDate, selectedSection, activeInstructor, isGlobalView, subjects, analyticsRefreshKey]);

  const filteredFeedback = useMemo(
    () => {
      let feedback = isGlobalView
        ? allFeedback
        : allFeedback.filter((f) => activeInstructor ? f.session_id.startsWith(activeInstructor) : false);
      
      // Filter by section if not "all"
      if (selectedSection !== "all") {
        const sectionStudentIds = new Set(
          rosterRows
            .filter((r) => normalize(r.section) === normalize(selectedSection))
            .map((r) => r.student_id)
        );
        feedback = feedback.filter((f) => sectionStudentIds.has(f.student_id));
      }

      return feedback;
    },
    [allFeedback, activeInstructor, isGlobalView, selectedSection, rosterRows]
  );

  const totalStudents = rosterCount;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!session) return <Navigate to="/" replace />;

  const handleSignOut = () => {
    signOut();
    navigate("/");
  };

  const downloadQr = async () => {
    if (!activeProfile?.qr_image_url) return toast.error("No QR available");
    const a = document.createElement("a");
    a.href = activeProfile.qr_image_url;
    a.download = `${activeProfile.username}_qr.png`;
    a.target = "_blank";
    a.click();
  };

  const generateQrAndSave = async () => {
    if (!activeProfile?.username) return toast.error("Instructor not found");
    if (qrGenerateBusy) return;
    
    setQrGenerateBusy(true);
    try {
      const QRCode = (await import("qrcode")).default;
      const url = `${window.location.origin}/feedback?instructor=${encodeURIComponent(activeProfile.display_name)}&ref=${activeProfile.username}`;
      
      // Generate QR as PNG
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      });
      
      // Convert to blob
      const response = await fetch(qrDataUrl);
      const blob = await response.blob();
      
      // Upload to Supabase storage
      const path = `${activeProfile.username}/generated_qr.png`;
      const { error: upErr } = await supabase.storage
        .from("instructor-qrs")
        .upload(path, blob, { upsert: true, contentType: "image/png" });
      
      if (upErr) {
        toast.error(`QR generation failed: ${upErr.message}`);
        setQrGenerateBusy(false);
        return;
      }
      
      // Get public URL
      const { data: pub } = supabase.storage.from("instructor-qrs").getPublicUrl(path);
      
      // Update profile with QR URL
      const { error: dbErr } = await supabase
        .from("instructor_profiles")
        .update({ qr_image_url: pub.publicUrl })
        .eq("username", activeProfile.username);
      
      if (dbErr) {
        toast.error(`Failed to save QR: ${dbErr.message}`);
        setQrGenerateBusy(false);
        return;
      }
      
      // Update local state
      setAllInstructors(prev =>
        prev.map(i =>
          i.username === activeProfile.username
            ? { ...i, qr_image_url: pub.publicUrl }
            : i
        )
      );
      
      toast.success("QR generated and saved!");
      setQrGenerateBusy(false);
    } catch (err) {
      toast.error(`Error generating QR: ${err instanceof Error ? err.message : "Unknown error"}`);
      setQrGenerateBusy(false);
    }
  };

  const handleUploadQr = async (file: File) => {
    if (!activeProfile?.username) return toast.error("Instructor not found");
    if (qrUploadBusy) return;
    
    setQrUploadBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${activeProfile.username}/uploaded_qr.${ext}`;
      
      const { error: upErr } = await supabase.storage
        .from("instructor-qrs")
        .upload(path, file, { upsert: true, contentType: file.type });
      
      if (upErr) {
        toast.error(`QR upload failed: ${upErr.message}`);
        setQrUploadBusy(false);
        return;
      }
      
      // Get public URL
      const { data: pub } = supabase.storage.from("instructor-qrs").getPublicUrl(path);
      
      // Update profile with QR URL
      const { error: dbErr } = await supabase
        .from("instructor_profiles")
        .update({ qr_image_url: pub.publicUrl })
        .eq("username", activeProfile.username);
      
      if (dbErr) {
        toast.error(`Failed to save QR: ${dbErr.message}`);
        setQrUploadBusy(false);
        return;
      }
      
      // Update local state
      setAllInstructors(prev =>
        prev.map(i =>
          i.username === activeProfile.username
            ? { ...i, qr_image_url: pub.publicUrl }
            : i
        )
      );
      
      toast.success("QR uploaded successfully!");
      setQrUploadBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      toast.error(`Error uploading QR: ${err instanceof Error ? err.message : "Unknown error"}`);
      setQrUploadBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-6xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Hi {displayName}!
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                {isAdmin && <Shield className="w-3 h-3 text-primary" />}
                <span className="capitalize">{session.role}</span>
                {lockedInstructor && ` · ${lockedInstructor}`}
                {isGlobalView && " · Global view (all instructors)"}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!isAdmin && (
              <Button variant="default" size="sm" onClick={() => setQrOpen(true)} className="gap-1.5">
                <QrCode className="w-4 h-4" />
                View My Session QR
              </Button>
            )}
            {isAdmin && (
              <Link to="/instructor-qr">
                <Button variant="outline" size="sm">
                  <QrCode className="w-4 h-4 mr-1.5" />
                  QR Hub
                </Button>
              </Link>
            )}
            <Button
              onClick={() => {
                if (sheetViewUrl) {
                  window.open(sheetViewUrl, "_blank");
                } else {
                  toast.info(isAdmin
                    ? "Set the Admin Sheet view URL in the Data tab first."
                    : "Ask your admin to set your Google Sheet view URL."
                  );
                }
              }}
              size="sm"
              variant="outline"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />
              Your feedback Responses
            </Button>
            <Button onClick={handleSignOut} variant="ghost" size="sm">
              <LogOut className="w-4 h-4 mr-1.5" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Admin: instructor switcher */}
        {isAdmin && knownInstructorIds.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap rounded-xl border border-border/40 bg-card/50 backdrop-blur-xl p-3">
            <label className="text-xs font-semibold text-foreground">View:</label>
            <Select value={activeInstructor || "__all__"} onValueChange={(v) => setInstructorFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="h-8 w-[260px] text-xs">
                <SelectValue placeholder="Choose instructor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">🌐 All instructors (global)</SelectItem>
                {knownInstructorIds.map((id) => {
                  const prof = allInstructors.find((p) => p.username === id);
                  return (
                    <SelectItem key={id} value={id}>
                      {prof?.display_name || id} <span className="text-muted-foreground ml-1">({id})</span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Section + Subject + Date filters — drive roster + stat cards */}
        {(activeInstructor || isGlobalView) && (
          <div className="flex items-center gap-3 flex-wrap rounded-xl border border-border/40 bg-card/50 backdrop-blur-xl p-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-foreground">Section:</label>
              <Select value={selectedSection} onValueChange={setSelectedSection}>
                <SelectTrigger className="h-8 w-[200px] text-xs">
                  <SelectValue placeholder="Choose section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sections</SelectItem>
                  {availableSections.map((s) => (
                    <SelectItem key={s} value={s}>Section {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-foreground">Date:</label>
              <Input
                type="date"
                value={selectedDate}
                max={today}
                onChange={(e) => setSelectedDate(e.target.value || today)}
                className="h-8 w-[160px] text-xs"
              />
              {selectedDate !== today && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDate(today)}
                  className="h-8 text-xs"
                >
                  Today
                </Button>
              )}
            </div>
            {availableSections.length === 0 && (
              <span className="text-xs text-muted-foreground">No sections in roster yet</span>
            )}
          </div>
        )}

        {/* Stat cards with rolling counters */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users, label: "Total Students", value: totalStudents, suffix: "", sub: selectedSection === "all" ? "All sections" : `Section ${selectedSection}` },
            { icon: MessageSquare, label: selectedDate === today ? "Responses Today" : `Responses on ${selectedDate}`, value: dateFeedbackCount, suffix: "", sub: "Feedback submissions" },
            { icon: CalendarCheck, label: selectedDate === today ? "Sessions Today" : `Sessions on ${selectedDate}`, value: sessionCount, suffix: "", sub: "Distinct subjects conducted" },
          ].map(({ icon: Icon, label, value, suffix, sub }, idx) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.07, type: "spring", stiffness: 220, damping: 22 }}
              whileHover={{ y: -3 }}
              className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-5 text-center space-y-1.5 shadow-[0_8px_32px_-12px_hsl(var(--primary)/0.18)]"
            >
              <Icon className="w-5 h-5 text-primary mx-auto" />
              <p className="text-3xl font-bold text-foreground tabular-nums">
                <RollingNumber value={value} />
                {suffix && <span className="text-2xl">{suffix}</span>}
              </p>
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
              {sub && <p className="text-[11px] text-muted-foreground/60">{sub}</p>}
            </motion.div>
          ))}
        </div>

        {/* Analytics charts — subject-wise attendance & feedback */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Subject-wise Attendance */}
          <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Subject-wise Attendance</h3>
              <span className="ml-auto text-[11px] text-muted-foreground">{selectedDate === today ? "Today" : selectedDate}</span>
            </div>
            {subjectAttendanceData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No attendance recorded for this date.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={subjectAttendanceData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <RechartsTooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ fontWeight: 600, color: "hsl(var(--foreground))" }}
                    formatter={(v: number) => [v, "Present"]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {subjectAttendanceData.map((_, i) => (
                      <Cell key={i} fill={`hsl(var(--primary) / ${0.55 + (i % 3) * 0.15})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Subject-wise Feedback Responses */}
          <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Subject-wise Feedback Responses</h3>
              <span className="ml-auto text-[11px] text-muted-foreground">{selectedDate === today ? "Today" : selectedDate}</span>
            </div>
            {subjectFeedbackData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No feedback responses for this date.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={subjectFeedbackData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <RechartsTooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ fontWeight: 600, color: "hsl(var(--foreground))" }}
                    formatter={(v: number) => [v, "Responses"]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {subjectFeedbackData.map((_, i) => (
                      <Cell key={i} fill={`hsl(142 71% 45% / ${0.55 + (i % 3) * 0.15})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <Tabs defaultValue="attendance" className="space-y-4">
          <TabsList>
            <TabsTrigger value="attendance">
              <ListChecks className="w-3.5 h-3.5 mr-1.5" />
              Attendance Roster
            </TabsTrigger>
            <TabsTrigger value="responses">All Responses</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="data">
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                Data Mgmt
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="attendance">
            {isGlobalView ? (
              <div className="text-center py-12 text-sm text-muted-foreground border border-border/40 rounded-xl bg-card/40">
                Pick a specific instructor to manage their attendance roster.
              </div>
            ) : (
              <RosterAttendanceTable
                instructorId={activeInstructor}
                dateFilter={selectedDate}
                onAttendanceChange={triggerAnalyticsRefresh}
              />
            )}
          </TabsContent>

          <TabsContent value="responses">
            {dbLoading ? (
              <p className="text-sm text-muted-foreground text-center py-12">Loading...</p>
            ) : filteredFeedback.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No feedback yet.</p>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden bg-card/60 backdrop-blur-xl">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NIAT ID</TableHead>
                      {isGlobalView && <TableHead>Instructor</TableHead>}
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Understanding</TableHead>
                      <TableHead className="text-center">Teaching</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">AI Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFeedback.map((fb) => (
                        <TableRow key={fb.id}>
                          <TableCell className="font-medium font-mono text-xs">{fb.student_id}</TableCell>
                          {isGlobalView && (
                            <TableCell className="text-xs text-muted-foreground">
                              {fb.session_id.split("_")[0]}
                            </TableCell>
                          )}
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(fb.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-center text-sm">{fb.understanding_rating}⭐</TableCell>
                          <TableCell className="text-center text-sm">{fb.instructor_rating}⭐</TableCell>
                          <TableCell className="max-w-[260px] truncate text-xs">{fb.description}</TableCell>
                          <TableCell className="text-center">
                            <span className={`text-xs font-semibold ${(fb.ai_score ?? 0) >= 75 ? "text-success" : "text-warning"}`}>
                              {fb.ai_score ?? "—"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="data" className="space-y-6">
              <AdminSheetUrlCard />
              <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-5">
                <InstructorAdminList />
              </div>
              <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-5">
                <BulkStudentUpload defaultInstructorId={activeInstructor} />
              </div>
              <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-5">
                <BulkSubjectUpload />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </motion.div>

      {/* QR modal for instructor */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-primary" />
              Your Session QR Code
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Feedback URL */}
            {activeProfile && (() => {
              const feedbackUrl = `${window.location.origin}/feedback?instructor=${encodeURIComponent(activeProfile.display_name)}&ref=${activeProfile.username}`;
              return (
                <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground">Feedback Link</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground font-mono break-all flex-1 leading-relaxed">{feedbackUrl}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs gap-1.5"
                      onClick={async () => {
                        await navigator.clipboard.writeText(feedbackUrl);
                        setCopiedQrLink(true);
                        setTimeout(() => setCopiedQrLink(false), 1800);
                      }}
                    >
                      {copiedQrLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedQrLink ? "Copied!" : "Copy Link"}
                    </Button>
                    <a href={feedbackUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Link
                      </Button>
                    </a>
                  </div>
                </div>
              );
            })()}

            {activeProfile?.qr_image_url ? (
              <>
                <div className="bg-white p-4 rounded-xl flex items-center justify-center">
                  <img src={activeProfile.qr_image_url} alt="Your session QR" className="max-h-80 object-contain" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={downloadQr} className="flex-1 gap-2" variant="default">
                    <Download className="w-4 h-4" /> Download
                  </Button>
                  <Button 
                    onClick={() => fileRef.current?.click()} 
                    className="flex-1 gap-2" 
                    variant="outline"
                    disabled={qrUploadBusy}
                  >
                    <ImageIcon className="w-4 h-4" /> 
                    {qrUploadBusy ? "Uploading..." : "Replace"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3 text-center py-4">
                <p className="text-sm text-muted-foreground">
                  No QR code yet. Choose an option below:
                </p>
              </div>
            )}
            
            <div className="border-t pt-4 space-y-2">
              <Button 
                onClick={generateQrAndSave} 
                className="w-full gap-2"
                disabled={qrGenerateBusy}
                variant={activeProfile?.qr_image_url ? "outline" : "default"}
              >
                {qrGenerateBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" /> Generate QR Code
                  </>
                )}
              </Button>
              <Button 
                onClick={() => fileRef.current?.click()} 
                className="w-full gap-2"
                variant={activeProfile?.qr_image_url ? "default" : "outline"}
                disabled={qrUploadBusy}
              >
                {qrUploadBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4" /> Upload QR Image
                  </>
                )}
              </Button>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleUploadQr(e.target.files[0]);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
