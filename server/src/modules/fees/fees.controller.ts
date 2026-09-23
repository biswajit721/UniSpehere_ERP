import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { feesService } from "./fees.service";
import { createFeeSchema, listFeesQuerySchema, recordPaymentSchema } from "./fees.validation";

export const feesController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const query = listFeesQuerySchema.parse(req.query);
    const fees = await feesService.list(query);
    res.status(200).json({ fees });
  }),

  create: catchAsync(async (req: Request, res: Response) => {
    const input = createFeeSchema.parse(req.body);
    const fee = await feesService.create(input);
    res.status(201).json({ message: "Fee record created", fee });
  }),

  recordPayment: catchAsync(async (req: Request, res: Response) => {
    const input = recordPaymentSchema.parse(req.body);
    const result = await feesService.recordPayment(req.params.id, input);
    res.status(200).json({ message: "Payment recorded", fee: result });
  }),
};
