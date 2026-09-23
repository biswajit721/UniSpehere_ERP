import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { catchAsync } from "../utils/catchAsync";

/**
 * Usage: router.post("/students", authenticate, authorize("students", "create"), handler)
 *
 * Permissions live in the database (Role -> Permission), not in code branches.
 * SUPER_ADMIN always passes, everyone else needs a matching (module, action) row
 * tied to their role.
 */
export function authorize(module: string, action: string) {
  return catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    if (req.user.roleName === "SUPER_ADMIN") {
      return next();
    }

    const permission = await prisma.permission.findFirst({
      where: { roleId: req.user.roleId, module, action },
    });

    if (!permission) {
      throw ApiError.forbidden(`You do not have permission to ${action} ${module}`);
    }

    next();
  });
}

/**
 * Restricts a route to specific roles regardless of module permissions - for actions such as
 * creating academic sessions that only administrators may perform. SUPER_ADMIN always passes.
 */
export function requireRoles(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.roleName === "SUPER_ADMIN" || roles.includes(req.user.roleName)) return next();
    return next(ApiError.forbidden("Only an administrator can do this."));
  };
}
