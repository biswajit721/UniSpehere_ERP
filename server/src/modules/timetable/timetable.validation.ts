import { z } from "zod";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export const createSlotSchema = z
  .object({
    subjectId: z.string().uuid(),
    facultyId: z.string().uuid(),
    sectionId: z.string().uuid(),
    dayOfWeek: z.enum(DAYS),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format"),
    room: z.string().optional(),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const listSlotsQuerySchema = z.object({
  sectionId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
});
