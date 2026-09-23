import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { departmentsController } from "./departments.controller";

const router = Router();

router.use(authenticate);

// Reads — available to anyone with "departments read" permission (broad, see seed matrix)
router.get("/", authorize("departments", "read"), departmentsController.list);
router.get("/full", authorize("departments", "read"), departmentsController.full);

// Departments
router.post("/", authorize("departments", "create"), departmentsController.createDepartment);
router.put("/:id", authorize("departments", "update"), departmentsController.updateDepartment);
router.delete("/:id", authorize("departments", "delete"), departmentsController.deleteDepartment);

// Programs (nested under a department)
router.post(
  "/:departmentId/programs",
  authorize("departments", "create"),
  departmentsController.createProgram
);
router.put("/programs/:id", authorize("departments", "update"), departmentsController.updateProgram);
router.delete("/programs/:id", authorize("departments", "delete"), departmentsController.deleteProgram);

// Batches (nested under a program)
router.post(
  "/programs/:programId/batches",
  authorize("departments", "create"),
  departmentsController.createBatch
);
router.put("/batches/:id", authorize("departments", "update"), departmentsController.updateBatch);
router.delete("/batches/:id", authorize("departments", "delete"), departmentsController.deleteBatch);

// Sections (nested under a batch)
router.post(
  "/batches/:batchId/sections",
  authorize("departments", "create"),
  departmentsController.createSection
);
router.put("/sections/:id", authorize("departments", "update"), departmentsController.updateSection);
router.delete("/sections/:id", authorize("departments", "delete"), departmentsController.deleteSection);

export default router;
