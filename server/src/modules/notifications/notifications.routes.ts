import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { ApiError } from "../../utils/ApiError";
import { catchAsync } from "../../utils/catchAsync";
import { notificationsService } from "./notifications.service";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  catchAsync(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await notificationsService.inbox(req.user.userId);
    res.status(200).json(result);
  })
);

router.patch(
  "/:id/read",
  catchAsync(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    await notificationsService.markRead(req.params.id, req.user.userId);
    res.status(200).json({ message: "Marked read" });
  })
);

router.patch(
  "/read-all",
  catchAsync(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    await notificationsService.markAllRead(req.user.userId);
    res.status(200).json({ message: "All marked read" });
  })
);

export default router;
