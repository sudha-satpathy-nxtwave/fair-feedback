import { useEffect, useState } from "react";
import { UserPlus, Shield, GraduationCap, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RoleRow {
  id: string;
  user_id: string;
  role: "admin" | "instructor";
  instructor_id: string | null;
  created_at: string;
}

const UserManagementAdmin = () => {
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "instructor">("instructor");
  const [instructorId, setInstructorId] = useState("");

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("user_roles")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setRows(data as RoleRow[]);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const handleCreate = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error("Email and password are required");
      return;
    }
    if (role === "instructor" && !instructorId.trim()) {
      toast.error("Instructor ID is required");
      return;
    }

    setBusy(true);
    // Sign up via auth (auto-confirm is enabled)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/signin` },
    });

    if (error || !data.user) {
      setBusy(false);
      toast.error(`Failed: ${error?.message ?? "no user returned"}`);
      return;
    }

    const newUserId = data.user.id;
    const { error: roleErr } = await supabase.from("user_roles").insert({
      user_id: newUserId,
      role,
      instructor_id: role === "instructor" ? instructorId.trim().toLowerCase().replace(/\s+/g, "-") : null,
    });

    setBusy(false);
    if (roleErr) {
      toast.error(`Role assign failed: ${roleErr.message}`);
      return;
    }

    toast.success(`Created ${role}: ${email}`);
    setEmail("");
    setPassword("");
    setInstructorId("");
    refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this role assignment? (Auth account is not deleted.)")) return;
    const { error } = await supabase.from("user_roles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Role removed");
      refresh();
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" />
          User Management
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Create admin or instructor accounts. New users sign in immediately (email auto-confirmed).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Email</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@school.edu" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Temp password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="min 6 chars"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Role</label>
          <Select value={role} onValueChange={(v) => setRole(v as "admin" | "instructor")}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="instructor">Instructor</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Instructor ID {role === "admin" && <span className="text-muted-foreground font-normal">(N/A)</span>}
          </label>
          <Input
            disabled={role === "admin"}
            value={instructorId}
            onChange={(e) => setInstructorId(e.target.value)}
            placeholder="e.g. radhe"
            className="h-9"
          />
        </div>
      </div>

      <Button onClick={handleCreate} disabled={busy} size="sm" className="gap-1.5">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
        Create User
      </Button>

      <div className="border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Instructor ID</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">Loading...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">No users yet.</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {r.role === "admin" ? <Shield className="w-3 h-3" /> : <GraduationCap className="w-3 h-3" />}
                    {r.role}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.instructor_id ?? "—"}</TableCell>
                <TableCell className="font-mono text-[10px] text-muted-foreground truncate max-w-[160px]">{r.user_id}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)} className="h-7 w-7 p-0 text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default UserManagementAdmin;
