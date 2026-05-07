import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, Sparkles, RefreshCw, Lightbulb, Info, CheckCircle2 } from "lucide-react";
import StarRating from "./StarRating";
import SuccessAnimation from "./SuccessAnimation";
import StudentSearchSelect, { StudentOption } from "./StudentSearchSelect";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString, getLocalTimestampString } from "@/lib/dateUtils";

interface FeedbackFormProps {
  sessionId: string;
  instructorId: string;
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

// ─── Minimal Fallback Formatter & Analyzer ───────────────────────────────────

function cleanBasicLocal(text: string): string {
  const t = text.trim();
  if (!t) return "NA";

  let result = t.replace(/\s+/g, " ");
  result = result.charAt(0).toUpperCase() + result.slice(1);

  if (!/[.!?]$/.test(result)) {
    result += ".";
  }

  return result;
}

interface LocalAiResult {
  isValid: boolean;
  score: number;
  category: "appreciation" | "improvement" | "reject";
  rejectionReason: string | null;
  suggestion: string | null;
}

function analyzeLocally(
  text: string,
  uRating: number,
  iRating: number
): LocalAiResult {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const avgRating = (uRating + iRating) / 2;
  const cleaned = cleanBasicLocal(trimmed);

  return {
    isValid: words >= 4,
    score: Math.min(80, 50 + words * 2),
    category: avgRating >= 4 ? "appreciation" : "improvement",
    rejectionReason: words < 4
      ? "Please write a complete sentence about the session."
      : null,
    suggestion: cleaned,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

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

  const [aiResult, setAiResult] = useState<LocalAiResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [correctedFeedback, setCorrectedFeedback] = useState<string>("");
  const [analysedState, setAnalysedState] = useState<{
    description: string;
    uRating: number;
    iRating: number;
  } | null>(null);
  const [instructorSheetUrl, setInstructorSheetUrl] = useState<string | null>(null);
  const [adminSheetUrl, setAdminSheetUrl] = useState<string | null>(null);

  // Load roster
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

  // Fetch instructor's Google Sheet webhook URL
  useEffect(() => {
    if (!instructorId) return;
    supabase
      .from("instructor_profiles")
      .select("google_sheet_webhook_url")
      .eq("username", instructorId)
      .single()
      .then(({ data }) => {
        setInstructorSheetUrl(data?.google_sheet_webhook_url ?? null);
      });
  }, [instructorId]);

  // Fetch admin's global sheet webhook URL
  useEffect(() => {
    supabase
      .from("admin_config")
      .select("admin_sheet_webhook_url")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setAdminSheetUrl((data as { admin_sheet_webhook_url?: string | null })?.admin_sheet_webhook_url ?? null);
      });
  }, []);

  // Load subjects
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

  // Reset student when section changes
  useEffect(() => { setStudentId(""); }, [section]);

  const sections = [...new Set(roster.map((r) => r.section).filter(Boolean))];
  const studentsInSection: StudentOption[] = section
    ? roster.filter((r) => r.section === section).map((r) => ({ student_id: r.student_id, name: r.name }))
    : [];

  const ratingViolation = understandingRating > 0 && instructorRating > 0 && understandingRating > instructorRating;
  const bothFive = understandingRating === 5 && instructorRating === 5;

  // Description is optional ONLY if both ratings are 5. Otherwise, description is mandatory and requires AI validation.
  const requiresAnalysis = !bothFive && understandingRating > 0 && instructorRating > 0;

  const analysisUpToDate =
    aiResult !== null &&
    analysedState !== null &&
    analysedState.description === description.trim() &&
    analysedState.uRating === understandingRating &&
    analysedState.iRating === instructorRating &&
    aiResult.isValid;

  const canSubmit =
    !loading &&
    !aiLoading &&
    section.trim() !== "" &&
    studentId.trim() !== "" &&
    subjectId.trim() !== "" &&
    understandingRating > 0 &&
    instructorRating > 0 &&
    !ratingViolation &&
    (bothFive ? true : (description.trim().length > 0 && analysisUpToDate));

  // Reset analysis when inputs change
  const resetAnalysis = () => {
    setAiResult(null);
    setAnalysedState(null);
    setCorrectedFeedback("");
  };

