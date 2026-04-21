import { useState, useRef } from "react";
import Papa from "papaparse";
import { Upload, FileSpreadsheet, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CsvRow {
  niat_id?: string;
  student_id?: string;
  name?: string;
  new_section?: string;
  section?: string;
  gender?: string;
  daily_commute_type?: string;
  commute_type?: string;
  instructor_id?: string;
}

interface Props {
  defaultInstructorId?: string;
  onUploaded?: () => void;
}

const BulkStudentUpload = ({ defaultInstructorId = "", onUploaded }: Props) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setUploading(true);
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: async (results) => {
        const rows = results.data
          .map((r) => ({
            student_id: ((r.niat_id || r.student_id) || "").toString().trim().toUpperCase(),
            name: (r.name || "").toString().trim(),
            section: ((r.new_section || r.section) || "").toString().trim().toUpperCase(),
            gender: (r.gender || "").toString().trim(),
            commute_type: ((r.daily_commute_type || r.commute_type) || "").toString().trim(),
            instructor_id: (r.instructor_id || defaultInstructorId).toString().trim().toLowerCase(),
          }))
          .filter((r) => r.student_id);

        if (!rows.length) {
          toast.error("No valid rows found. Required column: NIAT ID");
          setUploading(false);
          return;
        }

        const { error } = await supabase
          .from("students_master")
          .upsert(rows, { onConflict: "student_id" });

        setUploading(false);

        if (error) {
          toast.error(`Upload failed: ${error.message}`);
          return;
        }

        toast.success(`Imported ${rows.length} student${rows.length === 1 ? "" : "s"}`);
        onUploaded?.();
        if (inputRef.current) inputRef.current.value = "";
      },
      error: (err) => {
        toast.error(`Parse error: ${err.message}`);
        setUploading(false);
      },
    });
  };

  const downloadTemplate = () => {
    const csv =
      "NIAT ID,Name,New Section,Gender,Daily commute type\n" +
      "NW0001,John Doe,S001,M,Walk\n" +
      "NW0002,Jane Smith,S001,F,Bus\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          Bulk Upload Students
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          CSV columns: <code className="text-foreground/80">NIAT ID, Name, New Section, Gender, Daily commute type</code>
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="gap-1.5"
        >
          <Upload className="w-3.5 h-3.5" />
          {uploading ? "Uploading..." : "Upload CSV"}
        </Button>
        <Button size="sm" variant="outline" onClick={downloadTemplate} className="gap-1.5">
          <Download className="w-3.5 h-3.5" />
          Template
        </Button>
      </div>
    </div>
  );
};

export default BulkStudentUpload;
