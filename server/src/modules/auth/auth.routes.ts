import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { loginRateLimiter } from "../../middleware/rateLimiter";
import { uploadSingle } from "../../middleware/upload";
import { authController } from "./auth.controller";

const router = Router();

router.post("/login", loginRateLimiter, authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);
router.post("/change-password", authenticate, authController.changePassword);
router.put("/me", authenticate, authController.updateProfile);
router.post("/me/photo", authenticate, uploadSingle("photo"), authController.uploadPhoto);

router.post("/forgot-password", loginRateLimiter, authController.forgotPassword);
router.post("/verify-otp", loginRateLimiter, authController.verifyOtp);
router.post("/reset-password", authController.resetPassword);

export default router;
