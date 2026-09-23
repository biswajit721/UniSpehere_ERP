import { prisma } from "../../config/db";

export const placementRepository = {
  listCompanies() {
    return prisma.placementCompany.findMany({ orderBy: { name: "asc" } });
  },

  createCompany(data: { name: string; website?: string; location?: string }) {
    return prisma.placementCompany.create({ data });
  },

  listDrives() {
    return prisma.placementDrive.findMany({
      include: { company: true, eligibleDepartment: true, applications: true },
      orderBy: { driveDate: "desc" },
    });
  },

  findDriveById(id: string) {
    return prisma.placementDrive.findUnique({
      where: { id },
      include: { company: true, eligibleDepartment: true },
    });
  },

  createDrive(data: {
    companyId: string;
    jobRole: string;
    description?: string;
    eligibleDepartmentId?: string;
    minCgpa?: number;
    salaryPackage?: string;
    driveDate: Date;
  }) {
    return prisma.placementDrive.create({ data, include: { company: true, eligibleDepartment: true } });
  },

  updateDriveStatus(id: string, status: "OPEN" | "CLOSED") {
    return prisma.placementDrive.update({ where: { id }, data: { status } });
  },

  findStudent(studentId: string) {
    return prisma.student.findUnique({ where: { id: studentId } });
  },

  findExistingApplication(driveId: string, studentId: string) {
    return prisma.application.findUnique({ where: { driveId_studentId: { driveId, studentId } } });
  },

  createApplication(driveId: string, studentId: string) {
    return prisma.application.create({ data: { driveId, studentId } });
  },

  listApplicationsForDrive(driveId: string) {
    return prisma.application.findMany({
      where: { driveId },
      include: { student: { include: { user: true } } },
      orderBy: { appliedAt: "asc" },
    });
  },

  listApplicationsForStudent(studentId: string) {
    return prisma.application.findMany({
      where: { studentId },
      include: { drive: { include: { company: true } } },
      orderBy: { appliedAt: "desc" },
    });
  },

  updateApplicationStatus(id: string, status: "APPLIED" | "SHORTLISTED" | "SELECTED" | "REJECTED") {
    return prisma.application.update({ where: { id }, data: { status } });
  },
};
