import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle } from "lucide-react";
import StarRating from "./StarRating";
import SuccessAnimation from "./SuccessAnimation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  validateFeedback,
  hasAlreadySubmitted,
  recordSubmission,
  type FeedbackData,
} from "@/lib/feedbackValidation";
import { saveFeedback } from "@/lib/feedbackStore";

interface FeedbackFormProps {
  sessionId: string;
}

const FeedbackForm = ({ sessionId }: FeedbackFormProps) => {
  const [studentId, setStudentId] = useState("");
  const [understandingRating, setUnderstandingRating] = useState(0);
  const [instructorRating, setInstructorRating] = useState(0);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedId = studentId.trim().toUpperCase();

    if (!trimmedId) {
      setError("Student ID is required.");
      return;
    }

    if (understandingRating === 0 || instructorRating === 0) {
      setError("Please provide both ratings.");
      return;
    }

    if (hasAlreadySubmitted(trimmedId, sessionId)) {
      setError("Attendance already marked for this session.");
      return;
    }

    const validation = validateFeedback(understandingRating, instructorRating, description);
    if (!validation.valid) {
      setError(validation.error!);
      return;
    }

    setLoading(true);

    const feedbackData: FeedbackData = {
      timestamp: new Date().toISOString(),
      student_id: trimmedId,
      session_id: sessionId,
      understanding_rating: understandingRating,
      instructor_rating: instructorRating,
      description: description.trim() || "NA",
      attendance_marked: true,
    };

    try {
      await new Promise((r) => setTimeout(r, 800));
      saveFeedback(feedbackData);
      recordSubmission(trimmedId, sessionId);
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return <SuccessAnimation />;
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="space-y-1.5">
        <label htmlFor="studentId" className="text-sm font-semibold text-foreground">
          Student ID
        </label>
        <Input
          id="studentId"
          placeholder="Enter your Student ID"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value.toUpperCase())}
          className="bg-secondary/50 border-border/60 focus:border-primary text-base uppercase tracking-wide"
          autoComplete="off"
        />
      </div>

      <StarRating
        value={understandingRating}
        onChange={setUnderstandingRating}
        label="Rate your understanding of today's session"
      />

      <StarRating
        value={instructorRating}
        onChange={setInstructorRating}
        label="Rate your instructor's teaching today"
      />

      <div className="space-y-1.5">
        <label htmlFor="description" className="text-sm font-semibold text-foreground">
          What do you need more to learn better?
          {understandingRating > 0 && instructorRating > 0 && understandingRating === 5 && instructorRating === 5 && (
            <span className="text-muted-foreground font-normal ml-1">(optional)</span>
          )}
        </label>
        <Textarea
          id="description"
          placeholder="Share your thoughts on what could help you learn better..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="bg-secondary/50 border-border/60 focus:border-primary text-base resize-none"
        />
      </div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-2.5 p-3.5 rounded-lg bg-destructive/8 border border-destructive/20"
          >
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive font-medium">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-12 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Validating...
          </span>
        ) : (
          "Submit Feedback"
        )}
      </Button>
    </motion.form>
  );
};

export default FeedbackForm;