  const runAnalysis = useCallback(async () => {
    const trimmedDesc = description.trim();
    if (!trimmedDesc || understandingRating === 0 || instructorRating === 0) return;
    setAiLoading(true);
    setError("");

    try {
      const { data, error } = await supabase.functions.invoke("validate-feedback", {
        body: {
          understanding_rating: understandingRating,
          instructor_rating: instructorRating,
          description: trimmedDesc,
        },
      });

      if (error || !data) {
        throw new Error(error?.message || "Function returned no data");
      }

      // Store the AI-corrected version of the feedback
      setCorrectedFeedback(data.corrected_feedback || trimmedDesc);

      setAiResult({
        isValid: data.is_valid,
        score: data.score,
        category: data.category as "appreciation" | "improvement" | "reject",
        rejectionReason: !data.is_valid ? "Feedback needs to be more clear or constructive." : null,
        suggestion: data.suggestion,
      });

      setAnalysedState({
        description: trimmedDesc,
        uRating: understandingRating,
        iRating: instructorRating,
      });
    } catch (e) {
      console.warn("Edge function failed, using local analysis fallback:", e);
      const result = analyzeLocally(description, understandingRating, instructorRating);
      setCorrectedFeedback(trimmedDesc); // Keep original if AI fails
      setAiResult(result);
      setAnalysedState({
        description: trimmedDesc,
        uRating: understandingRating,
        iRating: instructorRating,
      });
    } finally {
      setAiLoading(false);
    }
  }, [description, understandingRating, instructorRating]);

  // Debounce effect for automatic real-time AI suggestions
  useEffect(() => {
    const trimmedDesc = description.trim();

    // If analysis is not required or description is empty, reset and return
    if (!requiresAnalysis || !trimmedDesc) {
      setAiResult(null);
      setAnalysedState(null);
      setCorrectedFeedback("");
      setAiLoading(false);
      return;
    }

    // If current inputs already match the analysed state, do nothing
    if (
      analysedState &&
      analysedState.description === trimmedDesc &&
      analysedState.uRating === understandingRating &&
      analysedState.iRating === instructorRating
    ) {
      return;
    }

    // Set loading state to true immediately as user edits
    setAiLoading(true);

    const timer = setTimeout(() => {
      runAnalysis();
    }, 1000); // 1-second debounce to give fluid typing experience

    return () => clearTimeout(timer);
  }, [description, understandingRating, instructorRating, requiresAnalysis, analysedState, runAnalysis]);

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

    if (!bothFive && !description.trim()) {
      return setError("Please provide feedback. Description is mandatory for any rating below 5.");
    }

    if (requiresAnalysis && !analysisUpToDate) {
      return setError("Please wait for the AI feedback analysis to complete before submitting.");
    }

    if (aiResult && !aiResult.isValid) {
      return setError(aiResult.rejectionReason ?? "Please improve your feedback before submitting.");
    }

    const inRoster = roster.some((r) => r.student_id === trimmedId && r.section === trimmedSection);
    if (!inRoster) {
      return setError(`NIAT ID ${trimmedId} is not in section ${trimmedSection}. Pick from the dropdown.`);
    }

    setLoading(true);

    try {
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
        return setError("You have already submitted feedback for this subject within the last hour.");
      }

      const finalScore = aiResult?.score ?? 75;
      const today = getLocalDateString();
      const localTime = getLocalTimestampString();

      // Fix: final submitted feedback value is always the latest text from description
      const finalDescription = description.trim() || "NA";

      const { error: dbError } = await supabase.from("attendance_feedback").insert({
        student_id: trimmedId,
        session_id: sessionId,
        subject_id: subjectId,
        understanding_rating: understandingRating,
        instructor_rating: instructorRating,
        description: finalDescription,
        ai_corrected_description: correctedFeedback || (description.trim() ? cleanBasicLocal(description) : null),
        ai_score: finalScore,
        attendance_marked: true,
      });
      if (dbError) throw dbError;

      const { error: dailyError } = await supabase
        .from("daily_attendance")
        .upsert(
          {
            student_id: trimmedId,
            date: today,
            status: "Present",
            instructor_id: `${instructorId}_${subjectId}`,
            subject_id: subjectId,
          },
          { onConflict: "student_id, date, instructor_id" }
        );

      if (dailyError && dailyError.code !== "23505") {
        throw dailyError;
      }

      // 1. Instructor's own sheet — partial view (no student identity)
      if (instructorSheetUrl && instructorSheetUrl.trim()) {
        const instructorFormBody = new URLSearchParams({
          timestamp: localTime,
          understanding_rating: String(understandingRating),
          instructor_rating: String(instructorRating),
          description: finalDescription,
        });
        fetch(instructorSheetUrl.trim(), {
          method: "POST",
          mode: "no-cors",
          body: instructorFormBody,
        }).catch(e => console.error("Instructor fetch error:", e));
      }

