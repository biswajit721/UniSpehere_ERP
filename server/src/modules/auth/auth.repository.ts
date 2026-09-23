import { prisma } from "../../config/db";

export const authRepository = {
  findUserByIdentifier(identifier: string) {
    return prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { universityId: identifier }],
        deletedAt: null,
      },
      include: { role: true },
    });
  },

  findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
  },

  updateLastLogin(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  },

  updatePassword(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustResetPassword: false },
    });
  },

  recordLoginActivity(data: {
    userId: string;
    success: boolean;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return prisma.loginActivity.create({ data });
  },

  storeRefreshToken(userId: string, token: string, expiresAt: Date) {
    return prisma.refreshToken.create({ data: { userId, token, expiresAt } });
  },

  findRefreshToken(token: string) {
    return prisma.refreshToken.findUnique({ where: { token } });
  },

  revokeRefreshToken(token: string) {
    return prisma.refreshToken.update({ where: { token }, data: { revoked: true } });
  },

  revokeAllUserRefreshTokens(userId: string) {
    return prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  },

  writeAuditLog(data: { userId?: string; action: string; module: string; ipAddress?: string }) {
    return prisma.auditLog.create({ data });
  },

  createOtp(userId: string, otpHash: string, expiresAt: Date) {
    return prisma.passwordResetOtp.create({ data: { userId, otpHash, expiresAt } });
  },

  findLatestValidOtp(userId: string) {
    return prisma.passwordResetOtp.findFirst({
      where: { userId, consumed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
  },

  consumeOtp(id: string) {
    return prisma.passwordResetOtp.update({ where: { id }, data: { consumed: true } });
  },
};
