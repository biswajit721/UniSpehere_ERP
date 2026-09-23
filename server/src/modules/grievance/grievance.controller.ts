import { Request, Response } from "express";
import { ApiError } from "../../utils/ApiError";
import { catchAsync } from "../../utils/catchAsync";
import { grievanceService } from "./grievance.service";
import { createComplaintSchema, updateComplaintSchema } from "./grievance.validation";

export const grievanceController = {
  create: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const input = createComplaintSchema.parse(req.body);
    const complaint = await grievanceService.create(req.user.userId, input);
    res.status(201).json({ message: "Complaint submitted", complaint });
  }),

  myComplaints: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const complaints = await grievanceService.myComplaints(req.user.userId);
    res.status(200).json({ complaints });
  }),

  all: catchAsync(async (_req: Request, res: Response) => {
    const complaints = await grievanceService.allComplaints();
    res.status(200).json({ complaints });
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const input = updateComplaintSchema.parse(req.body);
    const complaint = await grievanceService.update(req.params.id, input.status, input.resolutionNote);
    res.status(200).json({ message: "Complaint updated", complaint });
  }),
};
