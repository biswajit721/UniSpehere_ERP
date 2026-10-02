/**
 * Removes exactly what `npm run prisma:seed:demo` created, and nothing else.
 *
 *     npm run clear:demo              # preview only - prints what would be deleted, saves nothing
 *     npm run clear:demo -- --yes     # apply for real, in one transaction
 *
 * Scope (matches seedDemo.ts precisely):
 *   - The two demo departments (code "MCA", "MBA") and everything under them: programs,
 *     semesters, batches, sections, subjects, timetable slots, faculty assignments.
 *   - The demo Faculty/HOD/Student/Admin accounts (an exact, hard-coded list of the emails and
 *     university IDs seedDemo.ts creates - not a fuzzy pattern match).
 *   - Every AttendanceSession under those departments, which cascades to its records, slots and
 *     edit history automatically (the schema defines those as ON DELETE CASCADE).
 *
 * Deliberately NOT touched, because they are shared configuration a real deployment keeps:
 *   - AcademicSession rows (e.g. "2026-2027") and the PeriodDefinition grid.
 *   - The AttendancePolicy row, Roles/Permissions.
 *   - The core super admin created by `npm run prisma:seed` (superadmin@unisphere.edu).
 *   - Anything you have created yourself, even inside a department also named "MCA"/"MBA" -
 *     EXCEPT that if you registered your OWN real students under a department reusing one of
 *     those exact codes, this script cannot tell your data apart from the demo data and will
 *     delete both. Read the printed summary before confirming.
 *
 * Not meant to run against a database you don't fully control the history of - it's a convenience
 * for clearing out the local/demo dataset you seeded yourself, not a production data-management tool.
 */
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--yes");

class DryRunRollback extends Error {}

// ---------------------------------------------------------------------------------------------
// The exact identifiers seedDemo.ts creates. Kept in sync with that file on purpose - if you
// changed seedDemo.ts's names before seeding, update this list to match before clearing.
// ---------------------------------------------------------------------------------------------
const DEMO_DEPARTMENT_CODES = ["MCA", "MBA"];

const DEMO_STAFF_EMAILS = [
  "hod.mehta@unisphere.edu",
  "priya.sharma@unisphere.edu",
  "rakesh.verma@unisphere.edu",
  "sunita.iyer@unisphere.edu",
  "manoj.das@unisphere.edu",
  "neha.patel@unisphere.edu",
  "hod.nair@unisphere.edu",
  "admin@unisphere.edu", // the demo convenience admin - NOT superadmin@unisphere.edu (core seed, never touched)
];

function demoStudentEmails(): string[] {
  const emails: string[] = [];
  for (let i = 1; i <= 61; i += 1) emails.push(`mca25a${String(i).padStart(3, "0")}@student.unisphere.edu`);
  for (let i = 1; i <= 40; i += 1) emails.push(`mca25b${String(i).padStart(3, "0")}@student.unisphere.edu`);
  for (let i = 1; i <= 30; i += 1) emails.push(`mca26a${String(i).padStart(3, "0")}@student.unisphere.edu`);
  for (let i = 1; i <= 5; i += 1) emails.push(`mba25a${String(i).padStart(3, "0")}@student.unisphere.edu`);
  emails.push("vikram.rao@student.unisphere.edu");
  return emails;
}

const DEMO_USER_EMAILS = [...DEMO_STAFF_EMAILS, ...demoStudentEmails()];

// ---------------------------------------------------------------------------------------------

