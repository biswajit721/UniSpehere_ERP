import crypto from "crypto";
import { ApiError } from "../../utils/ApiError";
import { sendEmail } from "../../utils/email";
import { comparePassword, hashPassword } from "../../utils/hash";
import {
  signAccessToken,
  signRefreshToken,
  signResetToken,
  verifyRefreshToken,
  verifyResetToken,
} from "../../utils/jwt";
import { authRepository } from "./auth.repository";
import { AuthResult, LoginInput } from "./auth.types";

const REFRESH_TOKEN_TTL_DAYS = 7;
const OTP_TTL_MINUTES = 10;

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function toAuthResult(user: NonNullable<Awaited<ReturnType<typeof authRepository.findUserByIdentifier>>>, accessToken: string, refreshToken: string): AuthResult {
  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      universityId: user.universityId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
      mustResetPassword: user.mustResetPassword,
      profilePhoto: user.profilePhoto,
    },
  };
}

export const authService = {
  async login(input: LoginInput, meta: { ipAddress?: string; userAgent?: string }): Promise<AuthResult> {
    const user = await authRepository.findUserByIdentifier(input.identifier);

    if (!user || !user.isActive) {
      // No matching user (or account disabled) - there's no valid userId to attach
      // a LoginActivity row to, so we don't attempt one here. Failed attempts against
      // unknown identifiers aren't tied to an account; that's expected.
      throw ApiError.unauthorized("Invalid credentials");
    }

    const passwordValid = await comparePassword(input.password, user.passwordHash);

    await authRepository.recordLoginActivity({
      userId: user.id,
      success: passwordValid,
      ...meta,
    });

    if (!passwordValid) {
      throw ApiError.unauthorized("Invalid credentials");
    }

    const accessToken = signAccessToken({
      userId: user.id,
      roleId: user.roleId,
      roleName: user.role.name,
    });

    const tokenId = crypto.randomUUID();
    const refreshToken = signRefreshToken({ userId: user.id, tokenId });
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await authRepository.storeRefreshToken(user.id, refreshToken, expiresAt);

    await authRepository.updateLastLogin(user.id);
    await authRepository.writeAuditLog({
      userId: user.id,
      action: "LOGIN",
      module: "auth",
      ipAddress: meta.ipAddress,
    });

    return toAuthResult(user, accessToken, refreshToken);
  },

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized("Invalid or expired refresh token");
    }

    const stored = await authRepository.findRefreshToken(refreshToken);
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw ApiError.unauthorized("Refresh token is no longer valid");
    }

    const user = await authRepository.findUserById(payload.userId);
    if (!user || !user.isActive) {
      throw ApiError.unauthorized("Account is inactive");
    }

    // Rotation: revoke the used token, caller should issue+store a new one on next login.
    // For simplicity here we just re-sign a fresh access token; full rotation issues a new
    // refresh token too — left as a follow-up once the users module exists to test against.
    const accessToken = signAccessToken({
      userId: user.id,
      roleId: user.roleId,
      roleName: user.role.name,
    });

    return { accessToken };
  },

  async logout(refreshToken: string): Promise<void> {
    const stored = await authRepository.findRefreshToken(refreshToken);
    if (stored) {
      await authRepository.revokeRefreshToken(refreshToken);
    }
  },

  async getSanitizedUser(userId: string) {
    const user = await authRepository.findUserById(userId);
    if (!user) throw ApiError.notFound("User not found");
    return {
      id: user.id,
      universityId: user.universityId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
      mustResetPassword: user.mustResetPassword,
      profilePhoto: user.profilePhoto,
      phone: user.phone,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      address: user.address,
      bio: user.bio,
    };
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await authRepository.findUserById(userId);
    if (!user) throw ApiError.notFound("User not found");

    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) throw ApiError.badRequest("Current password is incorrect");

    const newHash = await hashPassword(newPassword);
    await authRepository.updatePassword(userId, newHash);
    await authRepository.revokeAllUserRefreshTokens(userId);
    await authRepository.writeAuditLog({ userId, action: "CHANGE_PASSWORD", module: "auth" });
  },

  async forgotPassword(email: string): Promise<void> {
    const user = await authRepository.findUserByIdentifier(email);
    // Always resolve successfully even if no account matches - don't leak which
    // emails exist in the system.
    if (!user || !user.isActive) return;

    const otp = generateOtp();
    const otpHash = await hashPassword(otp);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await authRepository.createOtp(user.id, otpHash, expiresAt);

    await sendEmail(
      user.email,
      "Your UniSphere ERP password reset code",
      `Your one-time code is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, ignore this email.`
    );
  },

  async verifyOtp(email: string, otp: string): Promise<{ resetToken: string }> {
    const user = await authRepository.findUserByIdentifier(email);
    if (!user) throw ApiError.badRequest("Invalid or expired code");

    const record = await authRepository.findLatestValidOtp(user.id);
    if (!record) throw ApiError.badRequest("Invalid or expired code");

    const valid = await comparePassword(otp, record.otpHash);
    if (!valid) throw ApiError.badRequest("Invalid or expired code");

    await authRepository.consumeOtp(record.id);
    const resetToken = signResetToken(user.id);
    return { resetToken };
  },

  async resetPasswordWithToken(resetToken: string, newPassword: string): Promise<void> {
    let payload;
    try {
      payload = verifyResetToken(resetToken);
    } catch {
      throw ApiError.unauthorized("This reset link has expired. Request a new code.");
    }

    const newHash = await hashPassword(newPassword);
    await authRepository.updatePassword(payload.userId, newHash);
    await authRepository.revokeAllUserRefreshTokens(payload.userId);
    await authRepository.writeAuditLog({ userId: payload.userId, action: "RESET_PASSWORD_OTP", module: "auth" });
  },
};
