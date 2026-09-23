import { Prisma } from "@prisma/client";
import { ApiError } from "../../utils/ApiError";

/** Accepts either the shared PrismaClient or a transaction client (a PrismaClient is assignable to it). */
export type Db = Prisma.TransactionClient;

export const semesterName = (n: number) => `Semester ${n}`;

/**
 * Makes sure semesters 1..count exist for a program. Only ever adds rows, so shrinking
 * durationYears later never deletes a semester that students or subjects point at.
 */
export async function ensureProgramSemesters(db: Db, programId: string, count: number): Promise<number> {
  const existing = await db.semester.findMany({ where: { programId }, select: { number: true } });
  const have = new Set(existing.map((s) => s.number));
  const missing: { programId: string; number: number; name: string }[] = [];
  for (let n = 1; n <= count; n += 1) {
    if (!have.has(n)) missing.push({ programId, number: n, name: semesterName(n) });
  }
  if (missing.length > 0) {
    await db.semester.createMany({ data: missing, skipDuplicates: true });
  }
  return missing.length;
}

export interface PlacementInput {
  academicSessionId: string;
  departmentId: string;
  programId: string;
  batchId: string;
  semesterId: string;
  sectionId?: string | null;
}

/**
 * The one place that decides whether an academic placement is internally consistent.
 * Registration, promotion, readmission and section transfers all go through it, so the
 * database can never hold a section that belongs to a different program than the student.
 */
export async function resolvePlacement(db: Db, input: PlacementInput) {
  const session = await db.academicSession.findUnique({ where: { id: input.academicSessionId } });
  if (!session) throw ApiError.badRequest("The selected academic session does not exist.");
  if (!session.isActive) {
    throw ApiError.badRequest(`Academic session ${session.label} is inactive. Choose an active session.`);
  }

  const program = await db.program.findUnique({ where: { id: input.programId }, include: { department: true } });
  if (!program || program.department.deletedAt) throw ApiError.badRequest("The selected program does not exist.");
  if (program.departmentId !== input.departmentId) {
    throw ApiError.badRequest("The program does not belong to the selected department.");
  }

  const batch = await db.batch.findUnique({ where: { id: input.batchId } });
  if (!batch) throw ApiError.badRequest("The selected batch does not exist.");
  if (batch.programId !== input.programId) {
    throw ApiError.badRequest("The batch does not belong to the selected program.");
  }

  const semester = await db.semester.findUnique({ where: { id: input.semesterId } });
  if (!semester) throw ApiError.badRequest("The selected semester does not exist.");
  if (semester.programId !== input.programId) {
    throw ApiError.badRequest("The semester does not belong to the selected program.");
  }

  let section = null;
  if (input.sectionId) {
    section = await db.section.findUnique({ where: { id: input.sectionId } });
    if (!section) throw ApiError.badRequest("The selected section does not exist.");
    if (section.batchId !== input.batchId) {
      throw ApiError.badRequest("The section does not belong to the selected batch.");
    }
  }

  return { session, program, batch, semester, section };
}
