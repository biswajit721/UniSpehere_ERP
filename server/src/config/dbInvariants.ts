import { Prisma } from "@prisma/client";

/**
 * Database rules that Prisma's schema language cannot express. They are created with plain,
 * idempotent SQL and are safe to run repeatedly (server start-up, seed, and the backfill script
 * all call this):
 *
 *  1. A student has at most ONE open enrollment (endDate IS NULL). This is what guarantees
 *     that "the student's current class" is never ambiguous, even under concurrent requests.
 *  2. An enrollment cannot end before it began.
 *  3. An attendance session covers between 1 and 12 classes.
 */
export async function ensureDatabaseInvariants(prisma: Prisma.TransactionClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "StudentEnrollment_one_open_per_student"
    ON "StudentEnrollment" ("studentId")
    WHERE "endDate" IS NULL
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentEnrollment_dates_chk') THEN
        ALTER TABLE "StudentEnrollment"
          ADD CONSTRAINT "StudentEnrollment_dates_chk"
          CHECK ("endDate" IS NULL OR "endDate" >= "admissionDate");
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceSession_classes_chk') THEN
        ALTER TABLE "AttendanceSession"
          ADD CONSTRAINT "AttendanceSession_classes_chk"
          CHECK ("numberOfClasses" BETWEEN 1 AND 12);
      END IF;
    END $$;
  `);
}
