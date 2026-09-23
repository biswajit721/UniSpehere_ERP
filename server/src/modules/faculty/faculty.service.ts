import { ApiError } from "../../utils/ApiError";
import { facultyRepository } from "./faculty.repository";
import { FacultyListItem, UpdateFacultyInput } from "./faculty.types";

function toListItem(f: any): FacultyListItem {
  return {
    id: f.id,
    userId: f.userId,
    employeeId: f.employeeId,
    fullName: `${f.user.firstName} ${f.user.lastName}`,
    email: f.user.email,
    universityId: f.user.universityId,
    isActive: f.user.isActive,
    department: f.department.name,
    departmentId: f.departmentId,
    designation: f.designation,
    qualification: f.qualification,
    experienceYrs: f.experienceYrs,
  };
}

export const facultyService = {
  async list(params: { page: number; pageSize: number; search?: string; departmentId?: string }) {
    const skip = (params.page - 1) * params.pageSize;
    const [rows, total] = await Promise.all([
      facultyRepository.list({ skip, take: params.pageSize, search: params.search, departmentId: params.departmentId }),
      facultyRepository.count({ search: params.search, departmentId: params.departmentId }),
    ]);
    return { data: rows.map(toListItem), total, page: params.page, pageSize: params.pageSize };
  },

  async getById(id: string) {
    const f = await facultyRepository.findById(id);
    if (!f) throw ApiError.notFound("Faculty member not found");
    return toListItem(f);
  },

  async getByUserId(userId: string) {
    const f = await facultyRepository.findByUserId(userId);
    if (!f) throw ApiError.notFound("No faculty profile linked to this account");
    return toListItem(f);
  },

  async update(id: string, data: UpdateFacultyInput) {
    const f = await facultyRepository.update(id, data);
    return toListItem(f);
  },

  async setActive(id: string, isActive: boolean) {
    const f = await facultyRepository.findById(id);
    if (!f) throw ApiError.notFound("Faculty member not found");
    await facultyRepository.setUserActive(f.userId, isActive);
    return this.getById(id);
  },
};
