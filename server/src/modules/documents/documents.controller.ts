import { Request, Response } from "express";
import { ApiError } from "../../utils/ApiError";
import { catchAsync } from "../../utils/catchAsync";
import { documentsService } from "./documents.service";

export const documentsController = {
  upload: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!req.file) throw ApiError.badRequest("No file uploaded");
    const { title, category } = req.body;
    if (!title) throw ApiError.badRequest("Title is required");

    const doc = await documentsService.upload(req.user.userId, title, category ?? "OTHER", req.file.buffer);
    res.status(201).json({ message: "Document uploaded", document: doc });
  }),

  mine: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const documents = await documentsService.myDocuments(req.user.userId);
    res.status(200).json({ documents });
  }),

  all: catchAsync(async (req: Request, res: Response) => {
    const documents = await documentsService.allDocuments(req.query.status as string | undefined);
    res.status(200).json({ documents });
  }),

  review: catchAsync(async (req: Request, res: Response) => {
    const { status, reviewNote } = req.body;
    const document = await documentsService.review(req.params.id, status, reviewNote);
    res.status(200).json({ message: "Document reviewed", document });
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const isAdmin = ["SUPER_ADMIN", "UNIV_ADMIN"].includes(req.user.roleName);
    await documentsService.remove(req.params.id, req.user.userId, isAdmin);
    res.status(200).json({ message: "Document deleted" });
  }),
};
