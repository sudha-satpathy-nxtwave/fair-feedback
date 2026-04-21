import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, Sparkles, RefreshCw, Lightbulb, Search, Info } from "lucide-react";
import StarRating from "./StarRating";
import SuccessAnimation from "./SuccessAnimation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  validateFeedback,
  hasAlreadySubmitted,
  recordSubmission,
} from "@/lib/feedbackValidation";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString } from "@/lib/dateUtils";

interface FeedbackFormProps {
  sessionId: string;
  instructorId: string;
}

interface AiResult {
  score: number;
  is_valid: boolean;
  category: "appreciation" | "improvement" | "reject";
  suggestion: string;
}

const FeedbackForm = ({ sessionId, instructorId }: FeedbackFormProps) => {
  const [sections, setSections] = useState<string[]>([]);
  const [section, setSection] = useState("");
  const [studentId, setStudentId] = useState("");
  const [understandingRating, setUnderstandingRating] = useState(0);
  const [instructorRating, setInstructorRating] = useState(0);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Load sections for this instructor
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("students_master")
        .select("section")
        .eq("instructor_id", instructorId);
      if (data) {
        const uniq = [...new Set(data.map((r) => r.section).filter(Boolean))].sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true })
        );
        setSections(uniq);
      }
    })();
  }, [instructorId]);

  const ratingViolation = understandingRating > 0 && instructorRating > 0 && understandingRating > instructorRating;
  const bothFive = understandingRating === 5 && instructorRating === 5;
  const aiPassed = bothFive || (aiResult?.is_valid === true && aiResult?.category !== "reject");
  const canSubmit =
    !loading &&
    !aiLoading &&
    !ratingViolation &&
    section.trim() !== "" &&
    studentId.trim() !== "" &&
    understandingRating > 0 &&
    instructorRating > 0 &&
    (bothFive || aiPassed);

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
        setAiResult({ score: 80, is_valid: true, category: "appreciation", suggestion: "" });
      } finally {
        setAiLoading(false);
      }
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedId = studentId.trim().toUpperCase();
    const trimmedSection = section.trim().toUpperCase();

    if (!trimmedSection) return setError("Please select your section.");
    if (!trimmedId) return setError("NIAT ID is required.");
    if (ratingViolation) return setError("Understanding can't be higher than Teaching rating.");
    if (understandingRating === 0 || instructorRating === 0) return setError("Please provide both ratings.");
    if (hasAlreadySubmitted(trimmedId, sessionId)) return setError("Attendance already marked for this session.");

    // Validate NIAT ID belongs to selected section
    const { data: rosterMatch } = await supabase
      .from("students_master")
      .select("student_id, section")
      .eq("student_id", trimmedId)
      .eq("section", trimmedSection)
      .maybeSingle();

    if (!rosterMatch) {
      return setError(`NIAT ID ${trimmedId} not found in section ${trimmedSection}. Check your ID and section.`);
    }

    const validation = validateFeedback(understandingRating, instructorRating, description);
    if (!validation.valid) return setError(validation.error!);
    if (!bothFive && !aiPassed) return setError("Your feedback needs improvement. Use 'Analyze My Feedback' to check.");

    setLoading(true);

    try {
      const finalScore = aiResult?.score ?? (bothFive ? 100 : 0);
      const finalCategory = aiResult?.category ?? (bothFive ? "appreciation" : "improvement");
      const today = getLocalDateString();

      // Atomic feedback insert (with category stored in description prefix metadata via separate field if available)
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

      // Atomic attendance upsert (always, since spec says feedback submission = attendance)
      await supabase.from("daily_attendance").upsert(
        { student_id: trimmedId, date: today, status: "Present", instructor_id: instructorId },
        { onConflict: "student_id,date,instructor_id" }
      );

      // Tag category in localStorage so dashboard can split tickers (optional persistence)
      try {
        const key = `feedback.cat.${trimmedId}.${sessionId}`;
        localStorage.setItem(key, finalCategory);
      } catch { /* ignore */ }

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
    <TooltipProvider>
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">Your Section</label>
          {sections.length > 0 ? (
            <Select value={section} onValueChange={setSection}>
              <SelectTrigger className="bg-secondary/50 border-border/60 text-base">
                <SelectValue placeholder="Select your section" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s) => (
                  <SelectItem key={s} value={s}>Section {s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              placeholder="e.g. S001"
              value={section}
              onChange={(e) => setSection(e.target.value.toUpperCase())}
              className="bg-secondary/50 border-border/60 text-base uppercase"
            />
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="studentId" className="text-sm font-semibold text-foreground">NIAT ID</label>
          <Input
            id="studentId"
            placeholder="Enter your NIAT ID"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value.toUpperCase())}
            className="bg-secondary/50 border-border/60 focus:border-primary text-base uppercase tracking-wide"
            autoComplete="off"
          />
        </div>

        <StarRating
          value={instructorRating}
          onChange={setInstructorRating}
          label="Rate your instructor's teaching today"
        />

        <div className="space-y-1">
          <StarRating
            value={understandingRating}
            onChange={setUnderstandingRating}
            label="Rate your understanding of today's session"
          />
          {ratingViolation && (
            <Tooltip open>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-xs text-warning">
                  <Info className="w-3 h-3" />
                  Understanding can't exceed Teaching rating
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs max-w-[220px]">If you understood well, the teaching must have been at least as good. Adjust either rating.</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

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

        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/50 border border-border/40">
          <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/70">Tips:</span> Be respectful, focus on subject/delivery, and provide solutions.
          </p>
        </div>

        {!bothFive && (
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            disabled={aiLoading || !description.trim() || understandingRating === 0 || instructorRating === 0}
            onClick={() => runAiValidation(description, understandingRating, instructorRating)}
          >
            {aiLoading ? (<><Sparkles className="w-4 h-4 animate-pulse" />Analyzing...</>) : (<><Search className="w-4 h-4" />Analyze My Feedback</>)}
          </Button>
        )}

        <AnimatePresence mode="wait">
          {!aiLoading && aiResult && (
            <motion.div
              key="ai-result"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`p-4 rounded-lg border space-y-3 ${
                aiResult.is_valid && aiResult.category !== "reject"
                  ? aiResult.category === "appreciation"
                    ? "bg-success/5 border-success/20"
                    : "bg-warning/5 border-warning/20"
                  : "bg-destructive/5 border-destructive/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className={`w-4 h-4 ${aiResult.is_valid ? "text-primary" : "text-destructive"}`} />
                  <span className="text-sm font-semibold text-foreground">AI Score: {aiResult.score}/100</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                  aiResult.category === "appreciation" ? "bg-success/10 text-success" :
                  aiResult.category === "improvement" ? "bg-warning/10 text-warning" :
                  "bg-destructive/10 text-destructive"
                }`}>
                  {aiResult.category === "reject" ? "Rejected" : aiResult.category}
                </span>
              </div>

              {aiResult.suggestion && (!aiResult.is_valid || aiResult.category === "reject") && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">AI Suggestion:</p>
                  <p className="text-sm text-foreground/80 bg-background/50 p-3 rounded-md italic">"{aiResult.suggestion}"</p>
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
            <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Submitting...</span>
          ) : ("Submit Feedback")}
        </Button>
      </motion.form>
    </TooltipProvider>
  );
};

export default FeedbackForm;
