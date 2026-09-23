import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { ApiError } from "../../utils/ApiError";
import { catchAsync } from "../../utils/catchAsync";
import { assertCanViewStudent } from "../../utils/studentAccess";
import { insightsService } from "./insights.service";

const router = Router();
router.use(authenticate);

// Every route below is per-student. A student may only read their own insights; staff are limited
// to their department / the sections they teach (previously any signed-in user could read anyone's).
router.param(
  "studentId",
  catchAsync(async (req, _res, next) => {
    if (!req.user) throw ApiError.unauthorized();
    await assertCanViewStudent(req.user, req.params.studentId);
    next();
  }) as any
);

router.get(
  "/student/:studentId/performance",
  catchAsync(async (req, res) => {
    const data = await insightsService.performanceBySubject(req.params.studentId);
    res.status(200).json({ performance: data });
  })
);

router.get(
  "/student/:studentId/career-trend",
  catchAsync(async (req, res) => {
    const data = await insightsService.careerTrend(req.params.studentId);
    res.status(200).json({ trend: data });
  })
);

router.get(
  "/student/:studentId/attendance-trend",
  catchAsync(async (req, res) => {
    const data = await insightsService.attendanceTrend(req.params.studentId);
    res.status(200).json({ trend: data });
  })
);

router.get(
  "/student/:studentId/tips",
  catchAsync(async (req, res) => {
    const data = await insightsService.generateTips(req.params.studentId);
    res.status(200).json(data);
  })
);

export default router;
