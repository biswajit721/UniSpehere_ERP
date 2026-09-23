import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { attendanceController } from "./attendance.controller";

const router = Router();

router.use(authenticate);

// Reference data
router.get("/policy", authorize("attendance", "read"), attendanceController.policy);
router.get("/options", authorize("attendance", "read"), attendanceController.options);

// Faculty / HOD / admin workflow
router.get("/students", authorize("attendance", "create"), attendanceController.roster);
router.post("/", authorize("attendance", "create"), attendanceController.submit);
router.get("/history", authorize("attendance", "read"), attendanceController.history);

// Reports (student self-service + HOD analytics). Declared before "/:id" so they are not read as ids.
router.get("/student/:studentId", authorize("attendance", "read"), attendanceController.studentReport);
router.get("/reports/department", authorize("attendance", "read"), attendanceController.departmentReport);

// One attendance sheet: view, correct, cancel
router.get("/:id", authorize("attendance", "read"), attendanceController.getOne);
router.put("/:id", authorize("attendance", "update"), attendanceController.edit);
router.post("/:id/cancel", authorize("attendance", "update"), attendanceController.cancel);

export default router;
