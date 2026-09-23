import { z } from "zod";

export const createHostelSchema = z.object({
  name: z.string().min(1),
  warden: z.string().optional(),
});

export const createRoomSchema = z.object({
  roomNumber: z.string().min(1),
  capacity: z.coerce.number().int().min(1).max(10),
});

export const allocateSchema = z.object({
  roomId: z.string().uuid(),
  studentId: z.string().uuid(),
});
