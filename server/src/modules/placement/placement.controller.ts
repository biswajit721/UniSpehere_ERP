import { Request, Response } from "express";
import { ApiError } from "../../utils/ApiError";
import { catchAsync } from "../../utils/catchAsync";
import { placementService } from "./placement.service";
import {
  createCompanySchema,
  createDriveSchema,
  updateApplicationStatusSchema,
  updateDriveStatusSchema,
} from "./placement.validation";

export const placementController = {
  listCompanies: catchAsync(async (_req: Request, res: Response) => {
    const companies = await placementService.listCompanies();
    res.status(200).json({ companies });
  }),

  createCompany: catchAsync(async (req: Request, res: Response) => {
    const input = createCompanySchema.parse(req.body);
    const company = await placementService.createCompany({ ...input, website: input.website || undefined });
    res.status(201).json({ message: "Company added", company });
  }),

  listDrives: catchAsync(async (_req: Request, res: Response) => {
    const drives = await placementService.listDrives();
    res.status(200).json({ drives });
  }),

  createDrive: catchAsync(async (req: Request, res: Response) => {
    const input = createDriveSchema.parse(req.body);
    const drive = await placementService.createDrive(input);
    res.status(201).json({ message: "Drive created", drive });
  }),

  setDriveStatus: catchAsync(async (req: Request, res: Response) => {
    const { status } = updateDriveStatusSchema.parse(req.body);
    const drive = await placementService.setDriveStatus(req.params.id, status);
    res.status(200).json({ message: "Drive status updated", drive });
  }),

  apply: catchAsync(async (req: Request, res: Response) => {
    const { studentId } = req.body;
    if (!studentId) throw ApiError.badRequest("studentId is required");
    const application = await placementService.apply(req.params.id, studentId);
    res.status(201).json({ message: "Application submitted", application });
  }),

  applicationsForDrive: catchAsync(async (req: Request, res: Response) => {
    const applications = await placementService.applicationsForDrive(req.params.id);
    res.status(200).json({ applications });
  }),

  applicationsForStudent: catchAsync(async (req: Request, res: Response) => {
    const applications = await placementService.applicationsForStudent(req.params.studentId);
    res.status(200).json({ applications });
  }),

  updateApplicationStatus: catchAsync(async (req: Request, res: Response) => {
    const { status } = updateApplicationStatusSchema.parse(req.body);
    const application = await placementService.updateApplicationStatus(req.params.id, status);
    res.status(200).json({ message: "Application updated", application });
  }),
};
