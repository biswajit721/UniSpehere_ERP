import { ApiError } from "../../utils/ApiError";
import { ListStudentsQuery } from "./students.validation";
import { StudentRow, studentsRepository } from "./students.repository";
import { StudentListItem, UpdateStudentInput } from "./students.types";

function toListItem(s: StudentRow): StudentListItem {
  const enrollment = s.enrollments[0] ?? null;
  return {
    id: s.id,
    userId: s.userId,
    rollNumber: s.rollNumber,
    registrationNumber: s.registrationNumber,
    fullName: `${s.user.firstName} ${s.user.lastName}`,
    email: s.user.email,
    universityId: s.user.universityId,
    isActive: s.user.isActive,
    department: s.department.name,
    departmentId: s.departmentId,
    program: s.program.name,
    programId: s.programId,
    batch: s.batch.label,
    batchId: s.batchId,
    section: s.section?.name ?? null,
    sectionId: s.sectionId ?? null,
    currentSemester: s.currentSemester,
    cgpa: s.cgpa ? Number(s.cgpa) : null,
    admissionYear: s.admissionYear,
    guardianName: s.guardianName,
    guardianPhone: s.guardianPhone,
    guardianRelation: s.guardianRelation,
    currentEnrollment: enrollment
      ? {
          id: enrollment.id,
          academicSessionId: enrollment.academicSessionId,
          academicSession: enrollment.academicSession.label,
          semesterId: enrollment.semesterId,
          semester: enrollment.semester.name,
          status: enrollment.status,
          enrollmentType: enrollment.enrollmentType,
        }
      : null,
  };
}

export const studentsService = {
  async list(params: ListStudentsQuery) {
    const { page, pageSize, ...filters } = params;
    const skip = (page - 1) * pageSize;
    const [rows, total] = await Promise.all([
      studentsRepository.list({ ...filters, skip, take: pageSize }),
      studentsRepository.count(filters),
    ]);
    return { data: rows.map(toListItem), total, page, pageSize };
  },

  async getById(id: string) {
    const s = await studentsRepository.findById(id);
    if (!s) throw ApiError.notFound("Student not found");
    return toListItem(s);
  },

  async getByUserId(userId: string) {
    const s = await studentsRepository.findByUserId(userId);
    if (!s) throw ApiError.notFound("No student profile linked to this account");
    return toListItem(s);
  },

  async update(id: string, data: UpdateStudentInput & { currentSemester?: unknown; sectionId?: unknown }) {
    if (data.currentSemester !== undefined || data.sectionId !== undefined) {
      throw ApiError.badRequest(
        "Semester and section can't be edited directly because that would overwrite the student's academic history. " +
          "Use Promote, Readmit / Repeat, or Change section from the student's academic record."
      );
    }
    const existing = await studentsRepository.findById(id);
    if (!existing) throw ApiError.notFound("Student not found");
    const s = await studentsRepository.update(id, data);
    return toListItem(s);
  },

  async setActive(id: string, isActive: boolean) {
    const s = await studentsRepository.findById(id);
    if (!s) throw ApiError.notFound("Student not found");
    await studentsRepository.setUserActive(s.userId, isActive);
    return this.getById(id);
  },
};
