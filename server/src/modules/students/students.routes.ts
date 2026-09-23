import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { enrollmentsController } from "../enrollments/enrollments.controller";
import { studentsController } from "./students.controller";

const router = Router();

router.use(authenticate);
router.get("/me", studentsController.me);
router.get("/", authorize("students", "read"), studentsController.list);

// Academic lifecycle - each action closes the current enrollment and opens a new one
// (history is never overwritten). Declared before "/:id" so these paths win.
router.delete("/subject-registrations/:registrationId", authorize("students", "update"), enrollmentsController.removeSubjectRegistration);
router.get("/:id/enrollments", authorize("students", "read"), enrollmentsController.history);
router.post("/:id/enrollments/promote", authorize("students", "update"), enrollmentsController.promote);
router.post("/:id/enrollments/readmit", authorize("students", "update"), enrollmentsController.readmit);
router.post("/:id/enrollments/transfer", authorize("students", "update"), enrollmentsController.transfer);
router.post("/:id/enrollments/close", authorize("students", "update"), enrollmentsController.close);
router.post("/:id/subject-registrations", authorize("students", "update"), enrollmentsController.registerSubject);

router.get("/:id", authorize("students", "read"), studentsController.getOne);
router.put("/:id", authorize("students", "update"), studentsController.update);
router.patch("/:id/activate", authorize("students", "update"), studentsController.activate);
router.patch("/:id/suspend", authorize("students", "update"), studentsController.suspend);

export default router;
