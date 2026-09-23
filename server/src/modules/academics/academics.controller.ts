import { Request, Response } from "express";
import { resolveActor } from "../../utils/actor";
import { ApiError } from "../../utils/ApiError";
import { catchAsync } from "../../utils/catchAsync";
import { academicsService } from "./academics.service";
import {
  createAssignmentSchema,
  createSessionSchema,
  createSubjectSchema,
  listAssignmentsQuerySchema,
  listSemestersQuerySchema,
  listSessionsQuerySchema,
  listSubjectsQuerySchema,
  replacePeriodsSchema,
  updateSessionSchema,
  updateSubjectSchema,
} from "./academics.validation";

const actorOf = (req: Request) => {
  if (!req.user) throw ApiError.unauthorized();
  return resolveActor(req.user);
};

export const academicsController = {
  // ---------------------------------------------------------------- subjects
  list: catchAsync(async (req: Request, res: Response) => {
    const q = listSubjectsQuerySchema.parse(req.query);
    const subjects = await academicsService.listSubjects({ ...q, unmapped: q.unmapped === undefined ? undefined : q.unmapped === "true" });
    res.status(200).json({ subjects });
  }),

  create: catchAsync(async (req: Request, res: Response) => {
    const input = createSubjectSchema.parse(req.body);
    const subject = await academicsService.createSubject(await actorOf(req), input);
    res.status(201).json({ message: "Subject created", subject });
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const input = updateSubjectSchema.parse(req.body);
    const subject = await academicsService.updateSubject(await actorOf(req), req.params.id, input);
    res.status(200).json({ message: "Subject updated", subject });
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    await academicsService.removeSubject(await actorOf(req), req.params.id);
    res.status(200).json({ message: "Subject deleted" });
  }),

  // ---------------------------------------------------------------- academic sessions
  listSessions: catchAsync(async (req: Request, res: Response) => {
    const { activeOnly } = listSessionsQuerySchema.parse(req.query);
    const sessions = await academicsService.listSessions(activeOnly === "true");
    res.status(200).json({ sessions });
  }),

  createSession: catchAsync(async (req: Request, res: Response) => {
    const input = createSessionSchema.parse(req.body);
    const session = await academicsService.createSession(await actorOf(req), input);
    res.status(201).json({ message: "Academic session created", session });
  }),

  updateSession: catchAsync(async (req: Request, res: Response) => {
    const input = updateSessionSchema.parse(req.body);
    const session = await academicsService.updateSession(await actorOf(req), req.params.id, input);
    res.status(200).json({ message: "Academic session updated", session });
  }),

  // ---------------------------------------------------------------- semesters & periods
  listSemesters: catchAsync(async (req: Request, res: Response) => {
    const { programId } = listSemestersQuerySchema.parse(req.query);
    const semesters = await academicsService.listSemesters(programId);
    res.status(200).json({ semesters });
  }),

  listPeriods: catchAsync(async (_req: Request, res: Response) => {
    const periods = await academicsService.listPeriods();
    res.status(200).json({ periods });
  }),

  replacePeriods: catchAsync(async (req: Request, res: Response) => {
    const { periods } = replacePeriodsSchema.parse(req.body);
    const saved = await academicsService.replacePeriods(await actorOf(req), periods);
    res.status(200).json({ message: "Period grid saved", periods: saved });
  }),

  // ---------------------------------------------------------------- faculty assignments
  listAssignments: catchAsync(async (req: Request, res: Response) => {
    const filters = listAssignmentsQuerySchema.parse(req.query);
    const assignments = await academicsService.listAssignments(await actorOf(req), filters);
    res.status(200).json({ assignments });
  }),

  createAssignment: catchAsync(async (req: Request, res: Response) => {
    const input = createAssignmentSchema.parse(req.body);
    const assignment = await academicsService.createAssignment(await actorOf(req), input);
    res.status(201).json({ message: "Faculty assigned", assignment });
  }),

  deleteAssignment: catchAsync(async (req: Request, res: Response) => {
    await academicsService.deleteAssignment(await actorOf(req), req.params.id);
    res.status(200).json({ message: "Assignment removed" });
  }),
};
