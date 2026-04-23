import { useEffect, useState } from "react";
import { Trash2, Loader2, User, Image as ImageIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InstructorRow {
  username: string;
  display_name: string;
  qr_image_url: string | null;
}

/**
 * Admin-only management list for instructor profiles.
 * Deleting an instructor cascades by clearing their related rows in:
 *   - attendance_feedback (matched by session_id LIKE 'username_%')
 *   - daily_attendance   (matched by instructor_id)
 *   - session_codes      (matched by instructor_id)
 *   - students_master    (instructor_id is cleared, NOT deleted — roster preserved)
 *   - storage object in 'instructor-qrs' bucket if applicable
 */
const InstructorAdminList = () => {
  const [rows, setRows] = useState<InstructorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUser, setBusyUser] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("instructor_profiles")
      .select("username, display_name, qr_image_url")
      .order("display_name");
    if (error) toast.error("Could not load instructors");
    setRows((data ?? []) as InstructorRow[]);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const removeQrOnly = async (row: InstructorRow) => {
    setBusyUser(row.username);
    try {
      // Best-effort storage cleanup: derive object path from public URL
      if (row.qr_image_url) {
        const marker = "/instructor-qrs/";
        const idx = row.qr_image_url.indexOf(marker);
        if (idx !== -1) {
          const path = row.qr_image_url.slice(idx + marker.length);
          await supabase.storage.from("instructor-qrs").remove([path]);
        }
      }
      const { error } = await supabase
        .from("instructor_profiles")
        .update({ qr_image_url: null })
        .eq("username", row.username);
      if (error) throw error;
      toast.success(`QR removed for ${row.display_name}`);
      refresh();
    } catch (e) {
      console.error(e);
      toast.error("Failed to remove QR");
    } finally {
      setBusyUser(null);
    }
  };

  const deleteInstructor = async (row: InstructorRow) => {
    setBusyUser(row.username);
    try {
      // Cascade: feedback rows by session_id prefix (instructor username + "_")
      await supabase
        .from("attendance_feedback")
        .delete()
        .like("session_id", `${row.username}\\_%`);
      // Daily attendance for this instructor
      await supabase.from("daily_attendance").delete().eq("instructor_id", row.username);
      // Any session codes
      await supabase.from("session_codes").delete().eq("instructor_id", row.username);
      // Detach roster rows (clear instructor_id, keep students_master intact)
      await supabase
        .from("students_master")
        .update({ instructor_id: "" })
        .eq("instructor_id", row.username);
      // Storage QR object
      if (row.qr_image_url) {
        const marker = "/instructor-qrs/";
        const idx = row.qr_image_url.indexOf(marker);
        if (idx !== -1) {
          const path = row.qr_image_url.slice(idx + marker.length);
          await supabase.storage.from("instructor-qrs").remove([path]);
        }
      }
      // Finally remove the profile
      const { error } = await supabase
        .from("instructor_profiles")
        .delete()
        .eq("username", row.username);
      if (error) throw error;
      toast.success(`Deleted ${row.display_name} and cascaded their session data`);
      refresh();
    } catch (e) {
      console.error(e);
      toast.error("Cascade delete failed — see console");
    } finally {
      setBusyUser(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> Instructors
          </h3>
          <p className="text-xs text-muted-foreground">
            Deleting cascades feedback, attendance, and session codes. Roster is detached, not deleted.
          </p>
        </div>
        <Button onClick={refresh} variant="ghost" size="sm" className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-border/40 rounded-xl text-sm text-muted-foreground">
          No instructors registered yet. They appear here after completing setup at <code>/setup</code>.
        </div>
      ) : (
        <div className="border border-border/40 rounded-xl overflow-hidden bg-card/60 backdrop-blur-xl divide-y divide-border/40">
          {rows.map((r) => (
            <div key={r.username} className="flex items-center gap-3 p-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                {r.qr_image_url ? (
                  <ImageIcon className="w-4 h-4 text-primary" />
                ) : (
                  <User className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{r.display_name}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">@{r.username}</p>
              </div>
              {r.qr_image_url && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" disabled={busyUser === r.username} className="text-xs h-8">
                      Remove QR
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove QR for {r.display_name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Their custom session QR will be deleted. They can re-upload one via <code>/setup</code>.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeQrOnly(r)}>Remove QR</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyUser === r.username}
                    className="text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                  >
                    {busyUser === r.username ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {r.display_name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes the instructor profile and cascades:
                      <ul className="list-disc pl-5 mt-2 space-y-0.5 text-xs">
                        <li>All feedback they collected</li>
                        <li>All daily attendance records under their ID</li>
                        <li>Any session codes</li>
                        <li>Their custom QR image</li>
                      </ul>
                      The students_master roster is preserved (instructor_id detached).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteInstructor(r)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete & cascade
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InstructorAdminList;
