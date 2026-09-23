import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { uploadSingle } from "../../middleware/upload";
import { documentsController } from "./documents.controller";

const router = Router();

router.use(authenticate);
router.post("/", uploadSingle("file"), documentsController.upload);
router.get("/me", documentsController.mine);
router.get("/", authorize("documents", "read"), documentsController.all);
router.patch("/:id/review", authorize("documents", "update"), documentsController.review);
router.delete("/:id", documentsController.remove);

export default router;
