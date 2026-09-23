import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { grievanceController } from "./grievance.controller";

const router = Router();

router.use(authenticate);
router.post("/", authorize("grievance", "create"), grievanceController.create);
router.get("/me", authorize("grievance", "read"), grievanceController.myComplaints);
router.get("/", authorize("grievance", "read"), grievanceController.all);
router.patch("/:id", authorize("grievance", "update"), grievanceController.update);

export default router;
