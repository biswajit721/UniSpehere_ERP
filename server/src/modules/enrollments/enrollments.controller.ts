import { Request, Response } from "express";
import { resolveActor } from "../../utils/actor";
import { ApiError } from "../../utils/ApiError";
import { catchAsync } from "../../utils/catchAsync";
import { assertCanViewStudent } from "../../utils/studentAccess";
import { enrollmentsService } from "./enrollments.service";
import { closeSchema, promoteSchema, readmitSchema, registerSubjectSchema, transferSchema } from "./enrollments.validation";

const actorOf = (req: Request) => {
  if (!req.user) throw ApiError.unauthorized();
  return resolveActor(req.user);
};

export const enrollmentsController = {
  history: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await assertCanViewStudent(req.user, req.params.id);
    const enrollments = await enrollmentsService.history(req.params.id);
    res.status(200).json({ enrollments });
  }),

  promote: catchAsync(async (req: Request, res: Response) => {
    const input = promoteSchema.parse(req.body);
    const enrollment = await enrollmentsService.promote(await actorOf(req), req.params.id, input);
    res.status(201).json({ message: "Student promoted. The previous enrollment is kept in their history.", enrollment });
  }),

  readmit: catchAsync(async (req: Request, res: Response) => {
    const input = readmitSchema.parse(req.body);
    const enrollment = await enrollmentsService.readmit(await actorOf(req), req.params.id, input);
    res.status(201).json({ message: "Student readmitted. The previous enrollment is kept in their history.", enrollment });
  }),

  transfer: catchAsync(async (req: Request, res: Response) => {
    const input = transferSchema.parse(req.body);
    const enrollment = await enrollmentsService.transfer(await actorOf(req), req.params.id, input);
    res.status(201).json({ message: "Placement changed. Earlier attendance stays with the previous section.", enrollment });
  }),

  close: catchAsync(async (req: Request, res: Response) => {
    const input = closeSchema.parse(req.body);
    const enrollment = await enrollmentsService.close(await actorOf(req), req.params.id, input);
    res.status(200).json({ message: "Enrollment closed.", enrollment });
  }),

  registerSubject: catchAsync(async (req: Request, res: Response) => {
    const input = registerSubjectSchema.parse(req.body);
    const registration = await enrollmentsService.registerSubject(await actorOf(req), req.params.id, input);
    res.status(201).json({ message: "Subject registered", registration });
  }),

  removeSubjectRegistration: catchAsync(async (req: Request, res: Response) => {
    await enrollmentsService.removeSubjectRegistration(await actorOf(req), req.params.registrationId);
    res.status(200).json({ message: "Registration removed" });
  }),
};
