import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize, requireRoles } from "../../middleware/authorize";
import { academicsController } from "./academics.controller";

const router = Router();
const adminOnly = requireRoles("UNIV_ADMIN");

router.use(authenticate);

// Subjects
router.get("/subjects", authorize("academics", "read"), academicsController.list);
router.post("/subjects", authorize("academics", "create"), academicsController.create);
router.put("/subjects/:id", authorize("academics", "update"), academicsController.update);
router.delete("/subjects/:id", authorize("academics", "delete"), academicsController.remove);

// Academic sessions - the calendar every enrollment and attendance record hangs off
router.get("/sessions", authorize("academics", "read"), academicsController.listSessions);
router.post("/sessions", adminOnly, authorize("academics", "create"), academicsController.createSession);
router.patch("/sessions/:id", adminOnly, authorize("academics", "update"), academicsController.updateSession);

// Semesters (per program) and the period grid
router.get("/semesters", authorize("academics", "read"), academicsController.listSemesters);
router.get("/periods", authorize("academics", "read"), academicsController.listPeriods);
router.put("/periods", adminOnly, authorize("academics", "update"), academicsController.replacePeriods);

// Faculty <-> subject <-> section assignments per session
router.get("/assignments", authorize("academics", "read"), academicsController.listAssignments);
router.post("/assignments", authorize("academics", "create"), academicsController.createAssignment);
router.delete("/assignments/:id", authorize("academics", "update"), academicsController.deleteAssignment);

export default router;
