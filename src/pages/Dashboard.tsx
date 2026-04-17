import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { BookOpen, Download, Flame, Users, MessageSquare, KeyRound, CheckCircle2, QrCode, ListChecks } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import SessionCodeAdmin from "@/components/SessionCodeAdmin";
import RosterAttendanceTable from "@/components/RosterAttendanceTable";
import RollingNumber from "@/components/RollingNumber";
import TopFeedbackCarousel from "@/components/TopFeedbackCarousel";
import FeedbackTrendChart from "@/components/FeedbackTrendChart";
import BulkStudentUpload from "@/components/BulkStudentUpload";

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
    "Student ID": f.student_id,
    "Session ID": f.session_id,
    "Understanding": f.understanding_rating,
    "Instructor": f.instructor_rating,
    "AI Score": f.ai_score ?? "",
    Description: f.description,
    "Attendance": f.attendance_marked ? "Yes" : "No",
  }));
  const streakRows = computeStreaks(feedbacks, instructor).map((s) => ({
    "Student ID": s.student_id,
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
  const [instructorFilter, setInstructorFilter] = useState("");
  const [allFeedback, setAllFeedback] = useState<FeedbackRow[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from("attendance_feedback")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) setAllFeedback(data as FeedbackRow[]);
      setDbLoading(false);
    };
    fetchData();
  }, []);

  const instructors = useMemo(() => {
    const set = new Set(allFeedback.map((f) => f.session_id.split("_")[0]));
    return [...set];
  }, [allFeedback]);

  const activeInstructor = instructorFilter || instructors[0] || "";

  const filteredFeedback = useMemo(
    () => allFeedback.filter((f) => (activeInstructor ? f.session_id.startsWith(activeInstructor) : true)),
    [allFeedback, activeInstructor]
  );

  const topFeedbacks = useMemo(
    () => filteredFeedback.filter((f) => (f.ai_score ?? 0) >= 95).slice(0, 10),
    [filteredFeedback]
  );

  const streaks = useMemo(
    () => (activeInstructor ? computeStreaks(allFeedback, activeInstructor) : []),
    [allFeedback, activeInstructor]
  );

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-5xl mx-auto space-y-6"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Instructor Dashboard</h1>
              <p className="text-xs text-muted-foreground">Feedback, attendance & live analytics</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/qr-hub">
              <Button variant="outline" size="sm">
                <QrCode className="w-4 h-4 mr-1.5" />
                QR Hub
              </Button>
            </Link>
            <Button onClick={() => exportInstructorToExcel(allFeedback, activeInstructor)} disabled={!filteredFeedback.length} size="sm">
              <Download className="w-4 h-4 mr-1.5" />
              Export Excel
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">Filter by Instructor</label>
          <Input
            placeholder="e.g. john-smith"
            value={instructorFilter}
            onChange={(e) => setInstructorFilter(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
            className="bg-secondary/50 border-border/60 max-w-xs"
          />
          {instructors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {instructors.map((inst) => (
                <button
                  key={inst}
                  onClick={() => setInstructorFilter(inst)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    activeInstructor === inst
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/50 text-muted-foreground border-border/60 hover:bg-secondary"
                  }`}
                >
                  {inst}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stat cards with rolling animations */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: MessageSquare, label: "Responses", value: filteredFeedback.length },
            { icon: Users, label: "Students", value: streaks.length },
            { icon: Flame, label: "Best Streak", value: streaks.length ? streaks[0].currentStreak : 0 },
          ].map(({ icon: Icon, label, value }, idx) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.08, type: "spring", stiffness: 220, damping: 22 }}
              whileHover={{ y: -3 }}
              className="bg-gradient-to-br from-card to-secondary/30 border border-border rounded-xl p-4 text-center space-y-1"
            >
              <Icon className="w-5 h-5 text-primary mx-auto" />
              <p className="text-3xl font-bold text-foreground tabular-nums">
                <RollingNumber value={value} />
              </p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </motion.div>
          ))}
        </div>

        {/* Trend chart + Top feedbacks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FeedbackTrendChart feedback={filteredFeedback} />
          <div className="rounded-xl border border-border bg-card p-5">
            <TopFeedbackCarousel items={topFeedbacks} />
          </div>
        </div>

        <Tabs defaultValue="responses" className="space-y-4">
          <TabsList>
            <TabsTrigger value="responses">Responses</TabsTrigger>
            <TabsTrigger value="attendance">
              <ListChecks className="w-3.5 h-3.5 mr-1" />
              Live Attendance
            </TabsTrigger>
            <TabsTrigger value="streaks">Streaks</TabsTrigger>
            <TabsTrigger value="admin">
              <KeyRound className="w-3.5 h-3.5 mr-1" />
              Admin
            </TabsTrigger>
          </TabsList>

          <TabsContent value="responses">
            {dbLoading ? (
              <p className="text-sm text-muted-foreground text-center py-12">Loading...</p>
            ) : filteredFeedback.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No feedback yet.</p>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student ID</TableHead>
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

          <TabsContent value="attendance">
            <RosterAttendanceTable instructorId={activeInstructor} />
          </TabsContent>

          <TabsContent value="streaks">
            {streaks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No attendance data yet.</p>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student ID</TableHead>
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
            <div className="border-t border-border pt-6">
              <h3 className="text-sm font-bold text-foreground mb-3">Data Management</h3>
              <BulkStudentUpload defaultInstructorId={activeInstructor} />
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default Dashboard;
