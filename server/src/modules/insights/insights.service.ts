import { ApiError } from "../../utils/ApiError";
import { askGemini } from "../../utils/gemini";
import { bucketsForStudent, getPolicy, totalsForStudent } from "../attendance/attendance.stats";
import { insightsRepository } from "./insights.repository";

export const insightsService = {
  async performanceBySubject(studentId: string) {
    const marks = await insightsRepository.marksForStudent(studentId);
    const bySubject = new Map<string, { total: number; count: number }>();

    for (const m of marks) {
      const pct = (Number(m.marksObtained) / m.exam.totalMarks) * 100;
      const key = m.exam.subject.name;
      const entry = bySubject.get(key) ?? { total: 0, count: 0 };
      entry.total += pct;
      entry.count += 1;
      bySubject.set(key, entry);
    }

    return [...bySubject.entries()].map(([subject, v]) => ({
      subject,
      averagePercentage: Math.round((v.total / v.count) * 10) / 10,
    }));
  },

  async careerTrend(studentId: string) {
    const marks = await insightsRepository.marksForStudent(studentId);
    return marks.map((m) => ({
      examTitle: m.exam.title,
      subject: m.exam.subject.name,
      date: m.exam.examDate,
      percentage: Math.round((Number(m.marksObtained) / m.exam.totalMarks) * 1000) / 10,
    }));
  },

  /** Monthly attendance %, weighted by classes and aggregated in SQL. */
  async attendanceTrend(studentId: string) {
    const policy = await getPolicy();
    const months = await bucketsForStudent(studentId, "month", {}, policy);
    return months.map((m) => ({ month: m.label, percentage: m.percentage }));
  },

  async generateTips(studentId: string): Promise<{ tips: string; aiPowered: boolean }> {
    const policy = await getPolicy();
    const [subjectPerf, attendanceTotals, student] = await Promise.all([
      this.performanceBySubject(studentId),
      totalsForStudent(studentId, {}, policy),
      insightsRepository.studentBasics(studentId),
    ]);

    if (!student) throw ApiError.notFound("Student not found");

    const weakSubjects = subjectPerf.filter((s) => s.averagePercentage < 60).map((s) => s.subject);
    const overallAttendance = attendanceTotals.conducted > 0 ? attendanceTotals.percentage : null;

    const summary = `Student in ${student.department.name}, semester ${student.currentSemester}.
Subject averages: ${subjectPerf.map((s) => `${s.subject}: ${s.averagePercentage}%`).join(", ") || "no published results yet"}.
Overall attendance: ${overallAttendance !== null ? `${overallAttendance}%` : "no attendance data yet"}.
Weak subjects (below 60%): ${weakSubjects.join(", ") || "none"}.`;

    const prompt = `You are an academic advisor. Based on this student's real performance data, give 3-4 short, specific, encouraging improvement tips (max 2 sentences each). Be concrete, not generic. Data:\n${summary}`;

    try {
      const tips = await askGemini(prompt);
      return { tips, aiPowered: true };
    } catch {
      // Graceful fallback when Gemini isn't configured or the call fails - still useful, just not AI-generated.
      const fallback = weakSubjects.length > 0
        ? `Focus extra study time on ${weakSubjects.join(", ")} — consider forming a study group or asking your faculty for extra practice problems. ${
            overallAttendance !== null && overallAttendance < 75
              ? "Your attendance is below 75%, which puts you at risk of exam ineligibility — prioritize showing up to class."
              : ""
          }`.trim()
        : "Your performance across subjects looks solid — keep up consistent attendance and review sessions before each exam.";
      return { tips: fallback, aiPowered: false };
    }
  },
};
