import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import QRGenerator from "@/components/QRGenerator";

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="feedback-card bg-card rounded-2xl p-6 sm:p-8 w-full max-w-md"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">FairFeedback</h1>
            <p className="text-xs text-muted-foreground">Instructor Portal</p>
          </div>
        </div>
        <QRGenerator />
      </motion.div>
    </div>
  );
};

export default Index;
