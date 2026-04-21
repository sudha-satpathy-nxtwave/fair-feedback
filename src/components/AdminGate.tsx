import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useLocalAuth } from "@/contexts/LocalAuthContext";

interface Props {
  children: ReactNode;
  /** If true, both admin and co-admin pass. If false, only admin. */
  allowCoAdmin?: boolean;
}

const AdminGate = ({ children, allowCoAdmin = true }: Props) => {
  const { session, loading } = useLocalAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!session) return <Navigate to="/master-admin" replace />;
  if (session.role === "admin") return <>{children}</>;
  if (allowCoAdmin && session.role === "co-admin") return <>{children}</>;
  return <Navigate to="/" replace />;
};

export default AdminGate;
