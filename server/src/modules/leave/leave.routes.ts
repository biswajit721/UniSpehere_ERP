import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { leaveController } from "./leave.controller";

const router = Router();

router.use(authenticate);
router.post("/", authorize("leave", "create"), leaveController.create);
router.get("/me", authorize("leave", "read"), leaveController.myRequests);
router.get("/pending", authorize("leave", "read"), leaveController.pending);
router.get("/", authorize("leave", "read"), leaveController.all);
router.patch("/:id/decision", authorize("leave", "update"), leaveController.decide);

export default router;
