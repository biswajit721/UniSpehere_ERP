import { prisma } from "../config/db";
import { Actor, resolveActor } from "./actor";
import { ApiError } from "./ApiError";

/**
 * Decides whether the signed-in user may look at ONE student's academic data (attendance,
 * marks, insights, ID card). The previous code accepted any studentId from any logged-in user.
 *
 *   STUDENT              only their own record
 *   FACULTY / HOD        students of their own department, or students in a section they teach
 *   ADMIN / PRINCIPAL    any student
 *
 * Returns the resolved actor and the student so callers don't need to load them again.
 */
export async function assertCanViewStudent(
  user: { userId: string; roleName: string },
  studentId: string
): Promise<{ actor: Actor; student: NonNullable<Awaited<ReturnType<typeof prisma.student.findUnique>>> }> {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student || student.deletedAt) throw ApiError.notFound("Student not found");

  const actor = await resolveActor(user);

  if (actor.scope === "ALL") return { actor, student };

  if (actor.scope === "SELF") {
    if (actor.studentId === student.id) return { actor, student };
    throw ApiError.forbidden("You can only view your own records.");
  }

  if (actor.departmentId === student.departmentId) return { actor, student };

  if (actor.scope === "ASSIGNED") {
    const teachesStudent = await prisma.facultySubjectAssignment.count({
      where: { facultyId: actor.facultyId!, section: { enrollments: { some: { studentId: student.id } } } },
    });
    if (teachesStudent > 0) return { actor, student };
  }

  throw ApiError.forbidden("You can only view students from your own department or the sections you teach.");
}

/** Shortcut for endpoints that take `me` or a student id in the URL. */
export async function resolveStudentParam(
  user: { userId: string; roleName: string },
  param: string
): Promise<string> {
  if (param !== "me") return param;
  const student = await prisma.student.findUnique({ where: { userId: user.userId } });
  if (!student) throw ApiError.notFound("No student profile is linked to this account");
  return student.id;
}
