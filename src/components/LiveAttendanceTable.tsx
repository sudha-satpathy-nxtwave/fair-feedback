import { useState, useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

interface AttendanceRow {
  id: string;
  student_id: string;
  date: string;
  status: string;
  instructor_id: string;
}

interface Props {
  instructorId: string;
}

const LiveAttendanceTable = ({ instructorId }: Props) => {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!instructorId) { setLoading(false); return; }

    const fetch = async () => {
      const { data } = await supabase
        .from("daily_attendance")
        .select("*")
        .eq("instructor_id", instructorId)
        .order("date", { ascending: false });
      if (data) setRows(data as AttendanceRow[]);
      setLoading(false);
    };
    fetch();
  }, [instructorId]);

  if (loading) return <p className="text-sm text-muted-foreground text-center py-12">Loading...</p>;
  if (!rows.length) return <p className="text-sm text-muted-foreground text-center py-12">No attendance records yet.</p>;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student ID</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.student_id}</TableCell>
              <TableCell className="text-muted-foreground text-xs">{r.date}</TableCell>
              <TableCell className="text-center">
                {r.status === "Present" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive mx-auto" />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default LiveAttendanceTable;
