import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { usersService } from "./users.service";
import { createUserSchema } from "./users.validation";

export const usersController = {
  create: catchAsync(async (req: Request, res: Response) => {
    const input = createUserSchema.parse(req.body);
    const result = await usersService.createUser(input, req.user?.userId);
    res.status(201).json({
      message: "User created. Share the temporary password securely — it will not be shown again.",
      user: result,
    });
  }),

  list: catchAsync(async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const result = await usersService.listUsers(page, pageSize);
    res.status(200).json(result);
  }),

  resetPassword: catchAsync(async (req: Request, res: Response) => {
    const result = await usersService.resetPassword(req.params.id, req.user?.userId, req.body?.password);
    res.status(200).json({
      message: "Password reset. Share the new temporary password securely — it will not be shown again.",
      ...result,
    });
  }),

  getDetail: catchAsync(async (req: Request, res: Response) => {
    const user = await usersService.getDetail(req.params.id);
    res.status(200).json({ user });
  }),

  setActive: catchAsync(async (req: Request, res: Response) => {
    const isActive = req.path.endsWith("/activate");
    const user = await usersService.setActive(req.params.id, isActive, req.user?.userId);
    res.status(200).json({ message: isActive ? "User activated" : "User suspended", user });
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    await usersService.remove(req.params.id, req.user?.userId);
    res.status(200).json({ message: "User deleted" });
  }),

  updateDetail: catchAsync(async (req: Request, res: Response) => {
    const user = await usersService.updateDetail(req.params.id, req.body);
    res.status(200).json({ message: "User details updated", user });
  }),
};
