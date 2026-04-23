import { useEffect, useState, useMemo } from "react";
import { CheckCircle2, XCircle, Loader2, Clipboard, ClipboardCheck } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: string;
  instructor_id: string;
}

interface Props {
  /** Optional — when set, only sections belonging to this instructor are shown. */
  instructorId?: string;
  /** Optional — when set, the section filter is controlled by the parent and the internal selector is hidden. */
  sectionFilter?: string;
  /** Optional — YYYY-MM-DD; when set, the table shows attendance for that date instead of today. */
  dateFilter?: string;
}

/** Numeric-aware sort: NW0001 < NW0002 < NW0010 */
function naturalSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

const RosterAttendanceTable = ({ instructorId, sectionFilter, dateFilter }: Props) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Map<string, AttendanceRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [internalSection, setInternalSection] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const today = dateFilter || getLocalDateString();
  const isToday = today === getLocalDateString();
  // When parent controls the section, use that; otherwise fall back to internal selector.
  const isControlled = sectionFilter !== undefined;
  const section = isControlled ? (sectionFilter || "all") : internalSection;

  const refresh = async () => {
    setLoading(true);
    // Students table is a SHARED master roster (admin uploads CSV once).
    // We never filter students by instructor_id — every instructor sees all sections.
    // Attendance records stay scoped per instructor so marks don't collide.
    const [stuRes, attRes] = await Promise.all([
      supabase.from("students_master").select("*"),
      instructorId
        ? supabase.from("daily_attendance").select("*").eq("date", today).eq("instructor_id", instructorId)
        : supabase.from("daily_attendance").select("*").eq("date", today),
    ]);

    if (stuRes.data) setStudents(stuRes.data as Student[]);
    if (attRes.data) {
      const map = new Map<string, AttendanceRecord>();
      for (const r of attRes.data as AttendanceRecord[]) map.set(r.student_id, r);
      setTodayAttendance(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instructorId, today]);

  const sections = useMemo(
    () => [...new Set(students.map((s) => s.section).filter(Boolean))].sort(naturalSort),
    [students]
  );

  // Default internal selector to first section once students load (only when uncontrolled)
  useEffect(() => {
    if (!isControlled && internalSection === "all" && sections.length > 0) {
      setInternalSection(sections[0]);
    }
  }, [sections, internalSection, isControlled]);

  const visible = useMemo(() => {
    const list = section === "all" ? students : students.filter((s) => s.section === section);
    return [...list].sort((a, b) => naturalSort(a.student_id, b.student_id));
  }, [students, section]);

  const toggleStatus = async (student: Student) => {
    setBusyId(student.student_id);
    const existing = todayAttendance.get(student.student_id);
    const targetInstructor = instructorId || student.instructor_id || "";

    if (!existing) {
      const { data, error } = await supabase
        .from("daily_attendance")
        .insert({
          student_id: student.student_id,
          date: today,
          status: "Present",
          instructor_id: targetInstructor,
        })
        .select()
        .single();
      if (error) toast.error("Failed to update");
      else if (data) {
        const next = new Map(todayAttendance);
        next.set(student.student_id, data as AttendanceRecord);
        setTodayAttendance(next);
        toast.success(`${student.student_id} marked Present`);
      }
    } else if (existing.status === "Present") {
      const { error } = await supabase.from("daily_attendance").delete().eq("id", existing.id);
      if (error) toast.error("Failed to update");
      else {
        const next = new Map(todayAttendance);
        next.delete(student.student_id);
        setTodayAttendance(next);
        toast.success(`${student.student_id} marked Absent`);
      }
    }
    setBusyId(null);
  };

  const copyStatusColumn = async () => {
    const lines = visible.map((s) =>
      todayAttendance.get(s.student_id)?.status === "Present" ? "Present" : "Absent"
    );
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

  const presentCount = visible.filter((s) => todayAttendance.get(s.student_id)?.status === "Present").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{presentCount}</span> / {visible.length} present
          {isToday ? " today" : ""} ({today}){!isToday && <span className="ml-1 text-warning">· read-only past date</span>}
        </div>
        <div className="flex gap-2">
          {!isControlled && sections.length > 0 && (
            <Select value={section} onValueChange={setInternalSection}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
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
          <Button size="sm" variant="outline" onClick={copyStatusColumn} className="h-8 gap-1.5 text-xs">
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
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((s) => {
              const att = todayAttendance.get(s.student_id);
              const isPresent = att?.status === "Present";
              return (
                <TableRow key={s.student_id}>
                  <TableCell className="font-medium font-mono text-xs">{s.student_id}</TableCell>
                  <TableCell className="text-sm">{s.name || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.section || "—"}</TableCell>
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
                      disabled={busyId === s.student_id || !isToday}
                      onClick={() => toggleStatus(s)}
                      className="h-7 text-xs"
                      title={!isToday ? "Past dates are read-only" : ""}
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
