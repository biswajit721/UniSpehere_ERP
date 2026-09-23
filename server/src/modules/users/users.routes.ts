import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { usersController } from "./users.controller";

const router = Router();

router.use(authenticate);
router.post("/", authorize("users", "create"), usersController.create);
router.get("/", authorize("users", "read"), usersController.list);
router.post("/:id/reset-password", authorize("users", "update"), usersController.resetPassword);
router.get("/:id", authorize("users", "read"), usersController.getDetail);
router.put("/:id", authorize("users", "update"), usersController.updateDetail);
router.patch("/:id/activate", authorize("users", "update"), usersController.setActive);
router.patch("/:id/suspend", authorize("users", "update"), usersController.setActive);
router.delete("/:id", authorize("users", "delete"), usersController.remove);

export default router;
