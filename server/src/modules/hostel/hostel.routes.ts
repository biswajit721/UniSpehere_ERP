import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { hostelController } from "./hostel.controller";

const router = Router();

router.use(authenticate);
router.get("/", authorize("hostel", "read"), hostelController.list);
router.post("/", authorize("hostel", "create"), hostelController.createHostel);
router.post("/:hostelId/rooms", authorize("hostel", "create"), hostelController.createRoom);
router.post("/allocate", authorize("hostel", "create"), hostelController.allocate);
router.patch("/allocations/:id/vacate", authorize("hostel", "update"), hostelController.vacate);
router.get("/me", authorize("hostel", "read"), hostelController.myAllocation);

export default router;
