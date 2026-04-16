import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, Sparkles, RefreshCw, Lightbulb, Search } from "lucide-react";
import StarRating from "./StarRating";
import SuccessAnimation from "./SuccessAnimation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  validateFeedback,
  hasAlreadySubmitted,
  recordSubmission,
} from "@/lib/feedbackValidation";
import { supabase } from "@/integrations/supabase/client";

interface FeedbackFormProps {
  sessionId: string;
}

interface AiResult {
  score: number;
  is_valid: boolean;
  suggestion: string;
}

const FeedbackForm = ({ sessionId }: FeedbackFormProps) => {
  const [studentId, setStudentId] = useState("");
  const [understandingRating, setUnderstandingRating] = useState(0);
  const [instructorRating, setInstructorRating] = useState(0);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const runAiValidation = useCallback(
    async (text: string, uRating: number, iRating: number) => {
      if (!text.trim() || uRating === 0 || iRating === 0) {
        setAiResult(null);
        return;
      }

      setAiLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("validate-feedback", {
          body: {
            understanding_rating: uRating,
            instructor_rating: iRating,
            description: text.trim(),
          },
        });

        if (error) throw error;
        setAiResult(data as AiResult);
      } catch (err) {
        console.error("AI validation error:", err);
        setAiResult({ score: 80, is_valid: true, suggestion: "" });
      } finally {
        setAiLoading(false);
      }
    },
    []
  );

  const bothFive = understandingRating === 5 && instructorRating === 5;
  const aiPassed = bothFive || (aiResult?.is_valid === true);
  const canSubmit =
    !loading &&
    !aiLoading &&
    studentId.trim() !== "" &&
    understandingRating > 0 &&
    instructorRating > 0 &&
    (bothFive || aiPassed);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedId = studentId.trim().toUpperCase();

    if (!trimmedId) { setError("Student ID is required."); return; }
    if (understandingRating === 0 || instructorRating === 0) { setError("Please provide both ratings."); return; }
    if (hasAlreadySubmitted(trimmedId, sessionId)) { setError("Attendance already marked for this session."); return; }

    const validation = validateFeedback(understandingRating, instructorRating, description);
    if (!validation.valid) { setError(validation.error!); return; }
    if (!bothFive && !aiPassed) { setError("Your feedback needs improvement. Use 'Analyze My Feedback' to check your score."); return; }

    setLoading(true);

    try {
      const finalScore = aiResult?.score ?? 0;

      // Insert feedback
      const { error: dbError } = await supabase.from("attendance_feedback").insert({
        student_id: trimmedId,
        session_id: sessionId,
        understanding_rating: understandingRating,
        instructor_rating: instructorRating,
        description: description.trim() || "NA",
        ai_score: finalScore,
        attendance_marked: true,
      });
      if (dbError) throw dbError;

      // Auto-mark attendance if AI score >= 75
      if (finalScore >= 75 || bothFive) {
        const instructorId = sessionId.split("_")[0];
        const today = new Date().toISOString().split("T")[0];

        await supabase.from("daily_attendance").upsert(
          { student_id: trimmedId, date: today, status: "Present", instructor_id: instructorId },
          { onConflict: "student_id,date,instructor_id" }
        );

        // Ensure student exists in master roster
        await supabase.from("students_master").upsert(
          { student_id: trimmedId },
          { onConflict: "student_id" }
        );
      }

      recordSubmission(trimmedId, sessionId);
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) return <SuccessAnimation />;

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="space-y-1.5">
        <label htmlFor="studentId" className="text-sm font-semibold text-foreground">Student ID</label>
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
          {bothFive && <span className="text-muted-foreground font-normal ml-1">(optional)</span>}
        </label>
        <Textarea
          id="description"
          placeholder="Share your thoughts on what could help you learn better..."
          value={description}
          onChange={(e) => { setDescription(e.target.value); setAiResult(null); }}
          rows={4}
          className="bg-secondary/50 border-border/60 focus:border-primary text-base resize-none"
        />
      </div>

      {/* Live Tips */}
      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/50 border border-border/40">
        <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground/70">Tips:</span> Be respectful, focus on subject/delivery, and provide solutions.
        </p>
      </div>

      {/* Manual Analyze Button */}
      {!bothFive && (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          disabled={aiLoading || !description.trim() || understandingRating === 0 || instructorRating === 0}
          onClick={() => runAiValidation(description, understandingRating, instructorRating)}
        >
          {aiLoading ? (
            <>
              <Sparkles className="w-4 h-4 animate-pulse" />
              Analyzing...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Analyze My Feedback
            </>
          )}
        </Button>
      )}

      {/* AI Result */}
      <AnimatePresence mode="wait">
        {!aiLoading && aiResult && (
          <motion.div
            key="ai-result"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`p-4 rounded-lg border space-y-3 ${
              aiResult.is_valid ? "bg-green-500/5 border-green-500/20" : "bg-amber-500/5 border-amber-500/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className={`w-4 h-4 ${aiResult.is_valid ? "text-green-500" : "text-amber-500"}`} />
                <span className="text-sm font-semibold text-foreground">AI Score: {aiResult.score}/100</span>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                aiResult.is_valid ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"
              }`}>
                {aiResult.is_valid ? "Valid" : "Needs Improvement"}
              </span>
            </div>

            {aiResult.suggestion && !aiResult.is_valid && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">AI Suggestion:</p>
                <p className="text-sm text-foreground/80 bg-background/50 p-3 rounded-md italic">
                  "{aiResult.suggestion}"
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDescription(aiResult.suggestion);
                    runAiValidation(aiResult.suggestion, understandingRating, instructorRating);
                  }}
                  className="gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Replace my feedback
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
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
        disabled={!canSubmit}
        className="w-full h-12 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting...
          </span>
        ) : (
          "Submit Feedback"
        )}
      </Button>
    </motion.form>
  );
};

export default FeedbackForm;
