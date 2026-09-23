import { Request, Response } from "express";
import { ApiError } from "../../utils/ApiError";
import { catchAsync } from "../../utils/catchAsync";
import { studentsService } from "./students.service";
import { listStudentsQuerySchema, updateStudentSchema } from "./students.validation";

export const studentsController = {
  me: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const student = await studentsService.getByUserId(req.user.userId);
    res.status(200).json({ student });
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const query = listStudentsQuerySchema.parse(req.query);
    const result = await studentsService.list(query);
    res.status(200).json(result);
  }),

  getOne: catchAsync(async (req: Request, res: Response) => {
    const student = await studentsService.getById(req.params.id);
    res.status(200).json({ student });
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const input = updateStudentSchema.parse(req.body);
    const student = await studentsService.update(req.params.id, input);
    res.status(200).json({ message: "Student updated", student });
  }),

  activate: catchAsync(async (req: Request, res: Response) => {
    const student = await studentsService.setActive(req.params.id, true);
    res.status(200).json({ message: "Student activated", student });
  }),

  suspend: catchAsync(async (req: Request, res: Response) => {
    const student = await studentsService.setActive(req.params.id, false);
    res.status(200).json({ message: "Student suspended", student });
  }),
};
