import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { BookOpen, Download, Flame, Users, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAllFeedback, getStudentStreaks, exportToExcel } from "@/lib/feedbackStore";

const Dashboard = () => {
  const [instructorFilter, setInstructorFilter] = useState("");

  const allFeedback = useMemo(() => getAllFeedback(), []);

  const instructors = useMemo(() => {
    const set = new Set(
      allFeedback.map((f) => f.session_id.split("_")[0])
    );
    return [...set];
  }, [allFeedback]);

  const activeInstructor = instructorFilter || instructors[0] || "";

  const filteredFeedback = useMemo(
    () =>
      allFeedback.filter((f) =>
        activeInstructor ? f.session_id.startsWith(activeInstructor) : true
      ),
    [allFeedback, activeInstructor]
  );

  const streaks = useMemo(
    () => (activeInstructor ? getStudentStreaks(activeInstructor) : []),
    [activeInstructor]
  );

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-5xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Instructor Dashboard</h1>
              <p className="text-xs text-muted-foreground">View feedback responses & attendance</p>
            </div>
          </div>
          <Button
            onClick={() => exportToExcel(activeInstructor)}
            disabled={!filteredFeedback.length}
            size="sm"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export Excel
          </Button>
        </div>

        {/* Instructor filter */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">Filter by Instructor</label>
          <Input
            placeholder="e.g. john-smith"
            value={instructorFilter}
            onChange={(e) => setInstructorFilter(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
            className="bg-secondary/50 border-border/60 max-w-xs"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: MessageSquare, label: "Responses", value: filteredFeedback.length },
            { icon: Users, label: "Students", value: streaks.length },
            {
              icon: Flame,
              label: "Best Streak",
              value: streaks.length ? streaks[0].currentStreak : 0,
            },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="bg-card border border-border rounded-xl p-4 text-center space-y-1"
            >
              <Icon className="w-5 h-5 text-primary mx-auto" />
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="responses" className="space-y-4">
          <TabsList>
            <TabsTrigger value="responses">Responses</TabsTrigger>
            <TabsTrigger value="streaks">Attendance Streaks</TabsTrigger>
          </TabsList>

          <TabsContent value="responses">
            {filteredFeedback.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                No feedback yet. Share the QR code with students to start collecting responses.
              </p>
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
                      <TableHead className="text-center">Attendance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFeedback.map((fb) => (
                      <TableRow key={fb.id}>
                        <TableCell className="font-medium">{fb.student_id}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(fb.timestamp).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-center">{fb.understanding_rating}⭐</TableCell>
                        <TableCell className="text-center">{fb.instructor_rating}⭐</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs">
                          {fb.description}
                        </TableCell>
                        <TableCell className="text-center">
                          {fb.attendance_marked ? (
                            <span className="text-xs font-medium text-green-500">✓</span>
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
              <p className="text-sm text-muted-foreground text-center py-12">
                No attendance data yet.
              </p>
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
                        <TableCell className="font-medium">{s.student_id}</TableCell>
                        <TableCell className="text-center">{s.totalSessions}</TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1">
                            {s.currentStreak}
                            {s.currentStreak >= 3 && <Flame className="w-4 h-4 text-orange-500" />}
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
        </Tabs>
      </motion.div>
    </div>
  );
};

export default Dashboard;
