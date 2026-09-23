import { prisma } from "../../config/db";
import { enrollmentsService } from "../enrollments/enrollments.service";
import { CreatableRole, CreateUserInput } from "./users.types";

export const usersRepository = {
  findRoleByName(name: CreatableRole) {
    return prisma.role.findUnique({ where: { name } });
  },

  async countByUniversityIdPrefix(prefix: string) {
    return prisma.user.count({ where: { universityId: { startsWith: prefix } } });
  },

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findStudentByRollNumber(rollNumber: string) {
    return prisma.student.findUnique({ where: { rollNumber } });
  },

  findStudentByRegistrationNumber(registrationNumber: string) {
    return prisma.student.findUnique({ where: { registrationNumber } });
  },

  /** Creates the User row plus, if applicable, the Student or Faculty profile,
   *  in a single transaction so we never end up with a User missing its profile. */
  createWithProfile(params: {
    universityId: string;
    passwordHash: string;
    roleId: string;
    input: CreateUserInput;
    actorUserId?: string;
  }) {
    const { universityId, passwordHash, roleId, input, actorUserId } = params;

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          universityId,
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          roleId,
          mustResetPassword: input.mustResetPassword ?? true,
        },
        include: { role: true },
      });

      if (input.role === "STUDENT") {
        // Master profile: stable facts about the person. The academic placement lives in the
        // enrollment created right after, in the same transaction, and is validated there.
        const student = await tx.student.create({
          data: {
            userId: user.id,
            rollNumber: input.rollNumber!,
            registrationNumber: input.registrationNumber,
            departmentId: input.departmentId!,
            programId: input.programId!,
            batchId: input.batchId!,
            sectionId: input.sectionId,
            gender: input.gender,
            address: input.address,
            dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00.000Z`) : undefined,
            guardianName: input.guardianName,
            guardianPhone: input.guardianPhone,
            guardianRelation: input.guardianRelation,
          },
        });

        await enrollmentsService.createInitialEnrollment(tx, {
          studentId: student.id,
          academicSessionId: input.academicSessionId!,
          departmentId: input.departmentId!,
          programId: input.programId!,
          batchId: input.batchId!,
          semesterId: input.semesterId!,
          sectionId: input.sectionId,
          enrollmentType: input.enrollmentType!,
          admissionYear: input.admissionYear,
          admissionDate: input.admissionDate,
          createdById: actorUserId,
        });
      }

      if (input.role === "FACULTY" || input.role === "HOD") {
        await tx.faculty.create({
          data: {
            userId: user.id,
            employeeId: input.employeeId ?? universityId,
            departmentId: input.departmentId!,
            designation: input.designation!,
            qualification: input.qualification,
          },
        });
      }

      return user;
    });
  },

  listUsers(params: { skip: number; take: number }) {
    return prisma.user.findMany({
      where: { deletedAt: null },
      include: { role: true },
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    });
  },

  countUsers() {
    return prisma.user.count({ where: { deletedAt: null } });
  },

  updatePasswordAndForceReset(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustResetPassword: true },
    });
  },

  revokeAllRefreshTokens(userId: string) {
    return prisma.refreshToken.updateMany({ where: { userId, revoked: false }, data: { revoked: true } });
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id }, include: { role: true } });
  },

  setActive(id: string, isActive: boolean) {
    return prisma.user.update({ where: { id }, data: { isActive } });
  },

  softDelete(id: string) {
    return prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  },

  updateDetail(
    id: string,
    data: { firstName?: string; lastName?: string; phone?: string; dateOfBirth?: string; gender?: string; address?: string; bio?: string }
  ) {
    return prisma.user.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.dateOfBirth !== undefined && { dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null }),
        ...(data.gender !== undefined && { gender: data.gender }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.bio !== undefined && { bio: data.bio }),
      },
    });
  },
};
