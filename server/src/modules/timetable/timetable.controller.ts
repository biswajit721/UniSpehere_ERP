import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { timetableService } from "./timetable.service";
import { createSlotSchema, listSlotsQuerySchema } from "./timetable.validation";

export const timetableController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const query = listSlotsQuerySchema.parse(req.query);
    const slots = await timetableService.list(query);
    res.status(200).json({ slots });
  }),

  create: catchAsync(async (req: Request, res: Response) => {
    const input = createSlotSchema.parse(req.body);
    const slot = await timetableService.create(input);
    res.status(201).json({ message: "Class scheduled", slot });
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    await timetableService.remove(req.params.id);
    res.status(200).json({ message: "Class removed from timetable" });
  }),
};
