import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { timetableController } from "./timetable.controller";

const router = Router();

router.use(authenticate);
router.get("/", authorize("timetable", "read"), timetableController.list);
router.post("/", authorize("timetable", "create"), timetableController.create);
router.delete("/:id", authorize("timetable", "delete"), timetableController.remove);

export default router;
