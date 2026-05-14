import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, Info, CheckCircle2, Plus, X } from "lucide-react";
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

// ─── Improvement Categories ───────────────────────────────────────────────────

interface CategoryDef {
  category: string;
  areasOfImprovement: string[];
  proposedSolutions: string[];
}

const CATEGORIES: CategoryDef[] = [
  {
    category: "Pace",
    areasOfImprovement: ["Concept Explanation", "Coding / Implementation", "Problem Solving"],
    proposedSolutions: ["Slower", "Faster"],
  },
  {
    category: "Concept Clarity",
    areasOfImprovement: ["Topic Explanation", "Step-by-step Breakdown", "Problem Understanding"],
    proposedSolutions: ["Simpler explanation", "Better breakdown", "More detailed explanation"],
  },
  {
    category: "Examples & Practice",
    areasOfImprovement: ["Examples", "Coding Practice", "Problem Solving Practice"],
    proposedSolutions: ["More examples", "More practice problems", "More implementation practice"],
  },
  {
    category: "Doubt Solving & Engagement",
    areasOfImprovement: ["Doubt Clarification", "Session Engagement"],
    proposedSolutions: ["More doubt-solving time", "More interactive discussion"],
  },
  {
    category: "Communication",
    areasOfImprovement: ["Voice Clarity", "Language Simplicity", "Audio Quality"],
    proposedSolutions: ["Clearer communication", "Simpler language", "Better audio quality"],
  },
];

interface ImprovementEntry {
  id: string;
  category: string;
  areaOfImprovement: string;
  proposedSolution: string;
}

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Readable feedback sentence builder ──────────────────────────────────────

function buildReadableFeedback(
  improvements: ImprovementEntry[]
): string {
  const sentences = improvements.map(({ category, areaOfImprovement, proposedSolution }) => {
    switch (category) {
      case "Pace":
        return `The pace during ${areaOfImprovement.toLowerCase()} should be ${proposedSolution.toLowerCase()}.`;
      case "Concept Clarity":
        return `${proposedSolution} is needed for ${areaOfImprovement.toLowerCase()}.`;
      case "Examples & Practice":
        return `${proposedSolution} would help with ${areaOfImprovement.toLowerCase()}.`;
      case "Doubt Solving & Engagement":
        return `${proposedSolution} would improve ${areaOfImprovement.toLowerCase()}.`;
      case "Communication":
        return `${proposedSolution} is needed to improve ${areaOfImprovement.toLowerCase()}.`;
      default:
        return `${category} (${areaOfImprovement}): ${proposedSolution}.`;
    }
  });

  return sentences.length > 0 ? sentences.join(" ") : "NA";
}

function getRequiredCount(lowestRating: number): number {
  if (lowestRating >= 5) return 0;
  if (lowestRating === 4) return 1;
  if (lowestRating === 3) return 2;
  if (lowestRating === 2) return 3;
  return 5; // rating 1 → all
}

// ─── Improvement Card ─────────────────────────────────────────────────────────

