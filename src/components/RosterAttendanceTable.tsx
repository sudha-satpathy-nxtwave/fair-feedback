import { useEffect, useState, useMemo } from "react";
import { CheckCircle2, XCircle, Loader2, Clipboard, ClipboardCheck } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString } from "@/lib/dateUtils";
import { toast } from "sonner";

interface Student {
  student_id: string;
  name: string;
  section: string;
  instructor_id: string;
  gender?: string;
  commute_type?: string;
  original_index?: number;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: string;
  instructor_id: string;
  subject_id?: string;
}

interface Subject {
  id: string;
  subject_name: string;
}

interface Props {
  /** Optional — when set, only sections belonging to this instructor are shown. */
  instructorId?: string;
  /** Optional — when set, the section filter is controlled by the parent and the internal selector is hidden. */
  sectionFilter?: string;
  /** Optional — YYYY-MM-DD; when set, the table shows attendance for that date instead of today. */
  dateFilter?: string;
  /** Optional — when set, the subject filter is controlled by the parent. */
  subjectFilter?: string;
}

const RosterAttendanceTable = ({ instructorId, sectionFilter, dateFilter, subjectFilter }: Props) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Map<string, AttendanceRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [internalSection, setInternalSection] = useState<string>("all");
  const [internalSubject, setInternalSubject] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "present" | "absent">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const today = dateFilter || getLocalDateString();
  const isToday = today === getLocalDateString();
  // When parent controls the section/subject, use that; otherwise fall back to internal selector.
  const isControlled = sectionFilter !== undefined;
  const section = isControlled ? (sectionFilter || "all") : internalSection;
  const subject = subjectFilter !== undefined ? (subjectFilter || "all") : internalSubject;

  const refresh = async () => {
    setLoading(true);
    // Students table is a SHARED master roster (admin uploads CSV once).
    // We never filter students by instructor_id — every instructor sees all sections.
    // Attendance records stay scoped per instructor and subject so marks don't collide.
    const [stuRes, subRes, attRes] = await Promise.all([
      supabase.from("students_master").select("*").order("original_index", { ascending: true }),
      supabase.from("subjects").select("id, subject_name").order("subject_name"),
      (() => {
        let query = instructorId
          ? supabase.from("daily_attendance").select("*").eq("date", today).eq("instructor_id", instructorId)
          : supabase.from("daily_attendance").select("*").eq("date", today);
        if (subject !== "all") {
          query = query.eq("subject_id", subject);
        }
        return query;
      })(),
    ]);

    if (stuRes.data) setStudents(stuRes.data as Student[]);
    if (subRes.data) setSubjects(subRes.data as Subject[]);
    if (attRes.data) {
      const map = new Map<string, AttendanceRecord>();
      for (const r of attRes.data as AttendanceRecord[]) {
        // Use student_id + subject_id as key for subject-specific attendance
        // For "all" subjects, we'll check if student has any attendance
        const key = r.subject_id ? `${r.student_id}_${r.subject_id}` : r.student_id;
        map.set(key, r);
      }
      setTodayAttendance(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instructorId, today, subject]);

  const sections = useMemo(
    () => [...new Set(students.map((s) => s.section).filter(Boolean))],
    [students]
  );

  // Default internal selector to first section once students load (only when uncontrolled)
  useEffect(() => {
    if (!isControlled && internalSection === "all" && sections.length > 0) {
      setInternalSection(sections[0]);
    }
  }, [sections, internalSection, isControlled]);

  const visible = useMemo(
    () => (section === "all" ? students : students.filter((s) => s.section === section)),
    [students, section]
  );

  const getAttendanceRecord = (student: Student) => {
    if (subject === "all") {
      for (const [key, record] of todayAttendance) {
        if (key.startsWith(student.student_id)) {
          return record;
        }
      }
      return undefined;
    }
    return todayAttendance.get(`${student.student_id}_${subject}`);
  };

  const filteredVisible = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return visible.filter((student) => {
      const att = getAttendanceRecord(student);
      const isPresent = att?.status === "Present";
      if (statusFilter === "present" && !isPresent) return false;
      if (statusFilter === "absent" && isPresent) return false;
      if (!query) return true;
      return `${student.student_id} ${student.name}`.toLowerCase().includes(query);
    });
  }, [visible, searchQuery, statusFilter, todayAttendance, subject]);

  const toggleStatus = async (student: Student) => {
    if (subject === "all") {
      toast.error("Please select a specific subject to mark attendance");
      return;
    }
    const subjectObj = subjects.find(s => s.id === subject);
    if (!subjectObj) return;

    setBusyId(student.student_id);
    const key = `${student.student_id}_${subject}`;
    const existing = todayAttendance.get(key);
    const targetInstructor = instructorId || student.instructor_id || "";

    if (!existing) {
      const { data, error } = await supabase
        .from("daily_attendance")
        .insert({
          student_id: student.student_id,
          date: today,
          status: "Present",
          instructor_id: targetInstructor,
          subject_id: subject,
        })
        .select()
        .single();
      if (error) toast.error("Failed to update");
      else if (data) {
        const next = new Map(todayAttendance);
        next.set(key, data as AttendanceRecord);
        setTodayAttendance(next);
        toast.success(`${student.student_id} marked Present for ${subjectObj.subject_name}`);

      }
    } else if (existing.status === "Present") {
      const { error } = await supabase.from("daily_attendance").delete().eq("id", existing.id);
      if (error) toast.error("Failed to update");
      else {
        const next = new Map(todayAttendance);
        next.delete(key);
        setTodayAttendance(next);
        toast.success(`${student.student_id} marked Absent for ${subjectObj.subject_name}`);

      }
    }
    setBusyId(null);
  };

  const copyStatusColumn = async () => {
    const lines = filteredVisible.map((s) => {
      const att = getAttendanceRecord(s);
      return att?.status === "Present" ? "Present" : "Absent";
    });
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      toast.success(`Copied ${lines.length} status values — paste into Excel`);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Clipboard blocked by browser");
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground text-center py-12">Loading roster...</p>;
  if (!students.length) {
    return (
      <div className="text-center py-12 space-y-1.5">
        <p className="text-sm text-muted-foreground">No students in roster yet.</p>
        <p className="text-xs text-muted-foreground">Ask an admin to bulk upload your roster.</p>
      </div>
    );
  }

  const presentCount = filteredVisible.filter((s) => {
    const att = getAttendanceRecord(s);
    return att?.status === "Present";
  }).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student ID or name..."
            className="h-10 text-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 w-[170px] text-xs">
              <SelectValue placeholder="Attendance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All students</SelectItem>
              <SelectItem value="present">Present only</SelectItem>
              <SelectItem value="absent">Absent only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {!isControlled && sections.length > 0 && (
            <Select value={section} onValueChange={setInternalSection}>
              <SelectTrigger className="h-10 w-[160px] text-xs">
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sections</SelectItem>
                {sections.map((s) => (
                  <SelectItem key={s} value={s}>Section {s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {subjects.length > 0 && subjectFilter === undefined && (
            <Select value={subject} onValueChange={setInternalSubject}>
              <SelectTrigger className="h-10 w-[180px] text-xs">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.subject_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" onClick={copyStatusColumn} className="h-10 gap-1.5 text-xs">
            {copied ? <ClipboardCheck className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy Status Column"}
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card/60 backdrop-blur-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>NIAT ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVisible.map((s) => {
              const att = getAttendanceRecord(s);
              const isPresent = att?.status === "Present";
              const subjectName = subject === "all"
                ? att?.subject_id ? subjects.find(sub => sub.id === att.subject_id)?.subject_name || "—" : "—"
                : subjects.find(sub => sub.id === subject)?.subject_name || "—";
              return (
                <TableRow key={s.student_id}>
                  <TableCell className="font-medium font-mono text-xs">{s.student_id}</TableCell>
                  <TableCell className="text-sm">{s.name || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.section || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{subjectName}</TableCell>
                  <TableCell className="text-center">
                    {isPresent ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Present
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                        <XCircle className="w-3 h-3" /> Absent
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === s.student_id || !isToday || subject === "all"}
                      onClick={() => toggleStatus(s)}
                      className="h-7 text-xs"
                      title={subject === "all" ? "Select a subject to mark attendance" : !isToday ? "Past dates are read-only" : ""}
                    >
                      {busyId === s.student_id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : !isToday ? (
                        "—"
                      ) : isPresent ? (
                        "Mark Absent"
                      ) : (
                        "Mark Present"
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default RosterAttendanceTable;