      // 2. Admin's sheet — full view with student identity
      if (adminSheetUrl && adminSheetUrl.trim()) {
        const studentName = roster.find(r => r.student_id === trimmedId)?.name ?? "";
        const adminFormBody = new URLSearchParams({
          timestamp: localTime,
          student_id: trimmedId,
          student_name: studentName,
          section: trimmedSection,
          understanding_rating: String(understandingRating),
          instructor_rating: String(instructorRating),
          description: finalDescription,
          instructor_id: instructorId || "Unknown",
        });
        fetch(adminSheetUrl.trim(), {
          method: "POST",
          mode: "no-cors",
          body: adminFormBody,
        }).catch(e => console.error("Admin fetch error:", e));
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
        {/* Step 1 */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">Step 1 — Your Section</label>
          <Select value={section} onValueChange={(v) => { setSection(v); resetAnalysis(); }}>
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

        {/* Step 2 */}
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

        {/* Step 3 */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">Step 3 — Select Subject</label>
          <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); resetAnalysis(); }} disabled={subjectsLoading}>
            <SelectTrigger className="bg-secondary/50 border-border/60 text-base h-11">
              <SelectValue placeholder={subjectsLoading ? "Loading subjects..." : "Select a subject"} />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.subject_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Step 4 */}
        <StarRating
          value={instructorRating}
          onChange={(value) => { setInstructorRating(value); resetAnalysis(); }}
          label="Step 4 — Rate your instructor's teaching today"
        />

        {/* Step 5 */}
        <div className="space-y-1">
          <StarRating
            value={understandingRating}
            onChange={(value) => { setUnderstandingRating(value); resetAnalysis(); }}
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

        {/* Step 6 */}
        <div className="space-y-1.5">
          <label htmlFor="description" className="text-sm font-semibold text-foreground">
            Step 6 — Describe what could help you learn better
            {bothFive
              ? <span className="text-muted-foreground font-normal ml-1">(optional)</span>
              : <span className="text-destructive font-normal ml-1">(required — rating below 5)</span>}
          </label>
          <Textarea
            id="description"
            placeholder="Share what was unclear, what you'd like more of, or what helped you..."
            value={description}
            onChange={(e) => { setDescription(e.target.value); resetAnalysis(); }}
            rows={4}
            className="bg-secondary/50 border-border/60 focus:border-primary text-base resize-none"
          />
        </div>

        {/* Generic tip */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/50 border border-border/40">
          <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/70">Tip:</span>{" "}
            Be specific, respectful, and constructive. Focus on the session content, pace, or teaching style.
          </p>
        </div>

        {/* AI Result Panel */}
        <AnimatePresence mode="wait">
          {aiLoading ? (
            <motion.div
              key="ai-loading"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-2 flex items-center gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
            >
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">AI Feedback Assistant is analyzing...</p>
                <p className="text-[11px] text-muted-foreground">Checking spelling, grammar, clarity, and tone in real time</p>
              </div>
            </motion.div>
          ) : aiResult ? (
            <motion.div
              key="ai-result"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`p-4 rounded-lg border space-y-3 shadow-[0_4px_20px_rgba(0,0,0,0.05)] ${aiResult.isValid
                ? aiResult.category === "appreciation"
                  ? "bg-success/5 border-success/20"
                  : "bg-warning/5 border-warning/20"
                : "bg-destructive/5 border-destructive/20"
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {aiResult.isValid
                    ? <CheckCircle2 className="w-4 h-4 text-success" />
                    : <AlertCircle className="w-4 h-4 text-destructive" />}
                  <span className="text-sm font-semibold text-foreground">
                    AI Score: {aiResult.score}/100
                  </span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${aiResult.category === "appreciation" ? "bg-success/10 text-success" :
                  aiResult.category === "improvement" ? "bg-warning/10 text-warning" :
                    "bg-destructive/10 text-destructive"
                  }`}>
                  {aiResult.category === "needsWork" ? "Needs Work" : aiResult.category}
                </span>
              </div>

              {/* Rejection reason — generic, never echoes user's text */}
              {!aiResult.isValid && aiResult.rejectionReason && (
                <div className="text-xs text-destructive/90 bg-destructive/10 p-2.5 rounded border border-destructive/20 font-medium">
                  {aiResult.rejectionReason}
                </div>
              )}

              {/* Contextual AI suggestion — always shown so student can replace */}
              {aiResult.suggestion && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    AI Suggested Feedback:
                  </p>
                  <p className="text-sm text-foreground/80 bg-background/50 p-3 rounded-md italic border border-border/40">
                    {aiResult.suggestion}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const s = aiResult.suggestion!.trim();
                      setDescription(s);
                      setCorrectedFeedback(s);
                      setAnalysedState({
                        description: s,
                        uRating: understandingRating,
                        iRating: instructorRating,
                      });
                      setAiResult({
                        ...aiResult,
                        isValid: true,
                        score: Math.max(aiResult.score, 80),
                        suggestion: s,
                      });
                    }}
                    className="gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Use this suggestion
                  </Button>
                </div>
              )}

              {/* Success state */}
              {aiResult.isValid && (
                <p className="text-xs text-success font-medium flex items-center gap-1">
                  ✓ Your feedback looks good — you're ready to submit!
                </p>
              )}
            </motion.div>
          ) : null}
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
            <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Submitting...</span>
          ) : ("Submit Feedback & Mark Attendance")}
        </Button>
      </motion.form>
    </TooltipProvider>
  );
};

export default FeedbackForm;
