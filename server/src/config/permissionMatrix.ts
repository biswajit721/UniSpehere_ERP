import { Prisma } from "@prisma/client";

export const ROLES = [
  "SUPER_ADMIN",
  "UNIV_ADMIN",
  "PRINCIPAL",
  "HOD",
  "FACULTY",
  "STUDENT",
  "EXAM_CONTROLLER",
  "ACCOUNTANT",
  "LIBRARIAN",
  "HOSTEL_WARDEN",
  "PLACEMENT_OFFICER",
] as const;

export type RoleName = (typeof ROLES)[number];

/**
 * module -> action -> roles allowed (mirrors the roles/permissions matrix in the architecture doc).
 *
 * The permission only says "may use this module at all". WHICH classes / students a person may
 * touch is decided in code (see modules/attendance/attendance.scope.ts):
 *   SUPER_ADMIN, UNIV_ADMIN, PRINCIPAL -> every department
 *   HOD                                -> their own department
 *   FACULTY                            -> only classes assigned to them
 *   STUDENT                            -> only their own records
 */
export const PERMISSION_MATRIX: Record<string, Record<string, RoleName[]>> = {
  users: {
    create: ["UNIV_ADMIN"],
    read: ["UNIV_ADMIN", "PRINCIPAL"],
    update: ["UNIV_ADMIN"],
    delete: ["UNIV_ADMIN"],
  },
  departments: {
    create: ["UNIV_ADMIN"],
    read: ["UNIV_ADMIN", "PRINCIPAL", "HOD", "FACULTY", "STUDENT"],
    update: ["UNIV_ADMIN"],
    delete: ["UNIV_ADMIN"],
  },
  students: {
    create: ["UNIV_ADMIN"],
    read: ["UNIV_ADMIN", "PRINCIPAL", "HOD", "FACULTY"],
    update: ["UNIV_ADMIN"],
    delete: ["UNIV_ADMIN"],
  },
  faculty: {
    create: ["UNIV_ADMIN"],
    read: ["UNIV_ADMIN", "PRINCIPAL", "HOD"],
    update: ["UNIV_ADMIN", "HOD"],
    delete: ["UNIV_ADMIN"],
  },
  academics: {
    create: ["UNIV_ADMIN", "HOD"],
    read: ["UNIV_ADMIN", "PRINCIPAL", "HOD", "FACULTY", "STUDENT"],
    update: ["UNIV_ADMIN", "HOD"],
    delete: ["UNIV_ADMIN"],
  },
  timetable: {
    create: ["UNIV_ADMIN", "HOD"],
    read: ["UNIV_ADMIN", "PRINCIPAL", "HOD", "FACULTY", "STUDENT"],
    delete: ["UNIV_ADMIN", "HOD"],
  },
  attendance: {
    create: ["FACULTY", "HOD", "PRINCIPAL", "UNIV_ADMIN"],
    read: ["HOD", "FACULTY", "STUDENT", "PRINCIPAL", "UNIV_ADMIN"],
    // Corrections are allowed for the people who own the class; the service narrows this
    // further (faculty: own classes inside the edit window, HOD: own department, admin: all)
    // and every change is written to AttendanceEdit + AuditLog with a mandatory reason.
    update: ["FACULTY", "HOD", "UNIV_ADMIN"],
  },
  fees: {
    create: ["ACCOUNTANT"],
    read: ["ACCOUNTANT", "STUDENT"],
    update: ["ACCOUNTANT"],
    approve: ["ACCOUNTANT"],
  },
  examination: {
    create: ["EXAM_CONTROLLER"],
    read: ["EXAM_CONTROLLER", "FACULTY", "STUDENT"],
    update: ["EXAM_CONTROLLER", "FACULTY"],
    publish: ["EXAM_CONTROLLER"],
  },
  library: {
    create: ["LIBRARIAN"],
    read: ["LIBRARIAN", "STUDENT", "FACULTY"],
    update: ["LIBRARIAN"],
    delete: ["LIBRARIAN"],
  },
  placement: {
    create: ["PLACEMENT_OFFICER"],
    read: ["PLACEMENT_OFFICER", "STUDENT"],
    update: ["PLACEMENT_OFFICER"],
  },
  notices: {
    create: ["UNIV_ADMIN", "HOD", "PRINCIPAL"],
    read: ROLES.slice(),
    update: ["UNIV_ADMIN", "HOD", "PRINCIPAL"],
    delete: ["UNIV_ADMIN", "HOD", "PRINCIPAL"],
  },
  leave: {
    create: ["STUDENT", "FACULTY"],
    read: ["UNIV_ADMIN", "HOD", "STUDENT", "FACULTY"],
    update: ["UNIV_ADMIN", "HOD"],
  },
  grievance: {
    create: ["STUDENT", "FACULTY"],
    read: ["UNIV_ADMIN", "HOD", "STUDENT", "FACULTY"],
    update: ["UNIV_ADMIN", "HOD"],
  },
  administration: {
    read: ["SUPER_ADMIN"],
  },
  documents: {
    read: ["UNIV_ADMIN", "SUPER_ADMIN"],
    update: ["UNIV_ADMIN", "SUPER_ADMIN"],
  },
  hostel: {
    create: ["HOSTEL_WARDEN"],
    read: ["HOSTEL_WARDEN", "STUDENT"],
    update: ["HOSTEL_WARDEN"],
    delete: ["HOSTEL_WARDEN"],
  },
};

/**
 * Idempotently makes sure every role and every (module, action, role) row in the matrix exists.
 * It only ever ADDS rows - it never deletes a permission an administrator may have granted by hand.
 */
export async function syncPermissions(prisma: Prisma.TransactionClient): Promise<{ rolesCreated: number; permissionsCreated: number }> {
  let rolesCreated = 0;
  let permissionsCreated = 0;

  const roleIdByName = new Map<string, string>();
  for (const name of ROLES) {
    const existing = await prisma.role.findUnique({ where: { name } });
    if (existing) {
      roleIdByName.set(name, existing.id);
    } else {
      const created = await prisma.role.create({ data: { name } });
      roleIdByName.set(name, created.id);
      rolesCreated += 1;
    }
  }

  for (const [module, actions] of Object.entries(PERMISSION_MATRIX)) {
    for (const [action, roles] of Object.entries(actions)) {
      for (const roleName of roles) {
        const roleId = roleIdByName.get(roleName)!;
        const existing = await prisma.permission.findUnique({
          where: { module_action_roleId: { module, action, roleId } },
        });
        if (!existing) {
          await prisma.permission.create({ data: { module, action, roleId } });
          permissionsCreated += 1;
        }
      }
    }
  }

  return { rolesCreated, permissionsCreated };
}
