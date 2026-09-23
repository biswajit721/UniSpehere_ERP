import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { facultyController } from "./faculty.controller";

const router = Router();

router.use(authenticate);
router.get("/me", facultyController.me);
router.get("/assignments", authorize("academics", "read"), facultyController.myAssignments);
router.get("/", authorize("faculty", "read"), facultyController.list);
router.get("/:id", authorize("faculty", "read"), facultyController.getOne);
router.put("/:id", authorize("faculty", "update"), facultyController.update);
router.patch("/:id/activate", authorize("faculty", "update"), facultyController.activate);
router.patch("/:id/suspend", authorize("faculty", "update"), facultyController.suspend);

export default router;
