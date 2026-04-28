import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, Navigate } from "react-router-dom";
import {
  BookOpen, Download, Users, MessageSquare, CheckCircle2, QrCode, ListChecks,
  LogOut, Shield, Percent, FileSpreadsheet, Loader2, Image as ImageIcon, X, RefreshCw,
} from "lucide-react";
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
import CategoryList from "@/components/CategoryList";
import BulkStudentUpload from "@/components/BulkStudentUpload";
import InstructorAdminList from "@/components/InstructorAdminList";
import { Input } from "@/components/ui/input";
import { getLocalDateString } from "@/lib/dateUtils";
import { getFeedbackCategory } from "@/lib/feedbackValidation";
import { toast } from "sonner";

interface FeedbackRow {
  id: string;
  student_id: string;
  session_id: string;
  understanding_rating: number;
  instructor_rating: number;
  description: string;
  ai_score: number | null;
  attendance_marked: boolean;
  created_at: string;
}

interface InstructorProfile {
  username: string;
  display_name: string;
  qr_image_url: string | null;
}

async function exportInstructorToExcel(feedbacks: FeedbackRow[], instructor: string) {
  const XLSX = await import("xlsx");
  const filtered = instructor
    ? feedbacks.filter((f) => f.session_id.startsWith(instructor.toLowerCase()))
    : feedbacks;
  const rows = filtered.map((f) => ({
      Timestamp: f.created_at,
      "Rate your understanding of today's session.": f.understanding_rating,
      "Rate your instructor of their teaching for today's session(pace of teaching, communication & clarity)": f.instructor_rating,
      "What do you need more to learn better in today's session?": f.description,
    }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Feedback");
  XLSX.writeFile(wb, `${instructor || "all"}_feedback_report.xlsx`);
}

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
  const [todayPresentCount, setTodayPresentCount] = useState(0);
  const [rosterCount, setRosterCount] = useState(0);
  const [qrOpen, setQrOpen] = useState(false);
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [qrUploadBusy, setQrUploadBusy] = useState(false);
  const [qrGenerateBusy, setQrGenerateBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  // Load feedback
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("attendance_feedback")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) setAllFeedback(data as FeedbackRow[]);
      setDbLoading(false);
    })();
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

  // Load available sections + section-aware roster/attendance counts.
  // students_master is the SHARED master roster (admin-uploaded CSV) — every
  // instructor sees all sections. Attendance records stay scoped per instructor.
  useEffect(() => {
    (async () => {
      const { data: rosterRows } = await supabase
        .from("students_master")
        .select("section, student_id, original_index")
        .order("original_index", { ascending: true });
      const rows = (rosterRows ?? []) as { section: string; student_id: string; original_index?: number }[];
      const sections = [...new Set(rows.map((r) => r.section).filter(Boolean))];
      setAvailableSections(sections);

      const sectionFilteredStudents = selectedSection === "all"
        ? rows
        : rows.filter(
            (r) => normalize(r.section) === normalize(selectedSection)
          );
      setRosterCount(sectionFilteredStudents.length);

      const attendanceQuery = !isGlobalView && activeInstructor
        ? supabase
            .from("daily_attendance")
            .select("student_id, status")
            .eq("date", selectedDate)
            .eq("instructor_id", activeInstructor)
        : supabase
            .from("daily_attendance")
            .select("student_id, status")
            .eq("date", selectedDate);

      const { data: attendanceRows } = await attendanceQuery;
      const count = (attendanceRows ?? []).filter((row: any) => {
        return row.status === "Present";
      }).length;
      setTodayPresentCount(count);
    })();
  }, [activeInstructor, today, isGlobalView, selectedSection, selectedDate]);

  const filteredFeedback = useMemo(
    () => isGlobalView
      ? allFeedback
      : allFeedback.filter((f) => activeInstructor ? f.session_id.startsWith(activeInstructor) : false),
    [allFeedback, activeInstructor, isGlobalView]
  );

  // Categorize using AI score + sentiment proxy. High score + healthy ratings = appreciation.
  const appreciationFeedback = useMemo(
    () =>
      filteredFeedback
        .filter((f) => getFeedbackCategory(f.description, f.understanding_rating, f.instructor_rating) === "appreciation")
        .slice(0, 50),
    [filteredFeedback]
  );

  const improvementFeedback = useMemo(
    () =>
      filteredFeedback
        .filter((f) => getFeedbackCategory(f.description, f.understanding_rating, f.instructor_rating) === "improvement")
        .slice(0, 50),
    [filteredFeedback]
  );

  const attendancePct = rosterCount > 0
    ? Math.round((todayPresentCount / rosterCount) * 100)
    : 0;

  // Distinct students who've ever submitted
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
              onClick={() => exportInstructorToExcel(allFeedback, activeInstructor)}
              disabled={!filteredFeedback.length}
              size="sm"
              variant="outline"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Export Excel
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

        {/* Section + Date filters — drive roster + stat cards */}
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: MessageSquare, label: "Total Responses", value: filteredFeedback.length, suffix: "" },
            { icon: Users, label: "Students", value: totalStudents, suffix: "" },
            { icon: Percent, label: selectedDate === today ? "Attendance Today" : `Attendance ${selectedDate}`, value: attendancePct, suffix: "%" },
            { icon: CheckCircle2, label: selectedDate === today ? "Present Today" : "Present", value: todayPresentCount, suffix: "" },
          ].map(({ icon: Icon, label, value, suffix }, idx) => (
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
            </motion.div>
          ))}
        </div>

        {/* Two simple list views (no charts) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CategoryList items={appreciationFeedback} variant="appreciation" />
          <CategoryList items={improvementFeedback} variant="improvement" />
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
              <RosterAttendanceTable instructorId={activeInstructor} sectionFilter={selectedSection} dateFilter={selectedDate} />
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
              <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-5">
                <InstructorAdminList />
              </div>
              <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-5">
                <BulkStudentUpload defaultInstructorId={activeInstructor} />
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
