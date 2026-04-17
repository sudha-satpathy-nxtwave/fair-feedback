import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth, AppRole } from "@/contexts/AuthContext";

interface Props {
  children: React.ReactNode;
  allowed?: AppRole[];
}

const ProtectedRoute = ({ children, allowed }: Props) => {
  const { user, roleInfo, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/signin" replace />;
  if (!roleInfo) return <Navigate to="/signin" replace />;
  if (allowed && !allowed.includes(roleInfo.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
