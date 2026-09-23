import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { departmentsService } from "./departments.service";
import {
  createBatchSchema,
  createDepartmentSchema,
  createProgramSchema,
  createSectionSchema,
  updateBatchSchema,
  updateDepartmentSchema,
  updateProgramSchema,
  updateSectionSchema,
} from "./departments.validation";

export const departmentsController = {
  list: catchAsync(async (_req: Request, res: Response) => {
    const departments = await departmentsService.listDepartments();
    res.status(200).json({ departments });
  }),

  full: catchAsync(async (_req: Request, res: Response) => {
    const departments = await departmentsService.getFullTree();
    res.status(200).json({ departments });
  }),

  createDepartment: catchAsync(async (req: Request, res: Response) => {
    const input = createDepartmentSchema.parse(req.body);
    const department = await departmentsService.createDepartment(input);
    res.status(201).json({ message: "Department created", department });
  }),

  updateDepartment: catchAsync(async (req: Request, res: Response) => {
    const input = updateDepartmentSchema.parse(req.body);
    const department = await departmentsService.updateDepartment(req.params.id, input);
    res.status(200).json({ message: "Department updated", department });
  }),

  deleteDepartment: catchAsync(async (req: Request, res: Response) => {
    await departmentsService.deleteDepartment(req.params.id);
    res.status(200).json({ message: "Department deleted" });
  }),

  createProgram: catchAsync(async (req: Request, res: Response) => {
    const input = createProgramSchema.parse(req.body);
    const program = await departmentsService.createProgram(req.params.departmentId, input);
    res.status(201).json({ message: "Program created", program });
  }),

  updateProgram: catchAsync(async (req: Request, res: Response) => {
    const input = updateProgramSchema.parse(req.body);
    const program = await departmentsService.updateProgram(req.params.id, input);
    res.status(200).json({ message: "Program updated", program });
  }),

  deleteProgram: catchAsync(async (req: Request, res: Response) => {
    await departmentsService.deleteProgram(req.params.id);
    res.status(200).json({ message: "Program deleted" });
  }),

  createBatch: catchAsync(async (req: Request, res: Response) => {
    const input = createBatchSchema.parse(req.body);
    const batch = await departmentsService.createBatch(req.params.programId, input);
    res.status(201).json({ message: "Batch created", batch });
  }),

  updateBatch: catchAsync(async (req: Request, res: Response) => {
    const input = updateBatchSchema.parse(req.body);
    const batch = await departmentsService.updateBatch(req.params.id, input);
    res.status(200).json({ message: "Batch updated", batch });
  }),

  deleteBatch: catchAsync(async (req: Request, res: Response) => {
    await departmentsService.deleteBatch(req.params.id);
    res.status(200).json({ message: "Batch deleted" });
  }),

  createSection: catchAsync(async (req: Request, res: Response) => {
    const input = createSectionSchema.parse(req.body);
    const section = await departmentsService.createSection(req.params.batchId, input);
    res.status(201).json({ message: "Section created", section });
  }),

  updateSection: catchAsync(async (req: Request, res: Response) => {
    const input = updateSectionSchema.parse(req.body);
    const section = await departmentsService.updateSection(req.params.id, input);
    res.status(200).json({ message: "Section updated", section });
  }),

  deleteSection: catchAsync(async (req: Request, res: Response) => {
    await departmentsService.deleteSection(req.params.id);
    res.status(200).json({ message: "Section deleted" });
  }),
};
