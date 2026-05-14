import { useEffect, useState, useMemo } from "react";
import { CheckCircle2, XCircle, Loader2, Clipboard, ClipboardCheck, UserCheck, UserX } from "lucide-react";
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
  /** Optional — called after any bulk attendance change so parent can refresh analytics. */
  onAttendanceChange?: () => void;
}

const RosterAttendanceTable = ({ instructorId, sectionFilter, dateFilter, subjectFilter, onAttendanceChange }: Props) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Map<string, AttendanceRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [internalSection, setInternalSection] = useState<string>("all");
  const [internalSubject, setInternalSubject] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "present" | "absent">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [markingPresent, setMarkingPresent] = useState(false);
  const [markingAbsent, setMarkingAbsent] = useState(false);
  const markingAll = markingPresent || markingAbsent;

  const today = dateFilter || getLocalDateString();
  const isToday = today === getLocalDateString();
  // When parent controls the section/subject, use that; otherwise fall back to internal selector.
  const isControlled = sectionFilter !== undefined;
  const section = isControlled ? (sectionFilter || "all") : internalSection;
  const subject = subjectFilter !== undefined
    ? subjectFilter === "all"
      ? ""
      : subjectFilter || ""
    : internalSubject;

  const refresh = async () => {
    setLoading(true);
    // Students table is a SHARED master roster (admin uploads CSV once).
    // We never filter students by instructor_id — every instructor sees all sections.
    // Attendance records stay scoped per instructor and subject so marks don't collide.
    const [stuRes, subRes, attRes] = await Promise.all([
      supabase.from("students_master").select("*").order("original_index", { ascending: true }),
      supabase.from("subjects").select("id, subject_name").order("subject_name"),
      (() => {
        if (!subject) {
          return null;
        }
        return supabase.from("daily_attendance").select("*").eq("date", today).eq("subject_id", subject);
      })(),
    ]);

    if (stuRes.data) setStudents(stuRes.data as Student[]);
    if (subRes.data) setSubjects(subRes.data as Subject[]);
    if (attRes && attRes.data) {
      const map = new Map<string, AttendanceRecord>();
      for (const r of attRes.data as AttendanceRecord[]) {
        const key = `${r.student_id}_${r.subject_id}`;
        map.set(key, r);
      }
      setTodayAttendance(map);
    } else {
      setTodayAttendance(new Map());
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
    if (!subject) return undefined;
    return todayAttendance.get(`${student.student_id}_${subject}`);
  };

  const filteredVisible = useMemo(() => {
    const queryStr = searchQuery.trim().toLowerCase();
    const queries = queryStr ? queryStr.split(',').map(q => q.trim()).filter(Boolean) : [];
    return visible.filter((student) => {
      const studentStr = `${student.student_id} ${student.name}`.toLowerCase();
      const matchesSearch = queries.length === 0 || queries.some(q => studentStr.includes(q));

      if (!subject) return matchesSearch;
      
      const att = getAttendanceRecord(student);
      const isPresent = att?.status === "Present";
      if (statusFilter === "present" && !isPresent) return false;
      if (statusFilter === "absent" && isPresent) return false;
      
      return matchesSearch;
    });
  }, [visible, searchQuery, statusFilter, todayAttendance, subject]);

  const toggleStatus = async (student: Student) => {
    if (!subject) {
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
          instructor_id: `${targetInstructor}_${subject}`,
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
        onAttendanceChange?.();
      }
    } else if (existing.status === "Present") {
      const { error } = await supabase.from("daily_attendance").delete().eq("id", existing.id);
      if (error) toast.error("Failed to update");
      else {
        const next = new Map(todayAttendance);
        next.delete(key);
        setTodayAttendance(next);
        toast.success(`${student.student_id} marked Absent for ${subjectObj.subject_name}`);
        onAttendanceChange?.();
      }
    }
    setBusyId(null);
  };

  const markAllPresent = async () => {
    if (!subject) {
      toast.error("Please select a specific subject to mark attendance");
      return;
    }
    if (!isToday) {
      toast.error("Past dates are read-only");
      return;
    }
    const subjectObj = subjects.find(s => s.id === subject);
    if (!subjectObj) return;

    setMarkingPresent(true);
    try {
      // Students to mark Present = currently filtered/visible students
      const presentStudentIds = new Set(filteredVisible.map(s => s.student_id));
      // All students in the section (unfiltered) = visible
      const allSectionStudentIds = visible.map(s => s.student_id);

      const targetInstructor = instructorId || "";

      // Upsert Present for all filtered students
      if (presentStudentIds.size > 0) {
        const upserts = [...presentStudentIds].map(sid => ({
          student_id: sid,
          date: today,
          status: "Present",
          instructor_id: `${targetInstructor}_${subject}`,
          subject_id: subject,
        }));
        const { error } = await supabase
          .from("daily_attendance")
          .upsert(upserts, { onConflict: "student_id, date, instructor_id" });
        if (error) { toast.error("Failed to mark all present"); setMarkingPresent(false); return; }
      }

      // Delete attendance for students NOT in filtered set (mark them Absent)
      const absentStudentIds = allSectionStudentIds.filter(sid => !presentStudentIds.has(sid));
      if (absentStudentIds.length > 0) {
        await supabase
          .from("daily_attendance")
          .delete()
          .in("student_id", absentStudentIds)
          .eq("date", today)
          .eq("subject_id", subject);
      }

      // Refresh attendance map from DB
      const { data: freshAtt } = await supabase
        .from("daily_attendance")
        .select("*")
        .eq("date", today)
        .eq("subject_id", subject);

      if (freshAtt) {
        const map = new Map<string, AttendanceRecord>();
        for (const r of freshAtt as AttendanceRecord[]) {
          map.set(`${r.student_id}_${r.subject_id}`, r);
        }
        setTodayAttendance(map);
      }

      toast.success(
        presentStudentIds.size === allSectionStudentIds.length
          ? `All ${presentStudentIds.size} students marked Present for ${subjectObj.subject_name}`
          : `${presentStudentIds.size} students marked Present, ${absentStudentIds.length} marked Absent for ${subjectObj.subject_name}`
      );
      onAttendanceChange?.();
    } catch (e) {
      toast.error("Something went wrong");
    } finally {
      setMarkingPresent(false);
    }
  };

  const markAllAbsent = async () => {
    if (!subject) {
      toast.error("Please select a specific subject to mark attendance");
      return;
    }
    if (!isToday) {
      toast.error("Past dates are read-only");
      return;
    }
    const subjectObj = subjects.find(s => s.id === subject);
    if (!subjectObj) return;

    setMarkingAbsent(true);
    try {
      // Students to mark Absent = currently filtered/visible students
      const absentStudentIds = filteredVisible.map(s => s.student_id);
      // All students in the section (unfiltered)
      const allSectionStudentIds = visible.map(s => s.student_id);

      // Delete attendance records for the filtered students (marking them Absent)
      if (absentStudentIds.length > 0) {
        const { error } = await supabase
          .from("daily_attendance")
          .delete()
          .in("student_id", absentStudentIds)
          .eq("date", today)
          .eq("subject_id", subject);
        if (error) { toast.error("Failed to mark absent"); setMarkingAbsent(false); return; }
      }

      // Refresh attendance map from DB
      const { data: freshAtt } = await supabase
        .from("daily_attendance")
        .select("*")
        .eq("date", today)
        .eq("subject_id", subject);

      if (freshAtt) {
        const map = new Map<string, AttendanceRecord>();
        for (const r of freshAtt as AttendanceRecord[]) {
          map.set(`${r.student_id}_${r.subject_id}`, r);
        }
        setTodayAttendance(map);
      }

      toast.success(
        absentStudentIds.length === allSectionStudentIds.length
          ? `All ${absentStudentIds.length} students marked Absent for ${subjectObj.subject_name}`
          : `${absentStudentIds.length} students marked Absent for ${subjectObj.subject_name}`
      );
      onAttendanceChange?.();
    } catch (e) {
      toast.error("Something went wrong");
    } finally {
      setMarkingAbsent(false);
    }
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
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-foreground whitespace-nowrap">Section:</span>
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
            </div>
          )}
          {subjects.length > 0 && subjectFilter === undefined && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-foreground whitespace-nowrap">Subject:</span>
              <Select value={subject} onValueChange={setInternalSubject}>
                <SelectTrigger className="h-10 w-[180px] text-xs">
                  <SelectValue placeholder="Select Subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.subject_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={copyStatusColumn}
            className="h-10 gap-1.5 text-xs"
            disabled={!subject}
          >
            {copied ? <ClipboardCheck className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy Attendance Cell"}
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={markAllPresent}
            className="h-10 gap-1.5 text-xs"
            disabled={!subject || !isToday || markingAll}
            title={!subject ? "Select a subject first" : !isToday ? "Past dates are read-only" : ""}
          >
            {markingPresent ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <UserCheck className="w-3.5 h-3.5" />
            )}
            {markingPresent ? "Marking..." : "Mark All Present"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={markAllAbsent}
            className="h-10 gap-1.5 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
            disabled={!subject || !isToday || markingAll}
            title={!subject ? "Select a subject first" : !isToday ? "Past dates are read-only" : ""}
          >
            {markingAbsent ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <UserX className="w-3.5 h-3.5" />
            )}
            {markingAbsent ? "Marking..." : "Mark All Absent"}
          </Button>
        </div>
      </div>

      {!subject && (
        <div className="rounded-xl border border-border bg-yellow-50 p-4 text-sm text-foreground/90">
          Please select a subject to view attendance.
        </div>
      )}

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
              const subjectName = subject ? subjects.find(sub => sub.id === subject)?.subject_name || "—" : "—";
              return (
                <TableRow key={s.student_id}>
                  <TableCell className="font-medium font-mono text-xs">{s.student_id}</TableCell>
                  <TableCell className="text-sm">{s.name || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.section || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{subjectName}</TableCell>
                  <TableCell className="text-center">
                    {!subject ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/10 text-muted-foreground text-xs font-medium">
                        Select a subject
                      </span>
                    ) : isPresent ? (
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
                      disabled={busyId === s.student_id || !isToday || !subject}
                      onClick={() => toggleStatus(s)}
                      className="h-7 text-xs"
                      title={!subject ? "Select a subject to mark attendance" : !isToday ? "Past dates are read-only" : ""}
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
