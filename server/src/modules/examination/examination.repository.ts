import { prisma } from "../../config/db";

export const examinationRepository = {
  list(subjectId?: string) {
    return prisma.exam.findMany({
      where: { ...(subjectId && { subjectId }) },
      include: { subject: true, marks: true },
      orderBy: { examDate: "desc" },
    });
  },

  findById(id: string) {
    return prisma.exam.findUnique({
      where: { id },
      include: { subject: true, marks: { include: { student: { include: { user: true } } } } },
    });
  },

  create(data: {
    title: string;
    subjectId: string;
    examType: "INTERNAL" | "EXTERNAL" | "PRACTICAL";
    examDate: Date;
    totalMarks: number;
  }) {
    return prisma.exam.create({ data, include: { subject: true } });
  },

  publish(id: string) {
    return prisma.exam.update({ where: { id }, data: { status: "PUBLISHED" } });
  },

  upsertMarks(
    examId: string,
    enteredById: string,
    records: { studentId: string; marksObtained: number }[]
  ) {
    return prisma.$transaction(
      records.map((r) =>
        prisma.marks.upsert({
          where: { examId_studentId: { examId, studentId: r.studentId } },
          update: { marksObtained: r.marksObtained, enteredById },
          create: { examId, studentId: r.studentId, marksObtained: r.marksObtained, enteredById },
        })
      )
    );
  },

  findFacultyByUserId(userId: string) {
    return prisma.faculty.findUnique({ where: { userId } });
  },

  studentMarksAcrossExams(studentId: string) {
    return prisma.marks.findMany({
      where: { studentId },
      include: { exam: { include: { subject: true } } },
    });
  },
};
