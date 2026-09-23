# UniSphere ERP — Attendance / Academic Enrollment Rebuild

This document covers the server-side changes. See `../client/README_ATTENDANCE_REBUILD.md` for the
frontend side. Both zips together are one project (`server/` + `client/`).

## 1. Root causes found in the original project

1. **`faculty.departmentId` was never sent by the API.** The client's Department/Program dropdown
   depended on it, so it stayed on "Loading…" forever. This was the direct cause of the screenshot
   you sent. Fixed in `src/modules/faculty/faculty.service.ts` / `faculty.types.ts`.
2. **No academic-session table with dates.** `AcademicSession` existed but had no `startDate`/
   `endDate`/`isActive`, so nothing could validate an attendance date against it, and the old seed
   derived a session from `new Date().getFullYear()` — a hidden hard-coded default.
3. **`Student` held one mutable `currentSemester`/`sectionId`.** There was no enrollment history, so
   editing a student's semester silently overwrote it, and promotion/readmission/backlog had nowhere
   to live. Attendance loaded students by `sectionId` alone — semester and session were accepted by
   the API but silently ignored.
4. **No relationship validation.** The server never checked that a section belonged to the chosen
   program, or a subject to the chosen semester — the frontend's cascading dropdowns were the only
   thing keeping requests sane, so a handcrafted request could load any student into any class.
5. **Hard-coded periods.** `Period 1: 08:00–09:00` etc. were literal strings in the client; there was
   no `numberOfClasses`/multi-period support.
6. **Authorization gaps.** `GET /attendance/roster` had no filter at all (any signed-in user, any
   class). `insights` and `idcard` routes had no ownership check — any student could read another
   student's data by guessing an ID.
7. **Attendance math.** A 2-period class counted as **one** conducted class; a 401(k)-style duplicate
   check used `sectionId+subjectId+date+period` as a single unique key, so a *cancelled* class could
   never be re-recorded; HOD analytics pulled every `AttendanceRecord` into Node and reduced in
   JavaScript instead of the database.

## 2. What changed (schema)

The Prisma schema change is **purely additive** — verified against your original schema with
`prisma migrate diff`. Nothing is dropped, no column is added `NOT NULL` without a default, except
one intentional index swap (see below). The generated reference SQL is in
`prisma/migrations_reference/001_academic_enrollment_attendance_rebuild.sql` for your own review
before running anything against a real database.

