import { useEffect, useState, useMemo } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
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
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: string;
  instructor_id: string;
}

interface Props {
  instructorId: string;
}

const RosterAttendanceTable = ({ instructorId }: Props) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Map<string, AttendanceRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const today = getLocalDateString();

  const refresh = async () => {
    if (!instructorId) {
      setStudents([]);
      setTodayAttendance(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    const [stuRes, attRes] = await Promise.all([
      supabase.from("students_master").select("*").eq("instructor_id", instructorId),
      supabase.from("daily_attendance").select("*").eq("instructor_id", instructorId).eq("date", today),
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
  }, [instructorId]);

  const sections = useMemo(
    () => [...new Set(students.map((s) => s.section).filter(Boolean))].sort(),
    [students]
  );

  const visible = useMemo(
    () => (section === "all" ? students : students.filter((s) => s.section === section)),
    [students, section]
  );

  const toggleStatus = async (student: Student) => {
    setBusyId(student.student_id);
    const existing = todayAttendance.get(student.student_id);

    if (!existing) {
      // mark Present
      const { data, error } = await supabase
        .from("daily_attendance")
        .insert({
          student_id: student.student_id,
          date: today,
          status: "Present",
          instructor_id: instructorId,
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
    } else {
      // toggle: present ↔ absent (we represent absent as deletion)
      if (existing.status === "Present") {
        const { error } = await supabase.from("daily_attendance").delete().eq("id", existing.id);
        if (error) toast.error("Failed to update");
        else {
          const next = new Map(todayAttendance);
          next.delete(student.student_id);
          setTodayAttendance(next);
          toast.success(`${student.student_id} marked Absent`);
        }
      }
    }
    setBusyId(null);
  };

  if (!instructorId) {
    return <p className="text-sm text-muted-foreground text-center py-12">Select an instructor first.</p>;
  }
  if (loading) return <p className="text-sm text-muted-foreground text-center py-12">Loading roster...</p>;
  if (!students.length) {
    return (
      <div className="text-center py-12 space-y-1.5">
        <p className="text-sm text-muted-foreground">No students in roster for <strong>{instructorId}</strong>.</p>
        <p className="text-xs text-muted-foreground">Use the Admin tab to bulk upload your roster.</p>
      </div>
    );
  }

  const presentCount = visible.filter((s) => todayAttendance.get(s.student_id)?.status === "Present").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{presentCount}</span> / {visible.length} present today ({today})
        </div>
        {sections.length > 0 && (
          <Select value={section} onValueChange={setSection}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="All sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              {sections.map((s) => (
                <SelectItem key={s} value={s}>Section {s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student ID</TableHead>
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
                      disabled={busyId === s.student_id}
                      onClick={() => toggleStatus(s)}
                      className="h-7 text-xs"
                    >
                      {busyId === s.student_id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
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
