import { Request, Response } from "express";
import { ApiError } from "../../utils/ApiError";
import { catchAsync } from "../../utils/catchAsync";
import { noticesService } from "./notices.service";
import { createNoticeSchema } from "./notices.validation";

export const noticesController = {
  list: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const notices = await noticesService.list(req.user.userId, req.user.roleName);
    res.status(200).json({ notices });
  }),

  create: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const input = createNoticeSchema.parse(req.body);
    const notice = await noticesService.create({ ...input, postedById: req.user.userId });
    res.status(201).json({ message: "Notice posted", notice });
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    await noticesService.remove(req.params.id);
    res.status(200).json({ message: "Notice deleted" });
  }),
};
