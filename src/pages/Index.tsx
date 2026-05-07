import { motion } from "framer-motion";
import { ArrowRight, Scan, MessageSquare, CheckCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLocalAuth } from "@/contexts/LocalAuthContext";
import { useEffect } from "react";

const FeatureChip = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
  <div className="flex items-center gap-2 rounded-full border border-border/40 bg-card/50 backdrop-blur px-4 py-2 text-xs text-muted-foreground">
    <Icon className="w-3.5 h-3.5 text-primary" />
    {label}
  </div>
);

const Index = () => {
  const { session } = useLocalAuth();
  const navigate = useNavigate();

  // If already signed in, redirect to dashboard
  useEffect(() => {
    if (session) navigate("/dashboard", { replace: true });
  }, [session, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden relative">
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-xl text-center space-y-8 relative z-10"
      >
        {/* Logo mark */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="flex justify-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <CheckCircle className="w-8 h-8 text-primary-foreground" />
          </div>
        </motion.div>

        {/* Headline */}
        <div className="space-y-3">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-5xl sm:text-6xl font-extrabold tracking-tight text-foreground"
          >
            Attendify
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-lg sm:text-xl font-medium text-primary"
          >
            Presence with Purpose
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="text-sm text-muted-foreground font-medium tracking-widest uppercase"
          >
            Scan · Respond · Marked
          </motion.p>
        </div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="text-sm sm:text-base text-muted-foreground max-w-sm mx-auto leading-relaxed"
        >
          AI-powered classroom feedback with seamless attendance tracking —
          designed for modern educators and students.
        </motion.p>

        {/* Feature chips */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="flex flex-wrap justify-center gap-2"
        >
          <FeatureChip icon={Scan} label="QR Attendance" />
          <FeatureChip icon={MessageSquare} label="AI Feedback Validation" />
          <FeatureChip icon={CheckCircle} label="Google Sheets Integration" />
        </motion.div>

        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="flex justify-center"
        >
          <Link to="/setup">
            <Button size="lg" className="gap-2 px-8 py-6 text-base font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>

        {/* Student note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75, duration: 0.5 }}
          className="text-[11px] text-muted-foreground/60"
        >
          Students don't sign in — they scan their instructor's QR code.
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Index;
