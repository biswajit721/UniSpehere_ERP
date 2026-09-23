import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { libraryController } from "./library.controller";

const router = Router();

router.use(authenticate);
router.get("/books", authorize("library", "read"), libraryController.listBooks);
router.post("/books", authorize("library", "create"), libraryController.createBook);
router.put("/books/:id", authorize("library", "update"), libraryController.updateBook);
router.delete("/books/:id", authorize("library", "delete"), libraryController.removeBook);
router.post("/issue", authorize("library", "create"), libraryController.issueBook);
router.patch("/issue/:issueId/return", authorize("library", "update"), libraryController.returnBook);
router.get("/issues/active", authorize("library", "read"), libraryController.activeIssues);
router.get("/issues/student/:studentId", authorize("library", "read"), libraryController.studentIssues);

export default router;
