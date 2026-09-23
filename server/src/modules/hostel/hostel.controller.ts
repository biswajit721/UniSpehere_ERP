import { Request, Response } from "express";
import { prisma } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { catchAsync } from "../../utils/catchAsync";
import { hostelService } from "./hostel.service";
import { allocateSchema, createHostelSchema, createRoomSchema } from "./hostel.validation";

export const hostelController = {
  list: catchAsync(async (_req: Request, res: Response) => {
    const hostels = await hostelService.listHostels();
    res.status(200).json({ hostels });
  }),

  createHostel: catchAsync(async (req: Request, res: Response) => {
    const input = createHostelSchema.parse(req.body);
    const hostel = await hostelService.createHostel(input);
    res.status(201).json({ message: "Hostel created", hostel });
  }),

  createRoom: catchAsync(async (req: Request, res: Response) => {
    const input = createRoomSchema.parse(req.body);
    const room = await hostelService.createRoom(req.params.hostelId, input);
    res.status(201).json({ message: "Room added", room });
  }),

  allocate: catchAsync(async (req: Request, res: Response) => {
    const input = allocateSchema.parse(req.body);
    const allocation = await hostelService.allocate(input.roomId, input.studentId);
    res.status(201).json({ message: "Room allocated", allocation });
  }),

  vacate: catchAsync(async (req: Request, res: Response) => {
    await hostelService.vacate(req.params.id);
    res.status(200).json({ message: "Room vacated" });
  }),

  myAllocation: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const student = await prisma.student.findUnique({ where: { userId: req.user.userId } });
    if (!student) throw ApiError.notFound("No student profile linked to this account");
    const allocation = await hostelService.myAllocation(student.id);
    res.status(200).json({ allocation });
  }),
};
