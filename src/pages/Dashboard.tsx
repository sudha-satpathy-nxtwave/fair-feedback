import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen, Download, Flame, Users, MessageSquare, KeyRound,
  CheckCircle2, QrCode, ListChecks, LogOut, Shield, Percent, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLocalAuth } from "@/contexts/LocalAuthContext";
import SessionCodeAdmin from "@/components/SessionCodeAdmin";
import RosterAttendanceTable from "@/components/RosterAttendanceTable";
import RollingNumber from "@/components/RollingNumber";
import CategoryTicker from "@/components/CategoryTicker";
import FeedbackTrendChart from "@/components/FeedbackTrendChart";
import BulkStudentUpload from "@/components/BulkStudentUpload";
import CoAdminPinAdmin from "@/components/CoAdminPinAdmin";
import { getLocalDateString } from "@/lib/dateUtils";

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
}

interface StreakInfo {
  student_id: string;
  totalSessions: number;
  currentStreak: number;
  dates: string[];
}

function computeStreaks(feedbacks: FeedbackRow[], instructor: string): StreakInfo[] {
  const filtered = feedbacks.filter((f) => f.session_id.startsWith(instructor.toLowerCase()));
  const studentMap = new Map<string, Set<string>>();
  for (const fb of filtered) {
    if (!fb.attendance_marked) continue;
    const dateStr = fb.session_id.split("_").slice(1).join("_");
    if (!studentMap.has(fb.student_id)) studentMap.set(fb.student_id, new Set());
    studentMap.get(fb.student_id)!.add(dateStr);
  }
  const allDates = [...new Set(filtered.map((f) => f.session_id.split("_").slice(1).join("_")))].sort();
  const streaks: StreakInfo[] = [];
  for (const [studentId, dates] of studentMap) {
    let currentStreak = 0;
    for (let i = allDates.length - 1; i >= 0; i--) {
      if (dates.has(allDates[i])) currentStreak++;
      else break;
    }
    streaks.push({ student_id: studentId, totalSessions: dates.size, currentStreak, dates: [...dates].sort() });
  }
  return streaks.sort((a, b) => b.currentStreak - a.currentStreak);
}

async function exportInstructorToExcel(feedbacks: FeedbackRow[], instructor: string) {
  const XLSX = await import("xlsx");
  const filtered = feedbacks.filter((f) => f.session_id.startsWith(instructor.toLowerCase()));
  const feedbackRows = filtered.map((f) => ({
    Timestamp: f.created_at,
    "NIAT ID": f.student_id,
    "Session ID": f.session_id,
    Understanding: f.understanding_rating,
    Instructor: f.instructor_rating,
    "AI Score": f.ai_score ?? "",
    Description: f.description,
    Attendance: f.attendance_marked ? "Yes" : "No",
  }));
  const streakRows = computeStreaks(feedbacks, instructor).map((s) => ({
    "NIAT ID": s.student_id,
    "Total Sessions": s.totalSessions,
    "Current Streak": s.currentStreak,
    "Dates Attended": s.dates.join(", "),
  }));
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(feedbackRows);
  const ws2 = XLSX.utils.json_to_sheet(streakRows);
  XLSX.utils.book_append_sheet(wb, ws1, "Feedback");
  XLSX.utils.book_append_sheet(wb, ws2, "Streaks");
  XLSX.writeFile(wb, `${instructor}_feedback_report.xlsx`);
}

