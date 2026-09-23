import { Router } from "express";
import { prisma } from "../../config/db";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { catchAsync } from "../../utils/catchAsync";

const router = Router();
router.use(authenticate);

router.get(
  "/audit-logs",
  authorize("administration", "read"),
  catchAsync(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 30);
    const moduleFilter = req.query.module as string | undefined;

    const where = moduleFilter ? { module: moduleFilter } : {};
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.status(200).json({
      logs: logs.map((l) => ({
        id: l.id,
        user: l.user ? `${l.user.firstName} ${l.user.lastName}` : "System",
        action: l.action,
        module: l.module,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt,
      })),
      total,
      page,
      pageSize,
    });
  })
);

export default router;
