import { Request, Response } from "express";
import { resolveActor } from "../../utils/actor";
import { ApiError } from "../../utils/ApiError";
import { catchAsync } from "../../utils/catchAsync";
import { resolveStudentParam } from "../../utils/studentAccess";
import { attendanceReports } from "./attendance.reports";
import { attendanceService } from "./attendance.service";
import {
  cancelAttendanceSchema,
  departmentReportQuerySchema,
  editAttendanceSchema,
  historyQuerySchema,
  optionsQuerySchema,
  rosterQuerySchema,
  studentReportQuerySchema,
  submitAttendanceSchema,
} from "./attendance.validation";

const userOf = (req: Request) => {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
};
const actorOf = (req: Request) => resolveActor(userOf(req));

export const attendanceController = {
  policy: catchAsync(async (_req: Request, res: Response) => {
    const policy = await attendanceService.getPolicy();
    res.status(200).json({ policy });
  }),

  options: catchAsync(async (req: Request, res: Response) => {
    const q = optionsQuerySchema.parse(req.query);
    const result = await attendanceService.options(await actorOf(req), q);
    res.status(200).json(result);
  }),

  /** GET /attendance/students - the validated class list for one class on one date. */
  roster: catchAsync(async (req: Request, res: Response) => {
    const q = rosterQuerySchema.parse(req.query);
    const result = await attendanceService.roster(await actorOf(req), q);
    res.status(200).json(result);
  }),

  /** POST /attendance */
  submit: catchAsync(async (req: Request, res: Response) => {
    const input = submitAttendanceSchema.parse(req.body);
    const attendance = await attendanceService.submit(await actorOf(req), input, req.ip);
    res.status(201).json({ message: "Attendance submitted successfully.", attendance });
  }),

  history: catchAsync(async (req: Request, res: Response) => {
    const q = historyQuerySchema.parse(req.query);
    const result = await attendanceService.history(await actorOf(req), q);
    res.status(200).json(result);
  }),

  getOne: catchAsync(async (req: Request, res: Response) => {
    const attendance = await attendanceService.getSession(await actorOf(req), req.params.id);
    res.status(200).json({ attendance });
  }),

  /** PUT /attendance/:id */
  edit: catchAsync(async (req: Request, res: Response) => {
    const input = editAttendanceSchema.parse(req.body);
    const result = await attendanceService.edit(await actorOf(req), req.params.id, input, req.ip);
    res.status(200).json({ message: "Attendance corrected and logged.", ...result });
  }),

  cancel: catchAsync(async (req: Request, res: Response) => {
    const { reason } = cancelAttendanceSchema.parse(req.body);
    const result = await attendanceService.cancel(await actorOf(req), req.params.id, reason, req.ip);
    res.status(200).json({ message: "Attendance cancelled.", ...result });
  }),

  /** GET /attendance/student/:studentId  (use "me" for the signed-in student) */
  studentReport: catchAsync(async (req: Request, res: Response) => {
    const user = userOf(req);
    const studentId = await resolveStudentParam(user, req.params.studentId);
    const q = studentReportQuerySchema.parse(req.query);
    const report = await attendanceReports.studentReport(user, studentId, q);
    res.status(200).json(report);
  }),

  /** GET /attendance/reports/department */
  departmentReport: catchAsync(async (req: Request, res: Response) => {
    const q = departmentReportQuerySchema.parse(req.query);
    const report = await attendanceReports.departmentReport(await actorOf(req), q);
    res.status(200).json(report);
  }),
};
