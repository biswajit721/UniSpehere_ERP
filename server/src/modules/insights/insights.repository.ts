import { prisma } from "../../config/db";

export const insightsRepository = {
  marksForStudent(studentId: string) {
    return prisma.marks.findMany({
      where: { studentId, exam: { status: "PUBLISHED" } },
      include: { exam: { include: { subject: true } } },
      orderBy: { exam: { examDate: "asc" } },
    });
  },

  studentBasics(studentId: string) {
    return prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true, department: true },
    });
  },

  departmentAverages(departmentId: string) {
    return prisma.marks.findMany({
      where: { student: { departmentId }, exam: { status: "PUBLISHED" } },
      include: { exam: true },
    });
  },
};
