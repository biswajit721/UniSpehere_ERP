import { ApiError } from "../../utils/ApiError";
import { writeAudit } from "../../utils/audit";
import { generateTempPassword } from "../../utils/generatePassword";
import { hashPassword } from "../../utils/hash";
import { usersRepository } from "./users.repository";
import { CreateUserInput, CreateUserResult, prefixForRole } from "./users.types";

export const usersService = {
  async createUser(input: CreateUserInput, actorUserId?: string): Promise<CreateUserResult> {
    const existing = await usersRepository.findByEmail(input.email);
    if (existing) {
      throw ApiError.conflict("A user with this email already exists");
    }

    const role = await usersRepository.findRoleByName(input.role);
    if (!role) {
      throw ApiError.badRequest(`Role ${input.role} does not exist. Run the seed script first.`);
    }

    if (input.role === "STUDENT") {
      if (input.rollNumber && (await usersRepository.findStudentByRollNumber(input.rollNumber))) {
        throw ApiError.conflict(`Roll number ${input.rollNumber} is already assigned to another student.`);
      }
      if (input.registrationNumber && (await usersRepository.findStudentByRegistrationNumber(input.registrationNumber))) {
        throw ApiError.conflict(`Registration number ${input.registrationNumber} is already assigned to another student.`);
      }
    }

    const prefix = prefixForRole(input.role);
    const count = await usersRepository.countByUniversityIdPrefix(prefix);
    const universityId = `${prefix}${String(count + 1).padStart(4, "0")}`;

    // An admin can set the password directly; otherwise we generate a temporary one.
    const usingCustomPassword = Boolean(input.password);
    const plainPassword = input.password ?? generateTempPassword();
    const passwordHash = await hashPassword(plainPassword);

    const user = await usersRepository.createWithProfile({
      universityId,
      passwordHash,
      roleId: role.id,
      input,
      actorUserId,
    });

    await writeAudit({
      userId: actorUserId,
      action: "CREATE_USER",
      module: "users",
      metadata: { createdUserId: user.id, role: input.role, universityId, customPassword: usingCustomPassword },
    });

    return {
      id: user.id,
      universityId: user.universityId,
      email: user.email,
      role: input.role,
      tempPassword: usingCustomPassword ? null : plainPassword,
      passwordWasCustom: usingCustomPassword,
    };
  },

  async listUsers(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [users, total] = await Promise.all([
      usersRepository.listUsers({ skip, take: pageSize }),
      usersRepository.countUsers(),
    ]);

    return {
      data: users.map((u) => ({
        id: u.id,
        universityId: u.universityId,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role.name,
        isActive: u.isActive,
        createdAt: u.createdAt,
      })),
      total,
      page,
      pageSize,
    };
  },

  async resetPassword(userId: string, actorUserId?: string, customPassword?: string) {
    const user = await usersRepository.findById(userId);
    if (!user) throw ApiError.notFound("User not found");

    // Admin may supply a specific password; otherwise generate a temporary one.
    const usingCustom = Boolean(customPassword);
    const plainPassword = customPassword ?? generateTempPassword();
    const passwordHash = await hashPassword(plainPassword);
    await usersRepository.updatePasswordAndForceReset(userId, passwordHash);
    await usersRepository.revokeAllRefreshTokens(userId);

    await writeAudit({
      userId: actorUserId,
      action: "RESET_PASSWORD",
      module: "users",
      metadata: { targetUserId: userId, universityId: user.universityId, customPassword: usingCustom },
    });

    return {
      universityId: user.universityId,
      email: user.email,
      tempPassword: plainPassword,
      passwordWasCustom: usingCustom,
    };
  },

  async getDetail(userId: string) {
    const user = await usersRepository.findById(userId);
    if (!user) throw ApiError.notFound("User not found");
    return {
      id: user.id,
      universityId: user.universityId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role.name,
      isActive: user.isActive,
      profilePhoto: user.profilePhoto,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      address: user.address,
      bio: user.bio,
    };
  },

  async setActive(userId: string, isActive: boolean, actorUserId?: string) {
    const user = await usersRepository.findById(userId);
    if (!user) throw ApiError.notFound("User not found");
    if (user.role.name === "SUPER_ADMIN") {
      throw ApiError.forbidden("The Super Admin account cannot be suspended");
    }
    await usersRepository.setActive(userId, isActive);
    await writeAudit({
      userId: actorUserId,
      action: isActive ? "ACTIVATE_USER" : "SUSPEND_USER",
      module: "users",
      metadata: { targetUserId: userId, universityId: user.universityId },
    });
    return this.getDetail(userId);
  },

  async remove(userId: string, actorUserId?: string) {
    const user = await usersRepository.findById(userId);
    if (!user) throw ApiError.notFound("User not found");
    if (user.role.name === "SUPER_ADMIN") {
      throw ApiError.forbidden("The Super Admin account cannot be deleted");
    }
    // Soft delete - keeps attendance/marks/fee history intact and auditable.
    await usersRepository.softDelete(userId);
    await usersRepository.revokeAllRefreshTokens(userId);
    await writeAudit({
      userId: actorUserId,
      action: "DELETE_USER",
      module: "users",
      metadata: { targetUserId: userId, universityId: user.universityId },
    });
  },

  async updateDetail(
    userId: string,
    data: { firstName?: string; lastName?: string; phone?: string; dateOfBirth?: string; gender?: string; address?: string; bio?: string }
  ) {
    const user = await usersRepository.findById(userId);
    if (!user) throw ApiError.notFound("User not found");
    const updated = await usersRepository.updateDetail(userId, data);
    return this.getDetail(updated.id);
  },
};
