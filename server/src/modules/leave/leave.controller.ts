import { Request, Response } from "express";
import { ApiError } from "../../utils/ApiError";
import { catchAsync } from "../../utils/catchAsync";
import { leaveService } from "./leave.service";
import { createLeaveSchema, decideLeaveSchema } from "./leave.validation";

export const leaveController = {
  create: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const input = createLeaveSchema.parse(req.body);
    const leave = await leaveService.create(req.user.userId, input);
    res.status(201).json({ message: "Leave request submitted", leave });
  }),

  myRequests: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const leaves = await leaveService.myRequests(req.user.userId);
    res.status(200).json({ leaves });
  }),

  pending: catchAsync(async (_req: Request, res: Response) => {
    const leaves = await leaveService.pendingQueue();
    res.status(200).json({ leaves });
  }),

  all: catchAsync(async (_req: Request, res: Response) => {
    const leaves = await leaveService.allRequests();
    res.status(200).json({ leaves });
  }),

  decide: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const input = decideLeaveSchema.parse(req.body);
    const leave = await leaveService.decide(req.params.id, req.user.userId, input.status, input.decisionNote);
    res.status(200).json({ message: "Decision recorded", leave });
  }),
};
