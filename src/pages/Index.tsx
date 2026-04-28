import { motion } from "framer-motion";
import { GraduationCap, Shield, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLocalAuth } from "@/contexts/LocalAuthContext";

const Index = () => {
  const { session } = useLocalAuth();
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl space-y-6"
      >
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">FairFeedback</h1>
          <p className="text-sm text-muted-foreground">Honest classroom feedback, AI-validated, attendance baked in.</p>
        </div>

        {session ? (
          <div className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-xl p-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-semibold text-foreground capitalize">{session.role}</span>
              {session.displayName ? ` · ${session.displayName}` : ""}
            </p>
            <Link to="/dashboard">
              <Button className="gap-2">
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <Link to="/setup">
              <motion.div
                whileHover={{ y: -3 }}
                className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-xl p-6 space-y-3 cursor-pointer h-full"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">I'm an Instructor</h2>
                  <p className="text-xs text-muted-foreground mt-1">Register your profile or sign in with your username.</p>
                </div>
                <p className="text-xs text-primary font-medium flex items-center gap-1">
                  Continue <ArrowRight className="w-3 h-3" />
                </p>
              </motion.div>
            </Link>

            <Link to="/master-admin">
              <motion.div
                whileHover={{ y: -3 }}
                className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-xl p-6 space-y-3 cursor-pointer h-full"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Admin Access</h2>
                  <p className="text-xs text-muted-foreground mt-1">Master PIN required. Manage users & data.</p>
                </div>
                <p className="text-xs text-primary font-medium flex items-center gap-1">
                  Enter PIN <ArrowRight className="w-3 h-3" />
                </p>
              </motion.div>
            </Link>
          </div>
        )}

        <p className="text-[11px] text-center text-muted-foreground">
          Students don't sign in — they scan their instructor's QR code.
        </p>
      </motion.div>
    </div>
  );
};

export default Index;
