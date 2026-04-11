import { FeedbackData } from "./feedbackValidation";

const FEEDBACK_KEY = "feedback_data";

export interface StoredFeedback extends FeedbackData {
  id: string;
}

export function getAllFeedback(): StoredFeedback[] {
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveFeedback(data: FeedbackData): StoredFeedback {
  const feedbacks = getAllFeedback();
  const entry: StoredFeedback = { ...data, id: crypto.randomUUID() };
  feedbacks.push(entry);
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedbacks));
  return entry;
}

export function getFeedbackByInstructor(instructor: string): StoredFeedback[] {
  return getAllFeedback().filter(
    (f) => f.session_id.startsWith(instructor.toLowerCase())
  );
}

export interface StudentStreak {
  student_id: string;
  totalSessions: number;
  currentStreak: number;
  dates: string[];
}

export function getStudentStreaks(instructor: string): StudentStreak[] {
  const feedbacks = getAllFeedback().filter((f) =>
    f.session_id.startsWith(instructor.toLowerCase())
  );

  const studentMap = new Map<string, Set<string>>();

  for (const fb of feedbacks) {
    if (!fb.attendance_marked) continue;
    const dateStr = fb.session_id.split("_").slice(1).join("_"); // extract date part
    if (!studentMap.has(fb.student_id)) {
      studentMap.set(fb.student_id, new Set());
    }
    studentMap.get(fb.student_id)!.add(dateStr);
  }

  const allDates = [
    ...new Set(feedbacks.map((f) => f.session_id.split("_").slice(1).join("_"))),
  ].sort();

  const streaks: StudentStreak[] = [];

  for (const [studentId, dates] of studentMap) {
    const sortedDates = [...dates].sort();
    let currentStreak = 0;

    // Count streak from end of allDates
    for (let i = allDates.length - 1; i >= 0; i--) {
      if (dates.has(allDates[i])) {
        currentStreak++;
      } else {
        break;
      }
    }

    streaks.push({
      student_id: studentId,
      totalSessions: sortedDates.length,
      currentStreak,
      dates: sortedDates,
    });
  }

  return streaks.sort((a, b) => b.currentStreak - a.currentStreak);
}

export function exportToExcel(instructor: string): void {
  import("xlsx").then((XLSX) => {
    const feedbacks = getAllFeedback().filter((f) =>
      f.session_id.startsWith(instructor.toLowerCase())
    );

    // Feedback sheet
    const feedbackRows = feedbacks.map((f) => ({
      Timestamp: f.timestamp,
      "Student ID": f.student_id,
      "Session ID": f.session_id,
      "Understanding Rating": f.understanding_rating,
      "Instructor Rating": f.instructor_rating,
      Description: f.description,
      "Attendance Marked": f.attendance_marked ? "Yes" : "No",
    }));

    // Streaks sheet
    const streaks = getStudentStreaks(instructor);
    const streakRows = streaks.map((s) => ({
      "Student ID": s.student_id,
      "Total Sessions": s.totalSessions,
      "Current Streak": s.currentStreak,
      "Dates Attended": s.dates.join(", "),
    }));

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(feedbackRows);
    const ws2 = XLSX.utils.json_to_sheet(streakRows);

    // Auto-width columns
    const setColWidths = (ws: any, data: Record<string, any>[]) => {
      if (!data.length) return;
      const keys = Object.keys(data[0]);
      ws["!cols"] = keys.map((k) => ({
        wch: Math.max(k.length, ...data.map((r) => String(r[k] || "").length)) + 2,
      }));
    };

    setColWidths(ws1, feedbackRows);
    setColWidths(ws2, streakRows);

    XLSX.utils.book_append_sheet(wb, ws1, "Feedback");
    XLSX.utils.book_append_sheet(wb, ws2, "Attendance Streaks");
    XLSX.writeFile(wb, `${instructor}_feedback_report.xlsx`);
  });
}