function ImprovementCard({
  entry, index, locked, onRemove, onChange,
}: {
  entry: ImprovementEntry;
  index: number;
  locked: boolean;
  onRemove: (id: string) => void;
  onChange: (id: string, field: "areaOfImprovement" | "proposedSolution", value: string) => void;
}) {
  const cat = CATEGORIES.find((c) => c.category === entry.category)!;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-border/60 bg-secondary/30 p-3 space-y-2.5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <span className="text-sm font-semibold text-foreground">{entry.category}</span>
        </div>
        {!locked && (
          <button type="button" onClick={() => onRemove(entry.id)}
            className="text-muted-foreground hover:text-destructive transition-colors" aria-label="Remove">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Area of Improvement</label>
        <Select value={entry.areaOfImprovement}
          onValueChange={(v) => onChange(entry.id, "areaOfImprovement", v)}>
          <SelectTrigger className="bg-background/60 border-border/60 h-9 text-sm">
            <SelectValue placeholder="Select area..." />
          </SelectTrigger>
          <SelectContent>
            {cat.areasOfImprovement.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AnimatePresence>
        {entry.areaOfImprovement && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="space-y-1 overflow-hidden">
            <label className="text-xs font-medium text-muted-foreground">Proposed Solution</label>
            <Select value={entry.proposedSolution}
              onValueChange={(v) => onChange(entry.id, "proposedSolution", v)}>
              <SelectTrigger className="bg-background/60 border-border/60 h-9 text-sm">
                <SelectValue placeholder="Select solution..." />
              </SelectTrigger>
              <SelectContent>
                {cat.proposedSolutions.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>
        )}
      </AnimatePresence>

      {entry.areaOfImprovement && entry.proposedSolution && (
        <div className="flex items-center gap-1.5 text-xs text-success font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />Complete
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

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
  const [improvements, setImprovements] = useState<ImprovementEntry[]>([]);
  const [additionalComment, setAdditionalComment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
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

  useEffect(() => {
    if (!instructorId) return;
    supabase.from("instructor_profiles").select("google_sheet_webhook_url")
      .eq("username", instructorId).single()
      .then(({ data }) => setInstructorSheetUrl(data?.google_sheet_webhook_url ?? null));
  }, [instructorId]);

  useEffect(() => {
    supabase.from("admin_config").select("admin_sheet_webhook_url").limit(1).maybeSingle()
      .then(({ data }) =>
        setAdminSheetUrl((data as { admin_sheet_webhook_url?: string | null })?.admin_sheet_webhook_url ?? null)
      );
  }, []);

  useEffect(() => {
    (async () => {
      setSubjectsLoading(true);
      const { data } = await supabase.from("subjects").select("id, subject_name")
        .order("subject_name", { ascending: true });
      setSubjects((data ?? []) as Subject[]);
      setSubjectsLoading(false);
    })();
  }, []);

  useEffect(() => { setStudentId(""); }, [section]);

  // When ratings change, reset/auto-populate improvements
  useEffect(() => {
    if (instructorRating === 0 || understandingRating === 0) return;
    const lowest = Math.min(instructorRating, understandingRating);
    if (lowest === 5) {
      setImprovements([]);
    } else if (lowest === 1) {
      setImprovements(CATEGORIES.map((cat) => ({
        id: makeId(), category: cat.category, areaOfImprovement: "", proposedSolution: "",
      })));
    } else {
      // On rating change, trim excess but don't auto-add
      const req = getRequiredCount(lowest);
      setImprovements((prev) => prev.length > req ? prev.slice(0, req) : prev);
    }
  }, [instructorRating, understandingRating]);

  const sections = [...new Set(roster.map((r) => r.section).filter(Boolean))];
  const studentsInSection: StudentOption[] = section
    ? roster.filter((r) => r.section === section).map((r) => ({ student_id: r.student_id, name: r.name }))
    : [];

  const ratingViolation = understandingRating > 0 && instructorRating > 0 && understandingRating > instructorRating;
  const bothFive = understandingRating === 5 && instructorRating === 5;
  const lowestRating = instructorRating > 0 && understandingRating > 0
    ? Math.min(instructorRating, understandingRating) : 0;
  const requiredCount = getRequiredCount(lowestRating);
  const needsCategories = lowestRating > 0 && !bothFive;
  const isRating1 = lowestRating === 1;
  const usedCategories = improvements.map((i) => i.category);
  const availableCategories = CATEGORIES.filter((c) => !usedCategories.includes(c.category));
  const allImprovementsComplete = improvements.every(
    (i) => i.areaOfImprovement.trim() !== "" && i.proposedSolution.trim() !== ""
  );
  const hasEnoughCategories = improvements.length >= requiredCount;

  const canSubmit =
    !loading &&
    section.trim() !== "" &&
    studentId.trim() !== "" &&
    subjectId.trim() !== "" &&
    understandingRating > 0 &&
    instructorRating > 0 &&
    !ratingViolation &&
    (bothFive || (hasEnoughCategories && allImprovementsComplete));

  const handleAddCategory = (categoryName: string) => {
    setImprovements((prev) => [
      ...prev,
      { id: makeId(), category: categoryName, areaOfImprovement: "", proposedSolution: "" },
    ]);
  };

  const handleRemoveCategory = (id: string) => {
    setImprovements((prev) => prev.filter((i) => i.id !== id));
  };

  const handleImprovementChange = (
    id: string, field: "areaOfImprovement" | "proposedSolution", value: string
  ) => {
    setImprovements((prev) => prev.map((i) => {
      if (i.id !== id) return i;
      if (field === "areaOfImprovement") return { ...i, areaOfImprovement: value, proposedSolution: "" };
      return { ...i, [field]: value };
    }));
  };

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

    if (needsCategories) {
      if (improvements.length < requiredCount) {
        return setError(`Please select at least ${requiredCount} improvement ${requiredCount === 1 ? "category" : "categories"} for this rating.`);
      }
      if (!allImprovementsComplete) {
        return setError("Please complete all dropdown selections for every improvement category.");
      }
    }

    const inRoster = roster.some((r) => r.student_id === trimmedId && r.section === trimmedSection);
    if (!inRoster) {
      return setError(`NIAT ID ${trimmedId} is not in section ${trimmedSection}. Pick from the dropdown.`);
    }

    setLoading(true);
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentFeedback, error: checkError } = await supabase
        .from("attendance_feedback").select("id")
        .eq("student_id", trimmedId).eq("subject_id", subjectId)
        .gt("created_at", oneHourAgo).limit(1);

      if (checkError) throw checkError;
      if (recentFeedback && recentFeedback.length > 0) {
        return setError("You have already submitted feedback for this subject within the last hour.");
      }

      const today = getLocalDateString();
      const localTime = getLocalTimestampString();

      // Build the consolidated human-readable feedback string for Google Sheets
      // Feedback column: only structured improvement sentences
      const readableFeedback = buildReadableFeedback(improvements);
      // Additional Remarks column: only the optional textarea input
      const additionalRemarks = additionalComment.trim() || "NA";

      const structuredFeedback = {
        instructorRating,
        understandingRating,
        improvements: improvements.map(({ category, areaOfImprovement, proposedSolution }) => ({
          category, areaOfImprovement, proposedSolution,
        })),
        additionalComment: additionalComment.trim(),
      };

      const { error: dbError } = await supabase.from("attendance_feedback").insert({
        student_id: trimmedId,
        session_id: sessionId,
        subject_id: subjectId,
        understanding_rating: understandingRating,
        instructor_rating: instructorRating,
        description: JSON.stringify(structuredFeedback),
        ai_corrected_description: null,
        ai_score: null,
        attendance_marked: true,
      });
      if (dbError) throw dbError;

      const { error: dailyError } = await supabase.from("daily_attendance").upsert(
        { student_id: trimmedId, date: today, status: "Present", instructor_id: `${instructorId}_${subjectId}`, subject_id: subjectId },
        { onConflict: "student_id, date, instructor_id" }
      );
      if (dailyError && dailyError.code !== "23505") throw dailyError;

      if (instructorSheetUrl?.trim()) {
        fetch(instructorSheetUrl.trim(), {
          method: "POST", mode: "no-cors",
          body: new URLSearchParams({
            timestamp: localTime,
            understanding_rating: String(understandingRating),
            instructor_rating: String(instructorRating),
            description: readableFeedback,
            additional_remarks: additionalRemarks,
          }),
        }).catch(console.error);
      }

      if (adminSheetUrl?.trim()) {
        const studentName = roster.find((r) => r.student_id === trimmedId)?.name ?? "";
        fetch(adminSheetUrl.trim(), {
          method: "POST", mode: "no-cors",
          body: new URLSearchParams({
            timestamp: localTime,
            student_id: trimmedId,
            student_name: studentName,
            section: trimmedSection,
            understanding_rating: String(understandingRating),
            instructor_rating: String(instructorRating),
            description: readableFeedback,
            additional_remarks: additionalRemarks,
            instructor_id: instructorId || "Unknown",
          }),
        }).catch(console.error);
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
          <Select value={section} onValueChange={(v) => { setSection(v); setError(""); }}>
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
          <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setError(""); }} disabled={subjectsLoading}>
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
          onChange={(value) => { setInstructorRating(value); setError(""); }}
          label="Step 4 — Rate your instructor's teaching today"
        />

        {/* Step 5 */}
        <div className="space-y-1">
          <StarRating
            value={understandingRating}
            onChange={(value) => { setUnderstandingRating(value); setError(""); }}
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

        {/* Step 6 — Structured Feedback */}
        <AnimatePresence>
          {(instructorRating > 0 && understandingRating > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <label className="text-sm font-semibold text-foreground">
                  Step 6 — Feedback
                </label>
                {bothFive ? (
                  <p className="text-xs text-success font-medium">
                    ✓ Both ratings are 5 — you can submit directly. Comments are optional.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {lowestRating === 1
                      ? "1-star rating: All 5 improvement categories are required."
                      : `Please select at least ${requiredCount} improvement ${requiredCount === 1 ? "category" : "categories"}.`}
                  </p>
                )}
              </div>

              {/* Category Cards */}
              {needsCategories && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Improvement Categories</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      hasEnoughCategories ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                    }`}>
                      {improvements.length}/{requiredCount} required
                    </span>
                  </div>

                  <AnimatePresence mode="popLayout">
                    {improvements.map((entry, idx) => (
                      <ImprovementCard
                        key={entry.id}
                        entry={entry}
                        index={idx}
                        locked={isRating1}
                        onRemove={handleRemoveCategory}
                        onChange={handleImprovementChange}
                      />
                    ))}
                  </AnimatePresence>

                  {/* Add category chips */}
                  {!isRating1 && availableCategories.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Add category:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {availableCategories.map((cat) => (
                          <button
                            key={cat.category}
                            type="button"
                            onClick={() => handleAddCategory(cat.category)}
                            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border border-border/60 bg-secondary/40 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all"
                          >
                            <Plus className="w-3 h-3" />{cat.category}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasEnoughCategories && allImprovementsComplete && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2 text-xs text-success font-medium p-2.5 rounded-lg bg-success/5 border border-success/20"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      All required categories completed!
                    </motion.div>
                  )}
                </div>
              )}

              {/* Optional textarea — always at bottom of Step 6 */}
              <div className="space-y-1.5">
                <label htmlFor="additional-comment" className="text-xs font-medium text-muted-foreground">
                  Additional comments <span className="font-normal">(optional)</span>
                </label>
                <Textarea
                  id="additional-comment"
                  placeholder="Additional comments (optional)"
                  value={additionalComment}
                  onChange={(e) => setAdditionalComment(e.target.value)}
                  rows={3}
                  className="bg-secondary/50 border-border/60 focus:border-primary text-base resize-none"
                />
              </div>
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
              <Loader2 className="w-4 h-4 animate-spin" />Submitting...
            </span>
          ) : ("Submit Feedback & Mark Attendance")}
        </Button>
      </motion.form>
    </TooltipProvider>
  );
};

export default FeedbackForm;