const Dashboard = () => {
  const { session, signOut, loading: authLoading } = useLocalAuth();
  const navigate = useNavigate();

  // Hooks must run in the same order on every render — call them all before any early return.
  const isAdmin = session?.role === "admin" || session?.role === "co-admin";
  const isMasterAdmin = session?.role === "admin";
  const lockedInstructor = session?.role === "instructor" ? session.username ?? "" : null;
  const today = getLocalDateString();

  const [allInstructors, setAllInstructors] = useState<InstructorProfile[]>([]);
  const [instructorFilter, setInstructorFilter] = useState(lockedInstructor ?? "");
  const [allFeedback, setAllFeedback] = useState<FeedbackRow[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [todayPresentCount, setTodayPresentCount] = useState(0);
  const [rosterCount, setRosterCount] = useState(0);

  // Load registered instructor profiles (for admin filter dropdown)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("instructor_profiles")
        .select("username, display_name")
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

  const activeInstructor = lockedInstructor || instructorFilter || knownInstructorIds[0] || "";

  const activeProfile = useMemo(
    () => allInstructors.find((i) => i.username === activeInstructor),
    [allInstructors, activeInstructor]
  );

  const displayName = activeProfile?.display_name || session?.displayName || activeInstructor || "Admin";

  // Today's attendance + roster counts
  useEffect(() => {
    if (!activeInstructor) {
      setTodayPresentCount(0);
      setRosterCount(0);
      return;
    }
    (async () => {
      const [att, roster] = await Promise.all([
        supabase.from("daily_attendance").select("id", { count: "exact", head: true })
          .eq("instructor_id", activeInstructor).eq("date", today).eq("status", "Present"),
        supabase.from("students_master").select("id", { count: "exact", head: true })
          .eq("instructor_id", activeInstructor),
      ]);
      setTodayPresentCount(att.count ?? 0);
      setRosterCount(roster.count ?? 0);
    })();
  }, [activeInstructor, today]);

  const filteredFeedback = useMemo(
    () => allFeedback.filter((f) => (activeInstructor ? f.session_id.startsWith(activeInstructor) : true)),
    [allFeedback, activeInstructor]
  );

  // Split tickers by AI score band as a proxy for category
  // (category is also stored in localStorage on the student device, but the dashboard
  // can't see that — so we infer: high-score + low-rating-text → improvement)
  const appreciationFeedback = useMemo(
    () =>
      filteredFeedback
        .filter((f) => (f.ai_score ?? 0) >= 80 && f.understanding_rating + f.instructor_rating >= 8)
        .slice(0, 12),
    [filteredFeedback]
  );

  const improvementFeedback = useMemo(
    () =>
      filteredFeedback
        .filter((f) => (f.ai_score ?? 0) >= 75 && f.understanding_rating + f.instructor_rating < 8)
        .slice(0, 12),
    [filteredFeedback]
  );

  const streaks = useMemo(
    () => (activeInstructor ? computeStreaks(allFeedback, activeInstructor) : []),
    [allFeedback, activeInstructor]
  );

  const attendancePct = rosterCount > 0
    ? Math.round((todayPresentCount / rosterCount) * 100)
    : 0;

  // Now safe to early-return — all hooks have been called above.
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-6xl mx-auto space-y-6"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Hi {displayName}!
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                {isAdmin && <Shield className="w-3 h-3 text-primary" />}
                <span className="capitalize">{session.role}</span>
                {lockedInstructor && ` · ${lockedInstructor}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isAdmin && (
              <Link to="/instructor-qr">
                <Button variant="outline" size="sm">
                  <QrCode className="w-4 h-4 mr-1.5" />
                  QR Hub
                </Button>
              </Link>
            )}
            <Button onClick={() => exportInstructorToExcel(allFeedback, activeInstructor)} disabled={!filteredFeedback.length} size="sm">
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
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs font-semibold text-foreground">Viewing instructor:</label>
            <Select value={activeInstructor} onValueChange={setInstructorFilter}>
              <SelectTrigger className="h-8 w-[220px] text-xs">
                <SelectValue placeholder="Choose instructor" />
              </SelectTrigger>
              <SelectContent>
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

        {/* Glassmorphism stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: MessageSquare, label: "Total Responses", value: filteredFeedback.length, suffix: "" },
            { icon: Users, label: "Students", value: streaks.length, suffix: "" },
            { icon: Percent, label: "Attendance %", value: attendancePct, suffix: "%" },
            { icon: Flame, label: "Best Streak", value: streaks.length ? streaks[0].currentStreak : 0, suffix: "" },
          ].map(({ icon: Icon, label, value, suffix }, idx) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.07, type: "spring", stiffness: 220, damping: 22 }}
              whileHover={{ y: -3 }}
              className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-4 text-center space-y-1 shadow-[0_8px_32px_-12px_hsl(var(--primary)/0.18)]"
            >
              <Icon className="w-5 h-5 text-primary mx-auto" />
              <p className="text-3xl font-bold text-foreground tabular-nums">
                <RollingNumber value={value} />
                {suffix && <span className="text-2xl">{suffix}</span>}
              </p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </motion.div>
          ))}
        </div>

        {/* Trend chart + dual tickers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FeedbackTrendChart feedback={filteredFeedback} />
          <div className="grid grid-rows-2 gap-3">
            <CategoryTicker items={appreciationFeedback} variant="appreciation" />
            <CategoryTicker items={improvementFeedback} variant="improvement" />
          </div>
        </div>

        <Tabs defaultValue="attendance" className="space-y-4">
          <TabsList>
            <TabsTrigger value="attendance">
              <ListChecks className="w-3.5 h-3.5 mr-1" />
              Live Attendance
            </TabsTrigger>
            <TabsTrigger value="responses">Responses</TabsTrigger>
            <TabsTrigger value="streaks">Streaks</TabsTrigger>
            <TabsTrigger value="admin">
              <KeyRound className="w-3.5 h-3.5 mr-1" />
              Admin
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="data">
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                Data Mgmt
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="attendance">
            <RosterAttendanceTable instructorId={activeInstructor} />
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
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Understanding</TableHead>
                      <TableHead className="text-center">Instructor</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">AI Score</TableHead>
                      <TableHead className="text-center">Attendance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFeedback.map((fb) => (
                      <TableRow key={fb.id}>
                        <TableCell className="font-medium font-mono text-xs">{fb.student_id}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(fb.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-center">{fb.understanding_rating}⭐</TableCell>
                        <TableCell className="text-center">{fb.instructor_rating}⭐</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs">{fb.description}</TableCell>
                        <TableCell className="text-center">
                          <span className={`text-xs font-medium ${(fb.ai_score ?? 0) >= 75 ? "text-success" : "text-warning"}`}>
                            {fb.ai_score ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {fb.attendance_marked ? (
                            <CheckCircle2 className="w-4 h-4 text-success mx-auto" />
                          ) : (
                            <span className="text-xs text-destructive">✗</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="streaks">
            {streaks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No attendance data yet.</p>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden bg-card/60 backdrop-blur-xl">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NIAT ID</TableHead>
                      <TableHead className="text-center">Total Sessions</TableHead>
                      <TableHead className="text-center">Current Streak 🔥</TableHead>
                      <TableHead>Dates Attended</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {streaks.map((s) => (
                      <TableRow key={s.student_id}>
                        <TableCell className="font-medium font-mono text-xs">{s.student_id}</TableCell>
                        <TableCell className="text-center">{s.totalSessions}</TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1">
                            {s.currentStreak}
                            {s.currentStreak >= 3 && <Flame className="w-4 h-4 text-warning" />}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">
                          {s.dates.join(", ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="admin" className="space-y-8">
            <SessionCodeAdmin instructorId={activeInstructor} />
            {isMasterAdmin && (
              <div className="border-t border-border pt-6">
                <CoAdminPinAdmin />
              </div>
            )}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="data" className="space-y-6">
              <BulkStudentUpload defaultInstructorId={activeInstructor} />
            </TabsContent>
          )}
        </Tabs>
      </motion.div>
    </div>
  );
};

export default Dashboard;
