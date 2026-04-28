import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useLocalAuth } from "@/contexts/LocalAuthContext";

const InstructorGate = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useLocalAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!session) return <Navigate to="/setup" replace />;
  if (session.role !== "instructor") return <Navigate to="/" replace />;
  if (!session.username) return <Navigate to="/setup" replace />;
  return <>{children}</>;
};

export default InstructorGate;
