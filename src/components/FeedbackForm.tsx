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
import { validateFeedback, getFeedbackCategory, scoreFeedback } from "@/lib/feedbackValidation";
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

interface Subject {
  id: string;
  subject_name: string;
}

const FeedbackForm = ({ sessionId, instructorId }: FeedbackFormProps) => {
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [section, setSection] = useState("");
  const [studentId, setStudentId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [understandingRating, setUnderstandingRating] = useState(0);
  const [instructorRating, setInstructorRating] = useState(0);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [hasAnalyzedFeedback, setHasAnalyzedFeedback] = useState(false);
  const [lastAnalyzedFeedback, setLastAnalyzedFeedback] = useState<{
    description: string;
    understandingRating: number;
    instructorRating: number;
  } | null>(null);
  const aiPassed = aiResult?.is_valid ?? false;

  // Load the global master roster (uploaded by admin via CSV).
  // The roster is shared across all instructors, so we do NOT filter by instructor_id here.
  useEffect(() => {
    (async () => {
      setRosterLoading(true);
      const { data } = await supabase
        .from("students_master")
        .select("student_id, name, section, original_index")
        .order("original_index", { ascending: true });
      setRoster((data ?? []) as RosterRow[]);
      setRosterLoading(false);
    })();
  }, []);

  // Load subjects from database
  useEffect(() => {
    (async () => {
      setSubjectsLoading(true);
      const { data } = await supabase
        .from("subjects")
        .select("id, subject_name")
        .order("subject_name", { ascending: true });
      setSubjects((data ?? []) as Subject[]);
      setSubjectsLoading(false);
    })();
  }, []);

  const sections = [...new Set(roster.map((r) => r.section).filter(Boolean))];

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
  const validation = validateFeedback(understandingRating, instructorRating, description);
  const localCategory = getFeedbackCategory(description, understandingRating, instructorRating);
  const localScore = scoreFeedback(description, understandingRating, instructorRating);
  const feedbackValid = validation.valid && !ratingViolation && section.trim() !== "" && studentId.trim() !== "" && subjectId.trim() !== "" && understandingRating > 0 && instructorRating > 0;

  const needsAiAnalysis = description.trim() !== "" || !bothFive;
  const analysisUpToDate =
    hasAnalyzedFeedback &&
    aiResult !== null &&
    lastAnalyzedFeedback !== null &&
    lastAnalyzedFeedback.description === description.trim() &&
    lastAnalyzedFeedback.understandingRating === understandingRating &&
    lastAnalyzedFeedback.instructorRating === instructorRating &&
    aiResult.score >= 75 &&
    aiResult.is_valid;

  const canSubmit = !loading && !aiLoading && feedbackValid && (!needsAiAnalysis || analysisUpToDate);

  const runAiValidation = useCallback(
    async (text: string, uRating: number, iRating: number) => {
      if (!text.trim() || uRating === 0 || iRating === 0) {
        setAiResult(null);
        setHasAnalyzedFeedback(false);
        return;
      }
      setError("");
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
        const result = data as AiResult;
        setAiResult(result);
        setHasAnalyzedFeedback(true);
        setLastAnalyzedFeedback({
          description: text.trim(),
          understandingRating: uRating,
          instructorRating: iRating,
        });
      } catch (err) {
        console.error("AI validation error:", err);
        setAiResult(null);
        setHasAnalyzedFeedback(false);
        setError("AI analysis failed. Please try again.");
      } finally {
        setAiLoading(false);
      }
    },
    [localCategory, localScore, validation.valid, validation.error]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedId = studentId.trim().toUpperCase();
    const trimmedSection = section.trim().toUpperCase();

    if (!trimmedSection) return setError("Please select your section.");
    if (!trimmedId) return setError("Please select your NIAT ID from the list.");
    if (!subjectId) return setError("Please select a subject.");
    if (ratingViolation) return setError("Understanding rating can't be higher than the Teaching rating.");
    if (understandingRating === 0 || instructorRating === 0) return setError("Please provide both ratings.");
    if (!validation.valid) {
      return setError(validation.error || "Please provide valid feedback.");
    }

    const needsAiAnalysis = description.trim() !== "" || !bothFive;
    const analysisUpToDate =
      hasAnalyzedFeedback &&
      aiResult !== null &&
      lastAnalyzedFeedback !== null &&
      lastAnalyzedFeedback.description === description.trim() &&
      lastAnalyzedFeedback.understandingRating === understandingRating &&
      lastAnalyzedFeedback.instructorRating === instructorRating;

    if (needsAiAnalysis && !analysisUpToDate) {
      return setError("Please analyze your feedback before submitting. The analyzed feedback must score at least 75%.");
    }

    // Roster validation (defence in depth — UI already restricts dropdown)
    const inRoster = roster.some(
      (r) => r.student_id === trimmedId && r.section === trimmedSection
    );
    if (!inRoster) {
      return setError(`NIAT ID ${trimmedId} is not in section ${trimmedSection}. Pick from the dropdown.`);
    }

    setLoading(true);

    try {
      // Check for recent submission (database-driven validation)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentFeedback, error: checkError } = await supabase
        .from("attendance_feedback")
        .select("id")
        .eq("student_id", trimmedId)
        .eq("subject_id", subjectId)
        .gt("created_at", oneHourAgo)
        .limit(1);

      if (checkError) throw checkError;
      if (recentFeedback && recentFeedback.length > 0) {
        return setError("You have already submitted feedback for this subject within the last hour. Please try again later.");
      }

      const finalScore = aiResult?.score ?? localScore;
      const today = getLocalDateString();

      const baseFeedback = {
        student_id: trimmedId,
        session_id: sessionId,
        subject_id: subjectId,
        understanding_rating: understandingRating,
        instructor_rating: instructorRating,
        description: description.trim() || "NA",
        ai_score: finalScore,
        attendance_marked: true,
      };

      const { error: dbError } = await supabase.from("attendance_feedback").insert(baseFeedback);
      if (dbError) {
        throw dbError;
      }

      const { data: dailyData, error: dailyError } = await supabase.from("daily_attendance").upsert(
        {
          student_id: trimmedId,
          date: today,
          status: "Present",
          instructor_id: instructorId,
          subject_id: subjectId,
        },
        { onConflict: "student_id,date,instructor_id,subject_id" }
      ).select().single();

      if (dailyError) {
        throw dailyError;
      }

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

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">Step 3 — Select Subject</label>
          <Select value={subjectId} onValueChange={setSubjectId} disabled={subjectsLoading}>
            <SelectTrigger className="bg-secondary/50 border-border/60 text-base h-11">
              <SelectValue placeholder={subjectsLoading ? "Loading subjects..." : "Select a subject"} />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.subject_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <StarRating
          value={instructorRating}
          onChange={(value) => {
            setInstructorRating(value);
            setAiResult(null);
            setHasAnalyzedFeedback(false);
            setLastAnalyzedFeedback(null);
          }}
          label="Step 4 — Rate your instructor's teaching today"
        />

        <div className="space-y-1">
          <StarRating
            value={understandingRating}
            onChange={(value) => {
              setUnderstandingRating(value);
              setAiResult(null);
              setHasAnalyzedFeedback(false);
              setLastAnalyzedFeedback(null);
            }}
            label="Step 5 — Rate your understanding of today's session"
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
            Step 6 — What do you need more to learn better?
            {bothFive && <span className="text-muted-foreground font-normal ml-1">(optional)</span>}
          </label>
          <Textarea
            id="description"
            placeholder="Share your thoughts on what could help you learn better..."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setAiResult(null);
              setHasAnalyzedFeedback(false);
              setLastAnalyzedFeedback(null);
            }}
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

              {aiResult.suggestion && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">AI Suggestion:</p>
                  <p className="text-sm text-foreground/80 bg-background/50 p-3 rounded-md italic">{aiResult.suggestion}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const suggestion = aiResult.suggestion.trim();
                      setDescription(suggestion);
                      // AI suggestions are pre-approved with a baseline score of 80
                      setAiResult({
                        score: 80,
                        is_valid: true,
                        category: aiResult.category,
                        suggestion: suggestion,
                      });
                      setHasAnalyzedFeedback(true);
                      setLastAnalyzedFeedback({
                        description: suggestion,
                        understandingRating,
                        instructorRating,
                      });
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
