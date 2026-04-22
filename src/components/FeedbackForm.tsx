import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, Sparkles, RefreshCw, Lightbulb, Info } from "lucide-react";
import StarRating from "./StarRating";
import SuccessAnimation from "./SuccessAnimation";
import StudentSearchSelect, { StudentOption } from "./StudentSearchSelect";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { hasAlreadySubmitted, recordSubmission } from "@/lib/feedbackValidation";
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

interface RosterRow {
  student_id: string;
  name: string;
  section: string;
}

function naturalSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

const FeedbackForm = ({ sessionId, instructorId }: FeedbackFormProps) => {
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
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

  // Load full roster once for this instructor — used for both section list & NIAT dropdown.
  useEffect(() => {
    (async () => {
      setRosterLoading(true);
      const { data } = await supabase
        .from("students_master")
        .select("student_id, name, section")
        .eq("instructor_id", instructorId);
      setRoster((data ?? []) as RosterRow[]);
      setRosterLoading(false);
    })();
  }, [instructorId]);

  const sections = [...new Set(roster.map((r) => r.section).filter(Boolean))].sort(naturalSort);

  const studentsInSection: StudentOption[] = section
    ? roster
        .filter((r) => r.section === section)
        .map((r) => ({ student_id: r.student_id, name: r.name }))
    : [];

  // Reset student when section changes
  useEffect(() => {
    setStudentId("");
  }, [section]);

  const ratingViolation = understandingRating > 0 && instructorRating > 0 && understandingRating > instructorRating;
  const bothFive = understandingRating === 5 && instructorRating === 5;
  const wordCount = description.trim().split(/\s+/).filter(Boolean).length;
  const fiveStarTextOk = !description.trim() || wordCount >= 10;
  const aiPassed = aiResult?.is_valid === true && aiResult?.category !== "reject" && (aiResult?.score ?? 0) >= 75;

  const canSubmit =
    !loading &&
    !aiLoading &&
    !ratingViolation &&
    section.trim() !== "" &&
    studentId.trim() !== "" &&
    understandingRating > 0 &&
    instructorRating > 0 &&
    (bothFive ? fiveStarTextOk : aiPassed);

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
        setAiResult({ score: 0, is_valid: false, category: "reject", suggestion: "AI service unavailable. Please try again." });
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
    if (!trimmedId) return setError("Please select your NIAT ID from the list.");
    if (ratingViolation) return setError("Understanding rating can't be higher than the Teaching rating.");
    if (understandingRating === 0 || instructorRating === 0) return setError("Please provide both ratings.");
    if (bothFive && description.trim() && wordCount < 10) {
      return setError("If you write something for a 5/5 rating, please use at least 10 words.");
    }
    if (hasAlreadySubmitted(trimmedId, sessionId)) return setError("Attendance already marked for this session.");

    // Roster validation (defence in depth — UI already restricts dropdown)
    const inRoster = roster.some(
      (r) => r.student_id === trimmedId && r.section === trimmedSection
    );
    if (!inRoster) {
      return setError(`NIAT ID ${trimmedId} is not in section ${trimmedSection}. Pick from the dropdown.`);
    }

    if (!bothFive && !aiPassed) {
      return setError("Your feedback needs improvement. Click 'Analyze My Feedback' first.");
    }

    setLoading(true);

    try {
      const finalScore = bothFive ? 100 : aiResult?.score ?? 0;
      const finalCategory = bothFive ? "appreciation" : aiResult?.category ?? "improvement";
      const today = getLocalDateString();

      // Atomic feedback insert
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

      // Atomic attendance upsert (feedback submission = attendance marked)
      await supabase.from("daily_attendance").upsert(
        { student_id: trimmedId, date: today, status: "Present", instructor_id: instructorId },
        { onConflict: "student_id,date,instructor_id" }
      );

      // Persist category locally so dashboard can split lists even before the column lands
      try {
        localStorage.setItem(`feedback.cat.${trimmedId}.${sessionId}`, finalCategory);
      } catch { /* ignore */ }

      recordSubmission(trimmedId, sessionId);
      setSuccess(true);
    } catch (e) {
      console.error("Submit error:", e);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) return <SuccessAnimation />;

  if (rosterLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (roster.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <AlertCircle className="w-8 h-8 text-warning mx-auto" />
        <p className="text-sm font-semibold text-foreground">Roster not set up</p>
        <p className="text-xs text-muted-foreground">
          Your instructor hasn't uploaded the student roster yet. Please ask them to do so.
        </p>
      </div>
    );
  }

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
          <label className="text-sm font-semibold text-foreground">Step 1 — Your Section</label>
          <Select value={section} onValueChange={setSection}>
            <SelectTrigger className="bg-secondary/50 border-border/60 text-base h-11">
              <SelectValue placeholder="Select your section" />
            </SelectTrigger>
            <SelectContent>
              {sections.map((s) => (
                <SelectItem key={s} value={s}>Section {s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">
            Step 2 — Your NIAT ID
            {section && <span className="text-muted-foreground font-normal ml-1">({studentsInSection.length} students)</span>}
          </label>
          <StudentSearchSelect
            options={studentsInSection}
            value={studentId}
            onChange={setStudentId}
            disabled={!section}
            placeholder={section ? "Search your NIAT ID or name..." : "Pick a section first"}
          />
        </div>

        <StarRating
          value={instructorRating}
          onChange={setInstructorRating}
          label="Step 3 — Rate your instructor's teaching today"
        />

        <div className="space-y-1">
          <StarRating
            value={understandingRating}
            onChange={setUnderstandingRating}
            label="Step 4 — Rate your understanding of today's session"
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
                <p className="text-xs max-w-[240px]">
                  If you understood well, the teaching must have been at least as good. Lower Understanding or raise Teaching.
                </p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="description" className="text-sm font-semibold text-foreground">
            Step 5 — What do you need more to learn better?
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
          {bothFive && description.trim() && wordCount < 10 && (
            <p className="text-xs text-warning flex items-center gap-1">
              <Info className="w-3 h-3" /> If you write feedback for 5/5, use at least 10 words ({wordCount}/10).
            </p>
          )}
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
            {aiLoading ? (<><Sparkles className="w-4 h-4 animate-pulse" />Analyzing...</>) : (<><Sparkles className="w-4 h-4" />Analyze My Feedback</>)}
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
                aiPassed
                  ? aiResult.category === "appreciation"
                    ? "bg-success/5 border-success/20"
                    : "bg-warning/5 border-warning/20"
                  : "bg-destructive/5 border-destructive/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className={`w-4 h-4 ${aiPassed ? "text-primary" : "text-destructive"}`} />
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

              {aiResult.suggestion && !aiPassed && (
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
                    Use this suggestion
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
          ) : ("Submit Feedback & Mark Attendance")}
        </Button>
      </motion.form>
    </TooltipProvider>
  );
};

export default FeedbackForm;
