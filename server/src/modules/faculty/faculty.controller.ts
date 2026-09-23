import { Request, Response } from "express";
import { resolveActor } from "../../utils/actor";
import { ApiError } from "../../utils/ApiError";
import { catchAsync } from "../../utils/catchAsync";
import { academicsService } from "../academics/academics.service";
import { facultyService } from "./faculty.service";
import { listFacultyQuerySchema, updateFacultySchema } from "./faculty.validation";

export const facultyController = {
  me: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const faculty = await facultyService.getByUserId(req.user.userId);
    res.status(200).json({ faculty });
  }),

  /** The signed-in faculty member's own subject/section assignments (optionally for one session). */
  myAssignments: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const actor = await resolveActor(req.user);
    if (!actor.facultyId) throw ApiError.forbidden("No faculty profile is linked to this account");
    const academicSessionId = typeof req.query.academicSessionId === "string" ? req.query.academicSessionId : undefined;
    const assignments = await academicsService.listAssignments(
      { ...actor, scope: "ASSIGNED" },
      { academicSessionId }
    );
    res.status(200).json({ assignments });
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const query = listFacultyQuerySchema.parse(req.query);
    const result = await facultyService.list(query);
    res.status(200).json(result);
  }),

  getOne: catchAsync(async (req: Request, res: Response) => {
    const faculty = await facultyService.getById(req.params.id);
    res.status(200).json({ faculty });
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const input = updateFacultySchema.parse(req.body);
    const faculty = await facultyService.update(req.params.id, input);
    res.status(200).json({ message: "Faculty updated", faculty });
  }),

  activate: catchAsync(async (req: Request, res: Response) => {
    const faculty = await facultyService.setActive(req.params.id, true);
    res.status(200).json({ message: "Faculty activated", faculty });
  }),

  suspend: catchAsync(async (req: Request, res: Response) => {
    const faculty = await facultyService.setActive(req.params.id, false);
    res.status(200).json({ message: "Faculty suspended", faculty });
  }),
};
