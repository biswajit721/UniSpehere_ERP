-- CreateEnum
CREATE TYPE "EnrollmentType" AS ENUM ('REGULAR', 'LATERAL', 'PROMOTION', 'READMISSION', 'REPEAT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PROMOTED', 'COMPLETED', 'REPEATED', 'DETAINED', 'DEFERRED', 'WITHDRAWN', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "ReadmissionReason" AS ENUM ('BACKLOG', 'ACADEMIC_REPEAT', 'OTHER');

-- CreateEnum
CREATE TYPE "SubjectRegistrationType" AS ENUM ('BACKLOG', 'ELECTIVE');

-- CreateEnum
CREATE TYPE "AttendanceSessionStatus" AS ENUM ('SUBMITTED', 'CANCELLED');

-- DropIndex
DROP INDEX "AttendanceSession_sectionId_subjectId_date_period_key";

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "admissionYear" INTEGER,
ADD COLUMN     "guardianName" TEXT,
ADD COLUMN     "guardianPhone" TEXT,
ADD COLUMN     "guardianRelation" TEXT,
ADD COLUMN     "registrationNumber" TEXT;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "isElective" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "programId" TEXT,
ADD COLUMN     "semesterId" TEXT;

-- AlterTable
ALTER TABLE "AcademicSession" ADD COLUMN     "endDate" DATE,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "startDate" DATE;

-- AlterTable
ALTER TABLE "AttendanceSession" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "facultyId" TEXT,
ADD COLUMN     "numberOfClasses" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "programId" TEXT,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "semesterId" TEXT,
ADD COLUMN     "startTime" TEXT,
ADD COLUMN     "status" "AttendanceSessionStatus" NOT NULL DEFAULT 'SUBMITTED';

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "enrollmentId" TEXT,
ADD COLUMN     "markedById" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AttendancePolicy" ADD COLUMN     "allowFutureAttendance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enforceSessionDates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "facultyEditWindowDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "maxClassesPerSession" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "Semester" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodDefinition" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "label" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentEnrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "sectionId" TEXT,
    "admissionYear" INTEGER NOT NULL,
    "admissionDate" DATE NOT NULL,
    "endDate" DATE,
    "enrollmentType" "EnrollmentType" NOT NULL DEFAULT 'REGULAR',
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "readmissionReason" "ReadmissionReason",
    "reasonNote" TEXT,
    "previousEnrollmentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSubjectRegistration" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "type" "SubjectRegistrationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentSubjectRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacultySubjectAssignment" (
    "id" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacultySubjectAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSlot" (
    "id" TEXT NOT NULL,
    "attendanceSessionId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "periodNumber" INTEGER NOT NULL,

    CONSTRAINT "AttendanceSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Semester_programId_number_key" ON "Semester"("programId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodDefinition_number_key" ON "PeriodDefinition"("number");

-- CreateIndex
CREATE INDEX "StudentEnrollment_academicSessionId_semesterId_sectionId_idx" ON "StudentEnrollment"("academicSessionId", "semesterId", "sectionId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_studentId_endDate_idx" ON "StudentEnrollment"("studentId", "endDate");

-- CreateIndex
CREATE INDEX "StudentEnrollment_programId_batchId_idx" ON "StudentEnrollment"("programId", "batchId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_departmentId_academicSessionId_idx" ON "StudentEnrollment"("departmentId", "academicSessionId");

-- CreateIndex
CREATE INDEX "StudentSubjectRegistration_subjectId_sectionId_academicSess_idx" ON "StudentSubjectRegistration"("subjectId", "sectionId", "academicSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSubjectRegistration_enrollmentId_subjectId_key" ON "StudentSubjectRegistration"("enrollmentId", "subjectId");

-- CreateIndex
CREATE INDEX "FacultySubjectAssignment_facultyId_academicSessionId_idx" ON "FacultySubjectAssignment"("facultyId", "academicSessionId");

-- CreateIndex
CREATE INDEX "FacultySubjectAssignment_sectionId_academicSessionId_idx" ON "FacultySubjectAssignment"("sectionId", "academicSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "FacultySubjectAssignment_academicSessionId_subjectId_sectio_key" ON "FacultySubjectAssignment"("academicSessionId", "subjectId", "sectionId", "facultyId");

-- CreateIndex
CREATE INDEX "AttendanceSlot_attendanceSessionId_idx" ON "AttendanceSlot"("attendanceSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSlot_sectionId_subjectId_date_periodNumber_key" ON "AttendanceSlot"("sectionId", "subjectId", "date", "periodNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Student_registrationNumber_key" ON "Student"("registrationNumber");

-- CreateIndex
CREATE INDEX "Subject_programId_semesterId_idx" ON "Subject"("programId", "semesterId");

-- CreateIndex
CREATE INDEX "AttendanceSession_sectionId_subjectId_date_period_idx" ON "AttendanceSession"("sectionId", "subjectId", "date", "period");

-- CreateIndex
CREATE INDEX "AttendanceSession_academicSessionId_semesterId_programId_se_idx" ON "AttendanceSession"("academicSessionId", "semesterId", "programId", "sectionId", "date");

-- CreateIndex
CREATE INDEX "AttendanceSession_departmentId_date_idx" ON "AttendanceSession"("departmentId", "date");

-- CreateIndex
CREATE INDEX "AttendanceSession_facultyId_date_idx" ON "AttendanceSession"("facultyId", "date");

-- CreateIndex
CREATE INDEX "AttendanceSession_subjectId_date_idx" ON "AttendanceSession"("subjectId", "date");

-- CreateIndex
CREATE INDEX "AttendanceSession_sectionId_date_idx" ON "AttendanceSession"("sectionId", "date");

-- CreateIndex
CREATE INDEX "AttendanceRecord_enrollmentId_idx" ON "AttendanceRecord"("enrollmentId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_studentId_attendanceSessionId_status_idx" ON "AttendanceRecord"("studentId", "attendanceSessionId", "status");

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Semester" ADD CONSTRAINT "Semester_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_previousEnrollmentId_fkey" FOREIGN KEY ("previousEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubjectRegistration" ADD CONSTRAINT "StudentSubjectRegistration_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubjectRegistration" ADD CONSTRAINT "StudentSubjectRegistration_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubjectRegistration" ADD CONSTRAINT "StudentSubjectRegistration_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacultySubjectAssignment" ADD CONSTRAINT "FacultySubjectAssignment_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacultySubjectAssignment" ADD CONSTRAINT "FacultySubjectAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacultySubjectAssignment" ADD CONSTRAINT "FacultySubjectAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacultySubjectAssignment" ADD CONSTRAINT "FacultySubjectAssignment_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacultySubjectAssignment" ADD CONSTRAINT "FacultySubjectAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSlot" ADD CONSTRAINT "AttendanceSlot_attendanceSessionId_fkey" FOREIGN KEY ("attendanceSessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSlot" ADD CONSTRAINT "AttendanceSlot_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSlot" ADD CONSTRAINT "AttendanceSlot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

