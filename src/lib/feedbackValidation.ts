const GENERIC_RESPONSES = [
  "na", "ok", "good", "nice", "great", "fine", "none", "all good",
  "okay", "nothing", "no", "yes", "cool", "awesome", "perfect",
];

const POSITIVE_PHRASES = [
  "great", "excellent", "amazing", "wonderful", "fantastic", "awesome",
  "very good", "really good", "loved it", "perfect", "best", "superb",
  "outstanding", "brilliant", "well done", "clear", "easy to understand",
  "enjoyed", "helpful", "informative",
];

const NEGATIVE_PHRASES = [
  "did not understand", "didn't understand", "too fast", "confusing",
  "confused", "boring", "bad", "worst", "terrible", "poor", "unclear",
  "not clear", "audio issue", "video issue", "waste", "not helpful",
  "couldn't follow", "could not follow", "difficult", "hard to follow",
  "not good", "disappointing", "slow", "rushed",
];

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function detectSentiment(text: string): "positive" | "negative" | "neutral" {
  const lower = text.toLowerCase();
  let positiveScore = 0;
  let negativeScore = 0;

  for (const phrase of POSITIVE_PHRASES) {
    if (lower.includes(phrase)) positiveScore++;
  }
  for (const phrase of NEGATIVE_PHRASES) {
    if (lower.includes(phrase)) negativeScore++;
  }

  if (positiveScore > negativeScore && positiveScore > 0) return "positive";
  if (negativeScore > positiveScore && negativeScore > 0) return "negative";
  return "neutral";
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFeedback(
  understandingRating: number,
  instructorRating: number,
  description: string
): ValidationResult {
  const trimmed = description.trim();
  const bothFive = understandingRating === 5 && instructorRating === 5;

  // If both ratings are 5, description is optional
  if (bothFive && (!trimmed || trimmed.toLowerCase() === "na")) {
    return { valid: true };
  }

  // If any rating < 5, description is required
  if ((understandingRating < 5 || instructorRating < 5) && !trimmed) {
    return { valid: false, error: "Description required for ratings below 5." };
  }

  // If description provided, validate it
  if (trimmed && trimmed.toLowerCase() !== "na") {
    // Check generic responses
    if (GENERIC_RESPONSES.includes(trimmed.toLowerCase())) {
      return { valid: false, error: "Please provide constructive feedback." };
    }

    // Check word count
    if (countWords(trimmed) < 10) {
      return { valid: false, error: "Please write at least 10 words of constructive feedback." };
    }

    // Sentiment-rating consistency
    const sentiment = detectSentiment(trimmed);
    const avgRating = (understandingRating + instructorRating) / 2;

    // Low rating but positive description
    if (avgRating <= 3 && sentiment === "positive") {
      return {
        valid: false,
        error: "Your rating and description do not match. Please provide fair feedback.",
      };
    }

    // High rating but negative description
    if (avgRating >= 4 && sentiment === "negative") {
      return {
        valid: false,
        error: "Your description suggests issues but rating is high. Please adjust rating or description.",
      };
    }
  }

  return { valid: true };
}

// Local storage helpers for duplicate prevention
const STORAGE_KEY = "feedback_submissions";

interface Submission {
  studentId: string;
  sessionId: string;
  timestamp: string;
}

function getSubmissions(): Submission[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function hasAlreadySubmitted(studentId: string, sessionId: string): boolean {
  return getSubmissions().some(
    (s) => s.studentId === studentId.toUpperCase().trim() && s.sessionId === sessionId
  );
}

export function recordSubmission(studentId: string, sessionId: string): void {
  const submissions = getSubmissions();
  submissions.push({
    studentId: studentId.toUpperCase().trim(),
    sessionId,
    timestamp: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
}

export interface FeedbackData {
  timestamp: string;
  student_id: string;
  session_id: string;
  understanding_rating: number;
  instructor_rating: number;
  description: string;
  attendance_marked: boolean;
}
