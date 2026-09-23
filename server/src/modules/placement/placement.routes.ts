import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { placementController } from "./placement.controller";

const router = Router();

router.use(authenticate);
router.get("/companies", authorize("placement", "read"), placementController.listCompanies);
router.post("/companies", authorize("placement", "create"), placementController.createCompany);

router.get("/drives", authorize("placement", "read"), placementController.listDrives);
router.post("/drives", authorize("placement", "create"), placementController.createDrive);
router.patch("/drives/:id/status", authorize("placement", "update"), placementController.setDriveStatus);
router.post("/drives/:id/apply", authorize("placement", "read"), placementController.apply);
router.get("/drives/:id/applications", authorize("placement", "read"), placementController.applicationsForDrive);

router.get(
  "/applications/student/:studentId",
  authorize("placement", "read"),
  placementController.applicationsForStudent
);
router.patch(
  "/applications/:id/status",
  authorize("placement", "update"),
  placementController.updateApplicationStatus
);

export default router;