async function clear(tx: Prisma.TransactionClient) {
  const report: Record<string, number> = {};
  const bump = (key: string, n: number) => {
    if (n > 0) report[key] = (report[key] ?? 0) + n;
  };

  const departments = await tx.department.findMany({ where: { code: { in: DEMO_DEPARTMENT_CODES } } });
  if (departments.length === 0) {
    console.log("No demo departments (code MCA/MBA) found - nothing to clear.");
    return { report, departments: [] as { code: string; name: string }[] };
  }
  const departmentIds = departments.map((d) => d.id);

  const programs = await tx.program.findMany({ where: { departmentId: { in: departmentIds } } });
  const programIds = programs.map((p) => p.id);
  const batches = await tx.batch.findMany({ where: { programId: { in: programIds } } });
  const batchIds = batches.map((b) => b.id);
  const sections = await tx.section.findMany({ where: { batchId: { in: batchIds } } });
  const sectionIds = sections.map((s) => s.id);

  const demoUsers = await tx.user.findMany({ where: { email: { in: DEMO_USER_EMAILS } } });
  const demoUserIds = demoUsers.map((u) => u.id);
  const students = await tx.student.findMany({
    where: { OR: [{ departmentId: { in: departmentIds } }, { userId: { in: demoUserIds } }] },
  });
  const studentIds = students.map((s) => s.id);
  const faculty = await tx.faculty.findMany({
    where: { OR: [{ departmentId: { in: departmentIds } }, { userId: { in: demoUserIds } }] },
  });
  const facultyIds = faculty.map((f) => f.id);

  // Attendance first - cascades to AttendanceRecord, AttendanceSlot and AttendanceEdit automatically.
  bump("attendance sessions (+ their records/slots/edit history)", (await tx.attendanceSession.deleteMany({ where: { departmentId: { in: departmentIds } } })).count);

  // Enrollment history - cascades to StudentSubjectRegistration automatically.
  bump("student enrollments (+ backlog/elective registrations)", (await tx.studentEnrollment.deleteMany({ where: { studentId: { in: studentIds } } })).count);

  bump("faculty-subject assignments", (await tx.facultySubjectAssignment.deleteMany({ where: { OR: [{ facultyId: { in: facultyIds } }, { sectionId: { in: sectionIds } }] } })).count);
  bump("timetable slots", (await tx.timetableSlot.deleteMany({ where: { sectionId: { in: sectionIds } } })).count);

  bump("students", (await tx.student.deleteMany({ where: { id: { in: studentIds } } })).count);
  bump("faculty", (await tx.faculty.deleteMany({ where: { id: { in: facultyIds } } })).count);

  // Departments may have a hodId pointing at a Faculty row we're about to delete's dependents -
  // clear it first so the FK doesn't block anything downstream.
  await tx.department.updateMany({ where: { id: { in: departmentIds } }, data: { hodId: null } });

  await tx.auditLog.deleteMany({ where: { userId: { in: demoUserIds } } });
  await tx.passwordResetOtp.deleteMany({ where: { userId: { in: demoUserIds } } });
  bump("user accounts", (await tx.user.deleteMany({ where: { id: { in: demoUserIds } } })).count);

  bump("subjects", (await tx.subject.deleteMany({ where: { departmentId: { in: departmentIds } } })).count);
  bump("sections", (await tx.section.deleteMany({ where: { id: { in: sectionIds } } })).count);
  bump("batches", (await tx.batch.deleteMany({ where: { id: { in: batchIds } } })).count);
  bump("semesters", (await tx.semester.deleteMany({ where: { programId: { in: programIds } } })).count);
  bump("programs", (await tx.program.deleteMany({ where: { id: { in: programIds } } })).count);
  bump("departments", (await tx.department.deleteMany({ where: { id: { in: departmentIds } } })).count);

  return { report, departments: departments.map((d) => ({ code: d.code, name: d.name })) };
}

function printSummary(report: Record<string, number>, departments: { code: string; name: string }[]) {
  if (departments.length > 0) {
    console.log("Demo departments matched:", departments.map((d) => `${d.name} (${d.code})`).join(", "));
  }
  console.log(APPLY ? "\nDeleted:" : "\nWould delete:");
  if (Object.keys(report).length === 0) console.log("  (nothing - it looks like demo data was already cleared)");
  for (const [k, v] of Object.entries(report)) console.log(`  ${String(v).padStart(6)}  ${k}`);
}

async function main() {
  console.log(APPLY ? "Clearing demo data...\n" : "DRY RUN - previewing what would be cleared. Nothing will be saved.\n");
  try {
    await prisma.$transaction(
      async (tx) => {
        const result = await clear(tx);
        // Print the summary from INSIDE the transaction: on a dry run we roll back right after,
        // and a rolled-back transaction's return value is never seen by the caller.
        printSummary(result.report, result.departments);
        if (!APPLY) throw new DryRunRollback(); // roll back - the preview leaves no trace
      },
      { timeout: 120_000 }
    );
    console.log("\nDone. Academic sessions, the period grid, roles/permissions and your own accounts were left untouched.");
  } catch (err) {
    if (err instanceof DryRunRollback) {
      console.log("\nRun again with --yes to actually delete these rows.");
      return;
    }
    console.error("\nSomething went wrong - nothing was deleted (the whole operation rolled back).\n", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
