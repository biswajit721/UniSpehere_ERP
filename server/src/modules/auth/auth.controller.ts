import { Request, Response } from "express";
import { env } from "../../config/env";
import { prisma } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { catchAsync } from "../../utils/catchAsync";
import { uploadBuffer, deleteByPublicId } from "../../utils/uploadFile";
import { authService } from "./auth.service";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from "./auth.validation";

// Determine if running in production
const isProduction = env.nodeEnv === "production" || process.env.NODE_ENV === "production";

// Cross-domain cookies between vercel.app and onrender.com require:
// sameSite: "none" AND secure: true
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
};

export const authController = {
  login: catchAsync(async (req: Request, res: Response) => {
    const input = loginSchema.parse(req.body);

    const result = await authService.login(input, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res
      .cookie("accessToken", result.accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 })
      .cookie("refreshToken", result.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 })
      .status(200)
      .json({ message: "Login successful", user: result.user, accessToken: result.accessToken });
  }),

  refresh: catchAsync(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken ?? req.body.refreshToken;
    if (!refreshToken) throw ApiError.unauthorized("No refresh token provided");

    const { accessToken } = await authService.refresh(refreshToken);

    res
      .cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 })
      .status(200)
      .json({ accessToken });
  }),

  logout: catchAsync(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken ?? req.body.refreshToken;
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    res
      .clearCookie("accessToken", cookieOptions)
      .clearCookie("refreshToken", cookieOptions)
      .status(200)
      .json({ message: "Logged out successfully" });
  }),

  changePassword: catchAsync(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    if (!req.user) throw ApiError.unauthorized();
    await authService.changePassword(req.user.userId, currentPassword, newPassword);
    res.status(200).json({ message: "Password updated successfully" });
  }),

  me: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const user = await authService.getSanitizedUser(req.user.userId);
    res.status(200).json({ user });
  }),

  forgotPassword: catchAsync(async (req: Request, res: Response) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    await authService.forgotPassword(email);
    // Always a generic success message - never reveal whether the email exists.
    res.status(200).json({ message: "If that email is registered, a code has been sent." });
  }),

  verifyOtp: catchAsync(async (req: Request, res: Response) => {
    const { email, otp } = verifyOtpSchema.parse(req.body);
    const result = await authService.verifyOtp(email, otp);
    res.status(200).json(result);
  }),

  resetPassword: catchAsync(async (req: Request, res: Response) => {
    const { resetToken, newPassword } = resetPasswordSchema.parse(req.body);
    await authService.resetPasswordWithToken(resetToken, newPassword);
    res.status(200).json({ message: "Password reset successfully. You can now log in." });
  }),

  updateProfile: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { phone, dateOfBirth, gender, address, bio } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        ...(phone !== undefined && { phone }),
        ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
        ...(gender !== undefined && { gender }),
        ...(address !== undefined && { address }),
        ...(bio !== undefined && { bio }),
      },
    });
    res.status(200).json({ message: "Profile updated", user: await authService.getSanitizedUser(user.id) });
  }),

  uploadPhoto: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!req.file) throw ApiError.badRequest("No file uploaded");

    const existing = await prisma.user.findUnique({ where: { id: req.user.userId } });
    const result = await uploadBuffer(req.file.buffer, "profile-photos");

    if (existing?.profilePhotoPublicId) {
      await deleteByPublicId(existing.profilePhotoPublicId).catch(() => undefined);
    }

    await prisma.user.update({
      where: { id: req.user.userId },
      data: { profilePhoto: result.url, profilePhotoPublicId: result.publicId },
    });
    res.status(200).json({ message: "Profile photo updated", profilePhoto: result.url });
  }),
};