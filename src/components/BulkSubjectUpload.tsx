import { useState, useRef } from "react";
import Papa from "papaparse";
import { Upload, FileSpreadsheet, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CsvRow {
  subject_name?: string;
  name?: string;
}

interface Props {
  onUploaded?: () => void;
}

const BulkSubjectUpload = ({ onUploaded }: Props) => {
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
            subject_name: ((r.subject_name || r.name) || "").toString().trim(),
          }))
          .filter((r) => r.subject_name);

        if (!rows.length) {
          toast.error("No valid rows found. Required column: Subject Name");
          setUploading(false);
          return;
        }

        const { error } = await supabase
          .from("subjects")
          .insert(rows);

        setUploading(false);

        if (error) {
          toast.error(`Upload failed: ${error.message}`);
          return;
        }

        toast.success(`Imported ${rows.length} subject${rows.length === 1 ? "" : "s"}`);
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
      "Subject Name\n" +
      "Data Structures\n" +
      "Web Development\n" +
      "Calculus I\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subjects_template.csv"
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          Bulk Upload Subjects
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          CSV columns: <code className="text-foreground/80">Subject Name</code>
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

export default BulkSubjectUpload;
