import { prisma } from "../../config/db";
import { ensureProgramSemesters } from "../academics/academics.helpers";
import {
  CreateBatchInput,
  CreateDepartmentInput,
  CreateProgramInput,
  CreateSectionInput,
  UpdateDepartmentInput,
} from "./departments.types";

export const departmentsRepository = {
  listDepartments() {
    return prisma.department.findMany({
      where: { deletedAt: null },
      include: {
        _count: { select: { programs: true, students: true, faculty: true } },
      },
      orderBy: { name: "asc" },
    });
  },

  getFullTree() {
    return prisma.department.findMany({
      where: { deletedAt: null },
      include: {
        programs: {
          include: {
            batches: {
              include: { sections: { orderBy: { name: "asc" } } },
              orderBy: { startYear: "desc" },
            },
            semesters: { orderBy: { number: "asc" } },
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });
  },

  createDepartment(data: CreateDepartmentInput) {
    return prisma.department.create({ data });
  },

  updateDepartment(id: string, data: UpdateDepartmentInput) {
    return prisma.department.update({ where: { id }, data });
  },

  softDeleteDepartment(id: string) {
    return prisma.department.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  findDepartment(id: string) {
    return prisma.department.findUnique({ where: { id } });
  },

  /** A program always comes with its semesters (two per year of duration). */
  createProgram(departmentId: string, data: CreateProgramInput) {
    return prisma.$transaction(async (tx) => {
      const program = await tx.program.create({ data: { ...data, departmentId } });
      await ensureProgramSemesters(tx, program.id, data.durationYears * 2);
      return program;
    });
  },

  /** Extending the duration adds semesters; shortening never removes ones already in use. */
  updateProgram(id: string, data: Partial<CreateProgramInput>) {
    return prisma.$transaction(async (tx) => {
      const program = await tx.program.update({ where: { id }, data });
      await ensureProgramSemesters(tx, program.id, program.durationYears * 2);
      return program;
    });
  },

  /**
   * Deleting a program first clears its semesters that nothing references. If a semester is
   * still used by subjects, enrollments or attendance, the program delete fails on the foreign
   * key and the service reports "still has records under it" - history is never orphaned.
   */
  deleteProgram(id: string) {
    return prisma.$transaction(async (tx) => {
      await tx.semester.deleteMany({
        where: {
          programId: id,
          subjects: { none: {} },
          enrollments: { none: {} },
          attendanceSessions: { none: {} },
        },
      });
      return tx.program.delete({ where: { id } });
    });
  },

  createBatch(programId: string, data: CreateBatchInput) {
    return prisma.batch.create({ data: { ...data, programId } });
  },

  updateBatch(id: string, data: Partial<CreateBatchInput>) {
    return prisma.batch.update({ where: { id }, data });
  },

  deleteBatch(id: string) {
    return prisma.batch.delete({ where: { id } });
  },

  createSection(batchId: string, data: CreateSectionInput) {
    return prisma.section.create({ data: { ...data, batchId } });
  },

  updateSection(id: string, data: Partial<CreateSectionInput>) {
    return prisma.section.update({ where: { id }, data });
  },

  deleteSection(id: string) {
    return prisma.section.delete({ where: { id } });
  },
};
