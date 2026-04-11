import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, AlertTriangle } from "lucide-react";
import FeedbackForm from "@/components/FeedbackForm";

const FeedbackPage = () => {
  const [searchParams] = useSearchParams();
  const instructor = searchParams.get("instructor");
  const date = searchParams.get("date");

  if (!instructor || !date) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="feedback-card bg-card rounded-2xl p-8 w-full max-w-md text-center space-y-4"
        >
          <AlertTriangle className="w-12 h-12 text-warning mx-auto" />
          <h2 className="text-lg font-bold text-foreground">Invalid Session</h2>
          <p className="text-sm text-muted-foreground">
            Please scan the QR code provided by your instructor to access the feedback form.
          </p>
        </motion.div>
      </div>
    );
  }

  const sessionId = `${instructor.toLowerCase().replace(/\s+/g, "-")}_${date}`;

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
            <h1 className="text-lg font-bold text-foreground leading-tight">Session Feedback</h1>
            <p className="text-xs text-muted-foreground">
              Instructor: <span className="font-medium text-foreground/70">{instructor}</span>
              {" · "}
              {date}
            </p>
          </div>
        </div>
        <FeedbackForm sessionId={sessionId} />
      </motion.div>
    </div>
  );
};

export default FeedbackPage;
