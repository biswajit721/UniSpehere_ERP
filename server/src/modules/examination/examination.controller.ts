import { Request, Response } from "express";
import { ApiError } from "../../utils/ApiError";
import { catchAsync } from "../../utils/catchAsync";
import { examinationService } from "./examination.service";
import {
  createExamSchema,
  enterMarksSchema,
  listExamsQuerySchema,
} from "./examination.validation";

export const examinationController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const { subjectId } = listExamsQuerySchema.parse(req.query);
    const exams = await examinationService.list(subjectId);
    res.status(200).json({ exams });
  }),

  create: catchAsync(async (req: Request, res: Response) => {
    const input = createExamSchema.parse(req.body);
    const exam = await examinationService.create(input);
    res.status(201).json({ message: "Exam created", exam });
  }),

  getOne: catchAsync(async (req: Request, res: Response) => {
    const exam = await examinationService.getDetail(req.params.id);
    res.status(200).json({ exam });
  }),

  enterMarks: catchAsync(async (req: Request, res: Response) => {
    const input = enterMarksSchema.parse(req.body);
    if (!req.user) throw ApiError.unauthorized();
    const result = await examinationService.enterMarks(req.user.userId, req.params.id, input.records);
    res.status(200).json({ message: "Marks saved", ...result });
  }),

  publish: catchAsync(async (req: Request, res: Response) => {
    const exam = await examinationService.publish(req.params.id);
    res.status(200).json({ message: "Results published", exam });
  }),

  studentResults: catchAsync(async (req: Request, res: Response) => {
    const results = await examinationService.studentResults(req.params.studentId);
    res.status(200).json({ results });
  }),
};
