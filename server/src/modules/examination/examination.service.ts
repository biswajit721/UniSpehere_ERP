import { ApiError } from "../../utils/ApiError";
import { examinationRepository } from "./examination.repository";

function gradeForPercentage(pct: number): { grade: string; points: number } {
  if (pct >= 90) return { grade: "O", points: 10 };
  if (pct >= 80) return { grade: "A+", points: 9 };
  if (pct >= 70) return { grade: "A", points: 8 };
  if (pct >= 60) return { grade: "B+", points: 7 };
  if (pct >= 50) return { grade: "B", points: 6 };
  if (pct >= 40) return { grade: "C", points: 5 };
  return { grade: "F", points: 0 };
}

function examDto(e: any) {
  return {
    id: e.id,
    title: e.title,
    subject: e.subject.name,
    subjectId: e.subjectId,
    examType: e.examType,
    examDate: e.examDate,
    totalMarks: e.totalMarks,
    status: e.status,
    marksEntered: e.marks?.length ?? 0,
  };
}

export const examinationService = {
  async list(subjectId?: string) {
    const rows = await examinationRepository.list(subjectId);
    return rows.map(examDto);
  },

  async create(input: {
    title: string;
    subjectId: string;
    examType: "INTERNAL" | "EXTERNAL" | "PRACTICAL";
    examDate: string;
    totalMarks: number;
  }) {
    const exam = await examinationRepository.create({
      ...input,
      examDate: new Date(input.examDate),
    });
    return examDto({ ...exam, marks: [] });
  },

  async getDetail(id: string) {
    const exam = await examinationRepository.findById(id);
    if (!exam) throw ApiError.notFound("Exam not found");
    return {
      ...examDto(exam),
      marks: exam.marks.map((m) => ({
        studentId: m.studentId,
        rollNumber: m.student.rollNumber,
        fullName: `${m.student.user.firstName} ${m.student.user.lastName}`,
        marksObtained: Number(m.marksObtained),
        percentage: Math.round((Number(m.marksObtained) / exam.totalMarks) * 1000) / 10,
        ...gradeForPercentage((Number(m.marksObtained) / exam.totalMarks) * 100),
      })),
    };
  },

  async enterMarks(
    userId: string,
    examId: string,
    records: { studentId: string; marksObtained: number }[]
  ) {
    const faculty = await examinationRepository.findFacultyByUserId(userId);
    if (!faculty) throw ApiError.forbidden("Only a faculty account can enter marks");
    await examinationRepository.upsertMarks(examId, faculty.id, records);
    return { saved: records.length };
  },

  async publish(id: string) {
    const exam = await examinationRepository.publish(id);
    return examDto({ ...exam, subject: { name: "" }, marks: [] });
  },

  async studentResults(studentId: string) {
    const rows = await examinationRepository.studentMarksAcrossExams(studentId);
    return rows
      .filter((m) => m.exam.status === "PUBLISHED")
      .map((m) => {
        const pct = (Number(m.marksObtained) / m.exam.totalMarks) * 100;
        return {
          subject: m.exam.subject.name,
          examTitle: m.exam.title,
          examType: m.exam.examType,
          marksObtained: Number(m.marksObtained),
          totalMarks: m.exam.totalMarks,
          percentage: Math.round(pct * 10) / 10,
          ...gradeForPercentage(pct),
        };
      });
  },
};