New tables: `Semester`, `PeriodDefinition`, `StudentEnrollment`, `StudentSubjectRegistration`,
`FacultySubjectAssignment`, `AttendanceSlot`, `AttendancePolicy`.
Extended tables: `AcademicSession` (dates, `isActive`), `Student` (registration number, admission
year, guardian fields — the old mutable `currentSemester`/`sectionId` are kept as a **read-only
mirror** of the student's open enrollment so nothing else in your codebase breaks), `Subject`
(`programId`, `semesterId`, `isElective`), `AttendanceSession` (`semesterId`, `departmentId`,
`programId`, `facultyId`, `numberOfClasses`, `startTime`/`endTime`, cancellation fields).

**One non-additive change:** `AttendanceSession`'s unique key on
`(sectionId, subjectId, date, period)` is now a plain index. Duplicate prevention moved to the new
`AttendanceSlot` table (one row per period actually covered, still unique), because the old key
made a *cancelled* class permanently block re-recording. If you'd rather keep the exact original
constraint, you can skip this one line in the reference SQL — nothing else depends on it.

## 3. How to apply this to your database

**Fresh database (nothing in it yet):**
```bash
cd server
npm install
cp .env.example .env      # fill in DATABASE_URL, JWT secrets, etc.
npx prisma migrate dev --name academic_enrollment_attendance_rebuild
npm run prisma:seed         # roles, permissions, attendance policy, one super admin
npm run prisma:seed:demo    # optional: realistic MCA dataset incl. edge cases, see below
```

**Existing database with real data:**
```bash
cd server
npm install
npx prisma migrate dev --name academic_enrollment_attendance_rebuild   # or db push, your call
npm run db:backfill -- --dry-run   # preview: prints exactly what it would change, saves nothing
npm run db:backfill                # apply — runs in ONE transaction; any failure rolls back fully
```
The backfill (`src/scripts/migrateAcademicEnrollment.ts`) is safe to re-run — it only fills in what's
missing. It never deletes or overwrites an existing record. It:
- adds the `attendance:update` permission and the `AttendancePolicy` row if missing;
- fills empty academic-session dates from their years (flagged for your review);
- links legacy subjects to a program/semester where that's unambiguous, and creates each program's
  `Semester` rows;
- creates a `StudentEnrollment` for every student that has none — including closed historical ones
  inferred from old attendance records, so nothing is lost;
- points every legacy `AttendanceRecord` at the enrollment that was open when it was taken;
- backfills `AttendanceSlot` rows and completes `AttendanceSession.departmentId/programId/semesterId`;
- creates `FacultySubjectAssignment` rows from your existing timetable;
- applies two database-level invariants (below).

## 4. Database invariants (not expressible in Prisma's schema language)

Applied by `src/config/dbInvariants.ts`, called on server start-up and by both seed scripts:
- **A student has at most one *open* enrollment** (`endDate IS NULL`) — a partial unique index. This
  is what makes "the student's current class" unambiguous even under concurrent requests.
- `StudentEnrollment.endDate >= admissionDate`, and `AttendanceSession.numberOfClasses BETWEEN 1 AND 12`.

## 5. New / changed API surface

All existing routes keep their paths and response shapes unless noted.
- `GET /academics/sessions`, `POST/PATCH` (admin only) — real sessions with dates, `isActive`, `isCurrent`.
- `GET /academics/semesters?programId=`, `GET/PUT /academics/periods` — the period grid.
- `GET/POST/DELETE /academics/assignments` — faculty↔subject↔section per session.
- `GET /attendance/options?level=semesters|departments|programs|sections|subjects|periods` — every
  cascading dropdown, scoped to what the signed-in user is allowed to see.
- `GET /attendance/students` — the roster (was `GET /attendance/roster`, unscoped; the old route is
  gone rather than aliased on purpose, so nothing keeps calling the unscoped version by accident).
- `POST /attendance`, `GET /attendance/history`, `GET/PUT /attendance/:id`, `POST /attendance/:id/cancel`.
- `GET /attendance/student/:id` (`me` for the signed-in student), `GET /attendance/reports/department`.
- `GET /students/:id/enrollments`, `POST /students/:id/enrollments/{promote,readmit,transfer,close}`,
  `POST /students/:id/subject-registrations` (backlog/elective).
- `PUT /students/:id` now **rejects** `currentSemester`/`sectionId` with a clear message, instead of
  silently overwriting history.

## 6. Testing

```bash
npm run typecheck                  # tsc --noEmit
npm run dev                        # start the API
npm run test:attendance            # ~200 end-to-end checks against a running server (see below)
```
`src/scripts/attendanceE2E.ts` signs its own tokens (doesn't touch the login rate limiter) and cleans
up everything it creates, so it's safe to re-run. It covers: cascading options scoped by role,
roster correctness (session/semester/section/date, late admissions, promotions, backlog, electives),
every relationship-validation error path, concurrent duplicate submission, multi-period classes,
audited corrections with a reason and an edit window, cancellation, HOD analytics cross-checked
against independent SQL, the shortage calculator's exact integer math, and the full student lifecycle
(register → attend → promote → transfer → readmit/repeat → defer).

I ran it against both a fresh database and a copy of legacy-shaped data migrated by the backfill
script (200/200 and 197/197 — the 3-check difference is dataset-dependent assertions, not failures).

## 7. Demo data

`npm run prisma:seed:demo` creates a realistic MCA department: 3 academic sessions, Semester 1–4,
two batches, ~140 students including a late admission, a deferred student, a repeat/readmission, a
backlog student, an elective only some students take, and a section-level faculty override (DBMS is
taught by a different professor in Section B than in Section A). All demo accounts use password
`Demo@1234`; see the script's own console output for the exact list of logins after it runs.

## 8. Known caveat

The sandbox I built this in blocks Prisma's engine-binary CDN, so I could not run your exact
Prisma 5.22 engine at runtime. I checked types against your Prisma 5.22 client, and ran every
runtime test (migration, E2E, UI) against the same schema and code through Prisma 6's driver-adapter
mode instead. Please run `npx prisma generate && npm run test:attendance` yourself once against your
real environment before relying on this in production.
