import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { feesController } from "./fees.controller";

const router = Router();

router.use(authenticate);
router.get("/", authorize("fees", "read"), feesController.list);
router.post("/", authorize("fees", "create"), feesController.create);
router.post("/:id/payments", authorize("fees", "update"), feesController.recordPayment);

export default router;
