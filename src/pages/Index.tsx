import { motion } from "framer-motion";
import { BookOpen, LayoutDashboard, QrCode, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import QRGenerator from "@/components/QRGenerator";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { user } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="feedback-card bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-6 sm:p-8 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-tight">FairFeedback</h1>
              <p className="text-xs text-muted-foreground">Instructor Portal</p>
            </div>
          </div>
          <div className="flex gap-1">
            {user ? (
              <>
                <Link to="/instructor-qr">
                  <Button variant="ghost" size="sm">
                    <QrCode className="w-4 h-4 mr-1" />
                    QR Hub
                  </Button>
                </Link>
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm">
                    <LayoutDashboard className="w-4 h-4 mr-1" />
                    Dashboard
                  </Button>
                </Link>
              </>
            ) : (
              <Link to="/signin">
                <Button variant="ghost" size="sm">
                  <LogIn className="w-4 h-4 mr-1" />
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
        <QRGenerator />
      </motion.div>
    </div>
  );
};

export default Index;
