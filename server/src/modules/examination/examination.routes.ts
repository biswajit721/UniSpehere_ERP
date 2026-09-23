import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { examinationController } from "./examination.controller";

const router = Router();

router.use(authenticate);
router.get("/", authorize("examination", "read"), examinationController.list);
router.post("/", authorize("examination", "create"), examinationController.create);
router.get("/:id", authorize("examination", "read"), examinationController.getOne);
router.post("/:id/marks", authorize("examination", "update"), examinationController.enterMarks);
router.patch("/:id/publish", authorize("examination", "publish"), examinationController.publish);
router.get(
  "/results/:studentId",
  authorize("examination", "read"),
  examinationController.studentResults
);

export default router;
