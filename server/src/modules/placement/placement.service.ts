import { ApiError } from "../../utils/ApiError";
import { placementRepository } from "./placement.repository";

function driveDto(d: any) {
  return {
    id: d.id,
    company: d.company.name,
    companyId: d.companyId,
    jobRole: d.jobRole,
    description: d.description,
    eligibleDepartment: d.eligibleDepartment?.name ?? null,
    eligibleDepartmentId: d.eligibleDepartmentId,
    minCgpa: d.minCgpa ? Number(d.minCgpa) : null,
    salaryPackage: d.salaryPackage,
    driveDate: d.driveDate,
    status: d.status,
    applicantCount: d.applications?.length,
  };
}

export const placementService = {
  listCompanies() {
    return placementRepository.listCompanies();
  },

  createCompany(input: { name: string; website?: string; location?: string }) {
    return placementRepository.createCompany(input);
  },

  async listDrives() {
    const rows = await placementRepository.listDrives();
    return rows.map(driveDto);
  },

  async createDrive(input: {
    companyId: string;
    jobRole: string;
    description?: string;
    eligibleDepartmentId?: string;
    minCgpa?: number;
    salaryPackage?: string;
    driveDate: string;
  }) {
    const drive = await placementRepository.createDrive({ ...input, driveDate: new Date(input.driveDate) });
    return driveDto({ ...drive, applications: [] });
  },

  async setDriveStatus(id: string, status: "OPEN" | "CLOSED") {
    const drive = await placementRepository.updateDriveStatus(id, status);
    return drive;
  },

  async apply(driveId: string, studentId: string) {
    const drive = await placementRepository.findDriveById(driveId);
    if (!drive) throw ApiError.notFound("Placement drive not found");
    if (drive.status === "CLOSED") throw ApiError.conflict("This drive is closed for applications");

    const student = await placementRepository.findStudent(studentId);
    if (!student) throw ApiError.notFound("Student not found");

    if (drive.eligibleDepartmentId && drive.eligibleDepartmentId !== student.departmentId) {
      throw ApiError.forbidden("You are not eligible for this drive (department restriction)");
    }
    if (drive.minCgpa && (!student.cgpa || Number(student.cgpa) < Number(drive.minCgpa))) {
      throw ApiError.forbidden(`This drive requires a minimum CGPA of ${drive.minCgpa}`);
    }

    const existing = await placementRepository.findExistingApplication(driveId, studentId);
    if (existing) throw ApiError.conflict("You've already applied to this drive");

    return placementRepository.createApplication(driveId, studentId);
  },

  async applicationsForDrive(driveId: string) {
    const rows = await placementRepository.listApplicationsForDrive(driveId);
    return rows.map((a) => ({
      id: a.id,
      studentId: a.studentId,
      studentName: `${a.student.user.firstName} ${a.student.user.lastName}`,
      rollNumber: a.student.rollNumber,
      status: a.status,
      appliedAt: a.appliedAt,
    }));
  },

  async applicationsForStudent(studentId: string) {
    const rows = await placementRepository.listApplicationsForStudent(studentId);
    return rows.map((a) => ({
      id: a.id,
      company: a.drive.company.name,
      jobRole: a.drive.jobRole,
      status: a.status,
      appliedAt: a.appliedAt,
    }));
  },

  updateApplicationStatus(id: string, status: "APPLIED" | "SHORTLISTED" | "SELECTED" | "REJECTED") {
    return placementRepository.updateApplicationStatus(id, status);
  },
};
