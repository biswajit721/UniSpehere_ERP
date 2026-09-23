import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { noticesController } from "./notices.controller";

const router = Router();

router.use(authenticate);
router.get("/", authorize("notices", "read"), noticesController.list);
router.post("/", authorize("notices", "create"), noticesController.create);
router.delete("/:id", authorize("notices", "delete"), noticesController.remove);

export default router;
