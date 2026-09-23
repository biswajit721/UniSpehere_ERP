import { prisma } from "../config/db";
import { ApiError } from "./ApiError";

/**
 * How far a signed-in person's authority reaches. The RBAC permission (module + action) only says
 * "may use this feature"; the scope says "on WHICH data".
 *
 *   ALL         SUPER_ADMIN, UNIV_ADMIN, PRINCIPAL   every department
 *   DEPARTMENT  HOD                                  their own department only
 *   ASSIGNED    FACULTY                              only classes assigned to them
 *   SELF        STUDENT                              only their own records
 */
export type Scope = "ALL" | "DEPARTMENT" | "ASSIGNED" | "SELF";

export interface Actor {
  userId: string;
  role: string;
  scope: Scope;
  /** Faculty profile id - present for FACULTY and HOD. */
  facultyId: string | null;
  /** Home department - present for FACULTY and HOD. */
  departmentId: string | null;
  /** Student profile id - present for STUDENT. */
  studentId: string | null;
}

const ADMIN_ROLES = ["SUPER_ADMIN", "UNIV_ADMIN"];

export const isAdminRole = (role: string) => ADMIN_ROLES.includes(role);

export async function resolveActor(user: { userId: string; roleName: string }): Promise<Actor> {
  const role = user.roleName;
  const base = { userId: user.userId, role, facultyId: null, departmentId: null, studentId: null };

  if (role === "SUPER_ADMIN" || role === "UNIV_ADMIN" || role === "PRINCIPAL") {
    return { ...base, scope: "ALL" };
  }

  if (role === "HOD" || role === "FACULTY") {
    const faculty = await prisma.faculty.findUnique({ where: { userId: user.userId } });
    if (!faculty || faculty.deletedAt) {
      throw ApiError.forbidden("No faculty profile is linked to this account. Ask an administrator to set one up.");
    }
    return {
      ...base,
      scope: role === "HOD" ? "DEPARTMENT" : "ASSIGNED",
      facultyId: faculty.id,
      departmentId: faculty.departmentId,
    };
  }

  if (role === "STUDENT") {
    const student = await prisma.student.findUnique({ where: { userId: user.userId } });
    if (!student || student.deletedAt) {
      throw ApiError.forbidden("No student profile is linked to this account.");
    }
    return { ...base, scope: "SELF", studentId: student.id, departmentId: student.departmentId };
  }

  throw ApiError.forbidden("Your role does not have access to this feature.");
}

/** HOD may only act inside their own department; ALL-scope roles may act anywhere. */
export function assertDepartmentAccess(actor: Actor, departmentId: string, what = "this department") {
  if (actor.scope === "ALL") return;
  if (actor.scope === "DEPARTMENT" && actor.departmentId === departmentId) return;
  throw ApiError.forbidden(`You can only manage ${what} within your own department.`);
}
