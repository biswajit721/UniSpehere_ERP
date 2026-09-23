import { Prisma } from "@prisma/client";
import { ApiError } from "../../utils/ApiError";
import { departmentsRepository } from "./departments.repository";
import {
  CreateBatchInput,
  CreateDepartmentInput,
  CreateProgramInput,
  CreateSectionInput,
  UpdateDepartmentInput,
} from "./departments.types";

/** Translates Prisma's generic FK/not-found errors into messages that make
 *  sense for this hierarchy, e.g. "delete blocked because students exist"
 *  rather than a raw constraint name. */
async function runOrTranslate<T>(fn: () => Promise<T>, entityLabel: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        throw ApiError.notFound(`${entityLabel} not found`);
      }
      if (err.code === "P2003" || err.code === "P2014") {
        throw ApiError.conflict(
          `Cannot delete this ${entityLabel.toLowerCase()} while it still has records under it (students, faculty, programs, batches, or sections). Remove those first.`
        );
      }
    }
    throw err;
  }
}

export const departmentsService = {
  listDepartments() {
    return departmentsRepository.listDepartments();
  },

  getFullTree() {
    return departmentsRepository.getFullTree();
  },

  createDepartment(data: CreateDepartmentInput) {
    return departmentsRepository.createDepartment(data);
  },

  updateDepartment(id: string, data: UpdateDepartmentInput) {
    return runOrTranslate(() => departmentsRepository.updateDepartment(id, data), "Department");
  },

  deleteDepartment(id: string) {
    return runOrTranslate(() => departmentsRepository.softDeleteDepartment(id), "Department");
  },

  async createProgram(departmentId: string, data: CreateProgramInput) {
    const department = await departmentsRepository.findDepartment(departmentId);
    if (!department || department.deletedAt) throw ApiError.notFound("Department not found");
    return departmentsRepository.createProgram(departmentId, data);
  },

  updateProgram(id: string, data: Partial<CreateProgramInput>) {
    return runOrTranslate(() => departmentsRepository.updateProgram(id, data), "Program");
  },

  deleteProgram(id: string) {
    return runOrTranslate(() => departmentsRepository.deleteProgram(id), "Program");
  },

  createBatch(programId: string, data: CreateBatchInput) {
    return departmentsRepository.createBatch(programId, data);
  },

  updateBatch(id: string, data: Partial<CreateBatchInput>) {
    return runOrTranslate(() => departmentsRepository.updateBatch(id, data), "Batch");
  },

  deleteBatch(id: string) {
    return runOrTranslate(() => departmentsRepository.deleteBatch(id), "Batch");
  },

  createSection(batchId: string, data: CreateSectionInput) {
    return departmentsRepository.createSection(batchId, data);
  },

  updateSection(id: string, data: Partial<CreateSectionInput>) {
    return runOrTranslate(() => departmentsRepository.updateSection(id, data), "Section");
  },

  deleteSection(id: string) {
    return runOrTranslate(() => departmentsRepository.deleteSection(id), "Section");
  },
};
