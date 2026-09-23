/**
 * End-to-end test of the Academic -> Enrollment -> Attendance workflow against a RUNNING server.
 *
 *   1. npm run prisma:seed && npm run prisma:seed:demo     (once)
 *   2. npm run dev                                         (in another terminal)
 *   3. npm run test:attendance
 *
 * Environment:  API_URL (default http://localhost:<PORT>/api)   E2E_DATE (YYYY-MM-DD, only if your
 * system clock is earlier than 2026-09-12 - see the note in main()).
 *
 * The test signs access tokens directly (same secret as the server), so it does not use up the login
 * rate limit, and it cleans up everything it created before AND after a run, so it can be repeated.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { env } from "../config/env";
import { signAccessToken } from "../utils/jwt";
import { addDays, formatDateOnly, parseDateOnly, todayDateOnly, weekdayCode } from "../utils/dates";

const prisma = new PrismaClient();
const BASE = process.env.API_URL ?? `http://localhost:${env.port}/api`;
const MARK = "[e2e]";

let passed = 0;
let failed = 0;
const failures: string[] = [];
let section = "";

function heading(title: string) {
  section = title;
  console.log(`\n${title}`);
}
function check(name: string, ok: unknown, detail?: unknown) {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    const d = detail === undefined ? "" : `  -> ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300)}`;
    failures.push(`[${section}] ${name}${d}`);
    console.log(`  ✗ ${name}${d}`);
  }
}

type Res<T = any> = { status: number; data: T };
async function call<T = any>(token: string | null, method: string, path: string, body?: unknown, raw = false): Promise<Res<T>> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (raw) return { status: res.status, data: { contentType: res.headers.get("content-type"), bytes: (await res.arrayBuffer()).byteLength } as any };
  const text = await res.text();
  let data: any = text;
  try { data = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, data };
}

async function tokenFor(email: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { role: true } });
  return signAccessToken({ userId: user.id, roleId: user.roleId, roleName: user.role.name });
}
const qs = (o: Record<string, unknown>) =>
  "?" + Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");

// --------------------------------------------------------------------------------------------------
async function cleanup() {
  const marked = await prisma.attendanceSession.findMany({ where: { remarks: { startsWith: MARK } }, select: { id: true } });
  if (marked.length) await prisma.attendanceSession.deleteMany({ where: { id: { in: marked.map((m) => m.id) } } });

  const users = await prisma.user.findMany({ where: { email: { startsWith: "e2e." } }, include: { student: true } });
  for (const u of users) {
    if (u.student) {
      await prisma.attendanceRecord.deleteMany({ where: { studentId: u.student.id } });
      await prisma.studentSubjectRegistration.deleteMany({ where: { enrollment: { studentId: u.student.id } } });
      await prisma.studentEnrollment.updateMany({ where: { studentId: u.student.id }, data: { previousEnrollmentId: null } });
      await prisma.studentEnrollment.deleteMany({ where: { studentId: u.student.id } });
      await prisma.student.delete({ where: { id: u.student.id } });
    }
    await prisma.auditLog.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }
  await prisma.facultySubjectAssignment.deleteMany({ where: { subject: { code: { startsWith: "E2E" } } } });
  await prisma.subject.deleteMany({ where: { code: { startsWith: "E2E" } } });
  await prisma.academicSession.deleteMany({ where: { label: "2090-2091" } });
  // registrations the test made on seeded students
  await prisma.studentSubjectRegistration.deleteMany({ where: { enrollment: { student: { rollNumber: "MCA25A001" } } } });
}

// brute-force reference implementations (deliberately independent of the SQL in the app)
async function bruteStudentTotals(studentId: string, policyExcused: boolean, filter: { sessionId?: string } = {}) {
  const rows = await prisma.attendanceRecord.findMany({
    where: { studentId, attendanceSession: { status: "SUBMITTED", ...(filter.sessionId && { academicSessionId: filter.sessionId }) } },
    include: { attendanceSession: true },
  });
  let conducted = 0, present = 0;
  for (const r of rows) {
    conducted += r.attendanceSession.numberOfClasses;
    if (r.status === "PRESENT" || r.status === "LATE" || (r.status === "EXCUSED" && policyExcused)) present += r.attendanceSession.numberOfClasses;
  }
  return { conducted, present };
}
const pct = (p: number, c: number) => (c > 0 ? Math.round((p / c) * 1000) / 10 : 0);

// --------------------------------------------------------------------------------------------------
async function main() {
  console.log(`API: ${BASE}`);
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health || !health.ok) {
    console.error(`\nCannot reach the server at ${BASE}. Start it with "npm run dev" first.`);
    process.exit(2);
  }
  await cleanup();

  // ------------------------------------------------------------------------------- dates
  const today = process.env.E2E_DATE ?? todayDateOnly();
  const lastWeekday = (code: "THU" | "FRI") => {
    let d = parseDateOnly(today);
    while (weekdayCode(d) !== code) d = addDays(d, -1);
    return formatDateOnly(d);
  };
  const FRI = lastWeekday("FRI");
  const THU = lastWeekday("THU");
  // The seeded history ends on 2026-09-04, so the test dates must come after it.
  if (THU <= "2026-09-04" || FRI <= "2026-09-04") {
    console.error(`Your system date (${today}) is too early for the demo data (history ends 2026-09-04). Re-run with E2E_DATE=2026-09-19 (or later).`);
    process.exit(2);
  }
  console.log(`Test dates: Friday ${FRI}, Thursday ${THU}, today ${today}`);

  // ------------------------------------------------------------------------------- reference ids
  const S = {
    y2526: await prisma.academicSession.findUniqueOrThrow({ where: { label: "2025-2026" } }),
    y2627: await prisma.academicSession.findUniqueOrThrow({ where: { label: "2026-2027" } }),
  };
  const dept = await prisma.department.findUniqueOrThrow({ where: { code: "MCA" } });
  const mgmt = await prisma.department.findUniqueOrThrow({ where: { code: "MBA" } });
  const program = await prisma.program.findFirstOrThrow({ where: { name: "MCA", departmentId: dept.id } });
  const mba = await prisma.program.findFirstOrThrow({ where: { name: "MBA", departmentId: mgmt.id } });
  const sem = async (programId: string, n: number) => (await prisma.semester.findUniqueOrThrow({ where: { programId_number: { programId, number: n } } })).id;
  const sem1 = await sem(program.id, 1), sem2 = await sem(program.id, 2), sem3 = await sem(program.id, 3), sem4 = await sem(program.id, 4);
  const batch25 = await prisma.batch.findFirstOrThrow({ where: { programId: program.id, label: "2025-2027" } });
  const batch26 = await prisma.batch.findFirstOrThrow({ where: { programId: program.id, label: "2026-2028" } });
  const secA = await prisma.section.findUniqueOrThrow({ where: { batchId_name: { batchId: batch25.id, name: "A" } } });
  const secB = await prisma.section.findUniqueOrThrow({ where: { batchId_name: { batchId: batch25.id, name: "B" } } });
  const secA26 = await prisma.section.findUniqueOrThrow({ where: { batchId_name: { batchId: batch26.id, name: "A" } } });
  const mbaBatch = await prisma.batch.findFirstOrThrow({ where: { programId: mba.id } });
  const mbaSecA = await prisma.section.findFirstOrThrow({ where: { batchId: mbaBatch.id } });
  const subj = (code: string) => prisma.subject.findUniqueOrThrow({ where: { code } });
  const DBMS = await subj("MCA301"), JAVA = await subj("MCA302"), AI = await subj("MCA304"), DA = await subj("MCA306"), C = await subj("MCA101"), OOP = await subj("MCA201"), MKT = await subj("MBA301");
  const policy = await prisma.attendancePolicy.findFirstOrThrow();

  const T = {
    sharma: await tokenFor("priya.sharma@unisphere.edu"),
    verma: await tokenFor("rakesh.verma@unisphere.edu"),
    patel: await tokenFor("neha.patel@unisphere.edu"),
    hod: await tokenFor("hod.mehta@unisphere.edu"),
    hodMgmt: await tokenFor("hod.nair@unisphere.edu"),
    admin: await tokenFor("admin@unisphere.edu"),
    amit: await tokenFor("mca25a001@student.unisphere.edu"),
    rahul: await tokenFor("mca25b012@student.unisphere.edu"),
    sneha: await tokenFor("mca25a017@student.unisphere.edu"),
  };
  const student = (roll: string) => prisma.student.findUniqueOrThrow({ where: { rollNumber: roll }, include: { user: true } });
  const amit = await student("MCA25A001");
  const rahul = await student("MCA25B012");

  const classBody = (extra: Record<string, unknown> = {}) => ({
    academicSessionId: S.y2627.id, semesterId: sem3, departmentId: dept.id, programId: program.id,
    sectionId: secA.id, subjectId: DBMS.id, date: FRI, period: 1, numberOfClasses: 1, ...extra,
  });

  // =============================================================================================
  heading("1. The original bug: faculty profile now carries departmentId");
  {
    const me = await call(T.sharma, "GET", "/faculty/me");
    check("GET /faculty/me returns departmentId (was missing -> 'Loading...' forever)", me.data?.faculty?.departmentId === dept.id, me.data);
    const mine = await call(T.sharma, "GET", "/faculty/assignments" + qs({ academicSessionId: S.y2627.id }));
    const labels = (mine.data.assignments ?? []).map((a: any) => `${a.subject.code}/${a.section.name}`).sort();
    check("GET /faculty/assignments lists only Dr Sharma's classes", JSON.stringify(labels) === JSON.stringify(["MCA301/A", "MCA304/B", "MCA306/A"]), labels);
  }

  // =============================================================================================
  heading("2. Academic sessions come from the database - nothing is hard-coded");
  {
    const r = await call(T.sharma, "GET", "/academics/sessions" + qs({ activeOnly: "true" }));
    const labels = (r.data.sessions ?? []).map((s: any) => s.label);
    check("sessions 2025-2026, 2026-2027, 2027-2028 are returned", ["2025-2026", "2026-2027", "2027-2028"].every((l) => labels.includes(l)), labels);
    check("exactly one session is flagged current (a hint - the UI must not pre-select it)", r.data.sessions.filter((s: any) => s.isCurrent).length === 1);
    check("sessions carry start/end dates", r.data.sessions.every((s: any) => s.startDate && s.endDate));
  }

  // =============================================================================================
  heading("3. Cascading options are derived from the academic structure and the user's role");
  {
    const opt = (t: string, q: Record<string, unknown>) => call(t, "GET", "/attendance/options" + qs({ academicSessionId: S.y2627.id, ...q }));
    const sems = await opt(T.sharma, { level: "semesters" });
    check("Dr Sharma sees only Semester 3", JSON.stringify(sems.data.options.map((o: any) => o.number)) === "[3]", sems.data);
    const deps = await opt(T.sharma, { level: "departments", semesterNumber: 3 });
    check("departments for Semester 3 -> Computer Applications only", deps.data.options.length === 1 && deps.data.options[0].id === dept.id, deps.data);
    const progs = await opt(T.sharma, { level: "programs", semesterNumber: 3, departmentId: dept.id });
    check("programs carry the resolved semesterId", progs.data.options[0]?.id === program.id && progs.data.options[0]?.semesterId === sem3, progs.data);
    const secs = await opt(T.sharma, { level: "sections", semesterId: sem3, programId: program.id });
    const demoSections = secs.data.options.filter((o: any) => o.batchLabel === "2025-2027").map((o: any) => o.name);
    check("sections A and B of batch 2025-2027 are offered", demoSections.join() === "A,B", secs.data);
    const subA = await opt(T.sharma, { level: "subjects", semesterId: sem3, sectionId: secA.id });
    check("Section A subjects for Sharma: DBMS + the elective", subA.data.options.map((o: any) => o.code).sort().join() === "MCA301,MCA306", subA.data);
    const subB = await opt(T.sharma, { level: "subjects", semesterId: sem3, sectionId: secB.id });
    check("Section B: Sharma teaches AI only - DBMS is overridden to Verma", subB.data.options.map((o: any) => o.code).join() === "MCA304", subB.data);
    const vB = await opt(T.verma, { level: "subjects", semesterId: sem3, sectionId: secB.id });
    check("Verma sees Java + DBMS in Section B", vB.data.options.map((o: any) => o.code).sort().join() === "MCA302,MCA301".split(",").sort().join(), vB.data);
    const hodSems = await opt(T.hod, { level: "semesters" });
    const hodNums = hodSems.data.options.map((o: any) => o.number);
    check("HOD sees Semesters 1 and 3 of their department", hodNums.includes(1) && hodNums.includes(3), hodSems.data);
    const adminDeps = await opt(T.admin, { level: "departments", semesterNumber: 3 });
    check("Admin sees both departments", adminDeps.data.options.length === 2, adminDeps.data);
    check("Students cannot read attendance options (403)", (await opt(T.amit, { level: "semesters" })).status === 403);
    check("Missing parent selection is a 400, not an empty guess", (await opt(T.sharma, { level: "programs" })).status === 400);

    const pFri = await call(T.sharma, "GET", "/attendance/options" + qs({ level: "periods", academicSessionId: S.y2627.id, sectionId: secA.id, subjectId: DBMS.id, date: FRI }));
    const p1 = pFri.data.periods?.[0];
    check("period grid comes from the database (6 periods)", pFri.data.periods?.length === 6, pFri.data);
    check("Friday DBMS is scheduled at Period 1 by the timetable", p1?.number === 1 && p1?.scheduled === true && p1?.startTime === "08:00" && p1?.endTime === "09:00", p1);
    check("Period 2 is selectable but not scheduled", pFri.data.periods?.[1]?.scheduled === false);
    const pThu = await call(T.verma, "GET", "/attendance/options" + qs({ level: "periods", academicSessionId: S.y2627.id, sectionId: secA.id, subjectId: JAVA.id, date: THU }));
    check("Thursday Java lab spans P5-P6 (suggests 2 classes)", pThu.data.periods?.[4]?.scheduledClasses === 2 && pThu.data.periods?.[5]?.scheduled === true, pThu.data.periods?.slice(4));
  }

  // =============================================================================================
  heading("4. Roster: only students enrolled in THAT session + semester + section ON THAT DATE");
  {
    const r = await call(T.sharma, "GET", "/attendance/students" + qs(classBody()));
    check("Semester 3 / Section A / DBMS loads exactly 60 students", r.status === 200 && r.data.total === 60, [r.status, r.data.total ?? r.data]);
    const names = new Set((r.data.students ?? []).map((s: any) => s.rollNumber));
    check("late admission (Farhan, joined 20 Aug) is included on 18 Sep", names.has("MCA25A060"));
    check("deferred student (left 15 Aug) is excluded", !names.has("MCA25A061"));
    check("Rahul (moved to Section B) is not in Section A's list", !names.has("MCA25B012"));
    check("students are ordered by roll number", (r.data.students ?? []).map((s: any) => s.rollNumber).join() === [...names].sort().join());
    check("default status follows policy (ABSENT)", r.data.defaultStatus === "ABSENT");
    check("nothing has been submitted yet", r.data.existing === null);
    check("class context echoes labels + computed class times", r.data.class?.startTime === "08:00" && r.data.class?.endTime === "09:00" && r.data.class?.classes?.length === 1, r.data.class);

    const early = await call(T.sharma, "GET", "/attendance/students" + qs(classBody({ date: "2026-08-12", period: 4 })));
    const earlyRolls = new Set((early.data.students ?? []).map((s: any) => s.rollNumber));
    check("on 12 Aug the deferred student WAS enrolled and Farhan was NOT", earlyRolls.has("MCA25A061") && !earlyRolls.has("MCA25A060"), early.data.total);

    const el = await call(T.sharma, "GET", "/attendance/students" + qs(classBody({ subjectId: DA.id })));
    check("elective class lists only its 12 registered students", el.data.total === 12 && el.data.students.every((s: any) => s.kind === "ELECTIVE"), el.data.total ?? el.data);

    const s1 = await call(T.patel, "GET", "/attendance/students" + qs({ ...classBody({ semesterId: sem1, sectionId: secA26.id, subjectId: C.id, date: FRI, period: 1 }) }));
    const s1rolls = new Map((s1.data.students ?? []).map((s: any) => [s.rollNumber, s.kind]));
    check("Semester 1 class = 30 regular + 1 repeater + 1 backlog student (32)", s1.data.total === 32, s1.data.total ?? s1.data);
    check("Sneha (Semester 3) appears in the Semester 1 class as BACKLOG", s1rolls.get("MCA25A017") === "BACKLOG");
    check("Vikram (repeater) appears as a regular member of his new section", s1rolls.get("MCA26R001") === "REGULAR");
  }

  // =============================================================================================
  heading("5. The backend rejects every invalid combination");
  {
    const expect = async (name: string, res: Res, status: number, includes?: string) =>
      check(name, res.status === status && (!includes || String(res.data?.message ?? "").includes(includes)), [res.status, res.data?.message]);
    const roster = (t: string, body: Record<string, unknown>) => call(t, "GET", "/attendance/students" + qs(body));

    await expect("wrong subject (Semester 1 subject in Semester 3) -> 400", await roster(T.sharma, classBody({ subjectId: C.id })), 400, "Subject is not assigned to this semester");
    await expect("wrong section (MBA section with the MCA program) -> 400", await roster(T.sharma, classBody({ sectionId: mbaSecA.id })), 400, "Section does not belong to the selected program");
    await expect("wrong semester (Semester 4 for a Semester 3 subject) -> 400", await roster(T.sharma, classBody({ semesterId: sem4 })), 400, "Subject is not assigned to this semester");
    await expect("program from another department -> 400", await roster(T.sharma, classBody({ departmentId: mgmt.id })), 400, "Program does not belong to the selected department");
    await expect("semester of another program -> 400", await roster(T.sharma, classBody({ semesterId: await sem(mba.id, 3) })), 400, "Semester does not belong to the selected program");
    await expect("wrong faculty (Sharma, DBMS in Section B) -> 403", await roster(T.sharma, classBody({ sectionId: secB.id })), 403, "Faculty is not assigned");
    await expect("faculty from another department (Sharma, MBA class) -> 400/403", await roster(T.sharma, { academicSessionId: S.y2627.id, semesterId: await sem(mba.id, 3), departmentId: mgmt.id, programId: mba.id, sectionId: mbaSecA.id, subjectId: MKT.id, date: FRI, period: 1, numberOfClasses: 1 }), 403);
    await expect("HOD of another department -> 403", await roster(T.hod, { academicSessionId: S.y2627.id, semesterId: await sem(mba.id, 3), departmentId: mgmt.id, programId: mba.id, sectionId: mbaSecA.id, subjectId: MKT.id, date: FRI, period: 1, numberOfClasses: 1 }), 403, "own department");
    await expect("different academic session: date outside its window -> 400", await roster(T.sharma, classBody({ academicSessionId: S.y2526.id })), 400, "Academic session does not match attendance date");
    await expect("future date -> 400", await roster(T.sharma, classBody({ date: formatDateOnly(addDays(parseDateOnly(today), 3)) })), 400, "future date");
    await expect("a period that is not in the grid -> 400", await roster(T.sharma, classBody({ period: 9 })), 400, "not part of the period grid");
    await expect("3 classes cannot start at Period 5 of a 6-period grid -> 400", await roster(T.sharma, classBody({ period: 5, numberOfClasses: 3 })), 400, "no Period 7");
    await expect("more classes than the policy allows -> 400", await roster(T.sharma, classBody({ numberOfClasses: 6 })), 400);
    await expect("end time before start time -> 400", await roster(T.sharma, classBody({ startTime: "10:00", endTime: "09:00" })), 400, "End time must be after start time");
    await expect("not a real calendar date -> 400", await roster(T.sharma, classBody({ date: "2026-02-31" })), 400);
    await expect("students cannot load a class list (privacy) -> 403", await roster(T.amit, classBody()), 403);
    await expect("no such subject id -> 400", await roster(T.sharma, classBody({ subjectId: "00000000-0000-4000-8000-000000000000" })), 400);
  }

  // =============================================================================================
  heading("6. Submit attendance (section 40 workflow): 60 students, 55 present, 5 absent");
  let dbmsSessionId = "";
  const amitBefore = await bruteStudentTotals(amit.id, policy.countExcusedAsPresent);
  let absentStudentId = "";
  {
    const r = await call(T.sharma, "GET", "/attendance/students" + qs(classBody()));
    const roster: any[] = r.data.students;
    // Select-all-present, then untick five: positions 2..6 (Amit at position 1 stays present)
    const absentSet = new Set(roster.slice(1, 6).map((s) => s.studentId));
    absentStudentId = roster[1].studentId;
    const records = roster.map((s) => ({ studentId: s.studentId, status: absentSet.has(s.studentId) ? "ABSENT" : "PRESENT" }));

    const bad1 = await call(T.sharma, "POST", "/attendance", { ...classBody({ remarks: MARK }), records: records.slice(1) });
    check("payload missing a student -> 400 (nobody silently skipped)", bad1.status === 400 && /missing/.test(bad1.data.message), bad1.data);
    const stranger = (await prisma.studentEnrollment.findFirstOrThrow({ where: { sectionId: secB.id, academicSessionId: S.y2627.id } })).studentId;
    const bad2 = await call(T.sharma, "POST", "/attendance", { ...classBody({ remarks: MARK }), records: [...records.slice(1), { studentId: stranger, status: "PRESENT" }] });
    check("student from another section in the payload -> 400", bad2.status === 400 && /not enrolled/.test(bad2.data.message), bad2.data);
    const bad3 = await call(T.sharma, "POST", "/attendance", { ...classBody({ remarks: MARK }), records: [...records, records[0]] });
    check("same student twice -> 400", bad3.status === 400, bad3.data);
    const bad4 = await call(T.verma, "POST", "/attendance", { ...classBody({ remarks: MARK }), records });
    check("a faculty member not assigned to the class cannot submit it (403)", bad4.status === 403, bad4.data);

    const ok = await call(T.sharma, "POST", "/attendance", { ...classBody({ remarks: MARK }), records });
    dbmsSessionId = ok.data.attendance?.id;
    check("submit succeeds (201)", ok.status === 201, ok.data);
    check("summary: total 60, present 55, absent 5, 91.7%", ok.data.attendance?.total === 60 && ok.data.attendance?.present === 55 && ok.data.attendance?.absent === 5 && ok.data.attendance?.percentage === 91.7, ok.data.attendance);

    const dup = await call(T.sharma, "POST", "/attendance", { ...classBody({ remarks: MARK }), records });
    check("duplicate submit -> 409 'already submitted' + the id to open", dup.status === 409 && /already been submitted/.test(dup.data.message) && dup.data.details?.attendanceId === dbmsSessionId, dup.data);
    const again = await call(T.sharma, "GET", "/attendance/students" + qs(classBody()));
    check("loading the same class again reports the existing sheet", again.data.existing?.id === dbmsSessionId && again.data.students.length === 0, again.data.existing);

    const cover = await call(T.sharma, "GET", "/attendance/students" + qs(classBody({ period: 1, numberOfClasses: 2 })));
    check("a 2-class span that touches the taken period is also blocked", cover.data.existing?.id === dbmsSessionId, cover.data.existing);

    // ---- the student's own view
    const rows = await call(T.amit, "GET", "/attendance/student/me" + qs({ view: "summary", academicSessionId: S.y2627.id }));
    const dbmsRow = rows.data.subjects?.find((s: any) => s.code === "MCA301");
    const amitAfter = await bruteStudentTotals(amit.id, policy.countExcusedAsPresent);
    check("student sees exactly one more conducted and one more attended class", amitAfter.conducted === amitBefore.conducted + 1 && amitAfter.present === amitBefore.present + 1, [amitBefore, amitAfter]);
    check("overview = brute-force totals", rows.data.overview?.totalClasses === (await bruteStudentTotals(amit.id, policy.countExcusedAsPresent, { sessionId: S.y2627.id })).conducted);
    check("DBMS row percentage = present / conducted x 100", dbmsRow && dbmsRow.percentage === pct(dbmsRow.present, dbmsRow.conducted), dbmsRow);

    const absentUser = await prisma.student.findUniqueOrThrow({ where: { id: absentStudentId }, include: { user: true } });
    const tAbs = await tokenFor(absentUser.user.email);
    const absRows = await call(tAbs, "GET", "/attendance/student/me" + qs({ view: "daily", date: FRI }));
    const dailyDbms = absRows.data.daily?.periods?.find((p: any) => p.subject === DBMS.name);
    check("an absent student's daily view shows DBMS as ABSENT for period 1", dailyDbms?.status === "ABSENT" && dailyDbms?.period === 1, absRows.data.daily);
  }

  // =============================================================================================
  heading("7. Multi-class sessions count once per class period");
  {
    const jb = (extra: Record<string, unknown> = {}) => classBody({ subjectId: JAVA.id, date: THU, period: 5, numberOfClasses: 2, remarks: MARK, ...extra });
    const r = await call(T.verma, "GET", "/attendance/students" + qs(jb()));
    check("2-class span computes 13:15-15:15 with two class rows", r.data.class?.startTime === "13:15" && r.data.class?.endTime === "15:15" && r.data.class?.classes?.length === 2, r.data.class);
    const roster: any[] = r.data.students;
    const out = roster[2];
    const inn = roster[3];
    const [bOut, bIn] = [await bruteStudentTotals(out.studentId, policy.countExcusedAsPresent), await bruteStudentTotals(inn.studentId, policy.countExcusedAsPresent)];
    const rec = roster.map((s) => ({ studentId: s.studentId, status: s.studentId === out.studentId ? "ABSENT" : "PRESENT" }));
    const ok = await call(T.verma, "POST", "/attendance", { ...jb(), records: rec });
    check("submit a double-period session (201)", ok.status === 201 && ok.data.attendance.numberOfClasses === 2, ok.data);
    const [aOut, aIn] = [await bruteStudentTotals(out.studentId, policy.countExcusedAsPresent), await bruteStudentTotals(inn.studentId, policy.countExcusedAsPresent)];
    check("absent student: conducted +2, present +0 (not counted as one class)", aOut.conducted === bOut.conducted + 2 && aOut.present === bOut.present, [bOut, aOut]);
    check("present student: conducted +2, present +2", aIn.conducted === bIn.conducted + 2 && aIn.present === bIn.present + 2, [bIn, aIn]);
    const overlap = await call(T.verma, "POST", "/attendance", { ...jb({ period: 6, numberOfClasses: 1 }), records: rec });
    check("Period 6 overlaps that session -> 409", overlap.status === 409, overlap.data);

    const dbUser = await prisma.student.findUniqueOrThrow({ where: { id: out.studentId }, include: { user: true } });
    const rep = await call(await tokenFor(dbUser.user.email), "GET", "/attendance/student/me" + qs({ view: "summary", academicSessionId: S.y2627.id }));
    const javaRow = rep.data.subjects.find((s: any) => s.code === "MCA302");
    const expected = await prisma.$queryRaw<{ c: bigint; p: bigint }[]>(Prisma.sql`
      SELECT SUM(s."numberOfClasses") AS c, SUM(CASE WHEN r."status" IN ('PRESENT','LATE','EXCUSED') THEN s."numberOfClasses" ELSE 0 END) AS p
      FROM "AttendanceRecord" r JOIN "AttendanceSession" s ON s.id = r."attendanceSessionId"
      WHERE r."studentId" = ${out.studentId} AND s."subjectId" = ${JAVA.id} AND s."status" = 'SUBMITTED'`);
    check("subject table matches an independent SQL total", javaRow && javaRow.conducted === Number(expected[0].c) && javaRow.present === Number(expected[0].p), [javaRow, expected]);
  }

  // =============================================================================================
  heading("8. Concurrency: two simultaneous submits of the same class");
  {
    const body = { ...classBody({ semesterId: sem1, sectionId: secA26.id, subjectId: C.id, date: FRI, period: 2, remarks: MARK }) };
    const r = await call(T.patel, "GET", "/attendance/students" + qs(body));
    const records = r.data.students.map((s: any) => ({ studentId: s.studentId, status: "PRESENT" }));
    const results = await Promise.all([call(T.patel, "POST", "/attendance", { ...body, records }), call(T.patel, "POST", "/attendance", { ...body, records })]);
    const codes = results.map((x) => x.status).sort();
    check("exactly one wins (201) and one is refused (409)", codes.join() === "201,409", codes);
    const n = await prisma.attendanceSession.count({ where: { sectionId: secA26.id, subjectId: C.id, date: parseDateOnly(FRI), period: 2 } });
    check("only one session row exists", n === 1, n);
  }

  // =============================================================================================
  heading("9. Corrections are audited and permission-scoped");
  {
    const view = await call(T.sharma, "GET", `/attendance/${dbmsSessionId}`);
    const recs: any[] = view.data.attendance.records;
    const target = recs.find((r) => r.status === "ABSENT");
    check("Sharma can open and edit her own sheet", view.data.attendance.permissions.canEdit === true);

    const noReason = await call(T.sharma, "PUT", `/attendance/${dbmsSessionId}`, { reason: "", changes: [{ recordId: target.recordId, status: "PRESENT" }] });
    check("a reason is mandatory -> 400", noReason.status === 400, noReason.data);
    const noop = await call(T.sharma, "PUT", `/attendance/${dbmsSessionId}`, { reason: "no change", changes: [{ recordId: target.recordId, status: "ABSENT" }] });
    check("no effective change -> 400", noop.status === 400, noop.data);
    check("another faculty member cannot edit it -> 403", (await call(T.verma, "PUT", `/attendance/${dbmsSessionId}`, { reason: "trying", changes: [{ recordId: target.recordId, status: "PRESENT" }] })).status === 403);
    check("a student cannot edit it -> 403", (await call(T.amit, "PUT", `/attendance/${dbmsSessionId}`, { reason: "please", changes: [{ recordId: target.recordId, status: "PRESENT" }] })).status === 403);
    check("HOD of another department cannot edit it -> 403", (await call(T.hodMgmt, "PUT", `/attendance/${dbmsSessionId}`, { reason: "trying", changes: [{ recordId: target.recordId, status: "PRESENT" }] })).status === 403);

    const ok = await call(T.sharma, "PUT", `/attendance/${dbmsSessionId}`, { reason: "Student was present but marked absent by mistake", changes: [{ recordId: target.recordId, status: "PRESENT" }] });
    check("valid correction -> 200 (1 status change)", ok.status === 200 && ok.data.statusChanges === 1, ok.data);
    const after = await call(T.sharma, "GET", `/attendance/${dbmsSessionId}`);
    const changed = after.data.attendance.records.find((r: any) => r.recordId === target.recordId);
    check("the record now shows PRESENT with a full edit trail", changed.status === "PRESENT" && changed.edits.length === 1 && changed.edits[0].previousStatus === "ABSENT" && changed.edits[0].newStatus === "PRESENT" && /mistake/.test(changed.edits[0].reason) && changed.edits[0].editedBy === "Priya Sharma", changed.edits);
    check("totals were recalculated (56 present)", after.data.attendance.totals.present === 56, after.data.attendance.totals);
    const audit = await prisma.auditLog.findFirst({ where: { action: "ATTENDANCE_UPDATED", module: "attendance" }, orderBy: { createdAt: "desc" } });
    const meta: any = audit?.metadata;
    check("audit log holds who, role, previous and new data, and the reason", !!audit && meta?.attendanceSessionId === dbmsSessionId && meta?.role === "FACULTY" && meta?.previous?.[0]?.status === "ABSENT" && meta?.next?.[0]?.status === "PRESENT" && !!meta?.reason, meta);
    check("audit log records the client IP", !!audit?.ipAddress);
    const created = await prisma.auditLog.findFirst({ where: { action: "ATTENDANCE_CREATED", module: "attendance" }, orderBy: { createdAt: "desc" } });
    check("creation is audited as well", !!created && (created.metadata as any)?.attendanceSessionId);

    // edit window: a seeded DBMS session from Monday 10 Aug is far outside the 7-day window
    const old = await prisma.attendanceSession.findFirstOrThrow({ where: { subjectId: DBMS.id, sectionId: secA.id, date: parseDateOnly("2026-08-10") }, include: { records: { take: 1 } } });
    const oldEdit = await call(T.sharma, "PUT", `/attendance/${old.id}`, { reason: "late correction", changes: [{ recordId: old.records[0].id, status: old.records[0].status === "PRESENT" ? "ABSENT" : "PRESENT" }] });
    check("faculty cannot edit beyond the edit window -> 403", oldEdit.status === 403 && /days/.test(oldEdit.data.message), oldEdit.data);
    const oldView = await call(T.hod, "GET", `/attendance/${old.id}`);
    check("the HOD can still edit that sheet", oldView.data.attendance?.permissions?.canEdit === true);

    check("faculty cannot cancel -> 403", (await call(T.sharma, "POST", `/attendance/${dbmsSessionId}/cancel`, { reason: "oops" })).status === 403);
    const before = await bruteStudentTotals(amit.id, policy.countExcusedAsPresent);
    const cancel = await call(T.hod, "POST", `/attendance/${dbmsSessionId}/cancel`, { reason: "Class was cancelled by the department" });
    check("HOD can cancel attendance (200)", cancel.status === 200, cancel.data);
    const afterCancel = await bruteStudentTotals(amit.id, policy.countExcusedAsPresent);
    check("a cancelled sheet no longer counts toward totals", afterCancel.conducted === before.conducted - 1 && afterCancel.present === before.present - 1, [before, afterCancel]);
    const reGet = await call(T.sharma, "GET", "/attendance/students" + qs(classBody()));
    check("cancelling frees the class so it can be taken correctly", reGet.status === 200 && reGet.data.existing === null && reGet.data.total === 60, reGet.data.existing);
    const rec2 = reGet.data.students.map((s: any) => ({ studentId: s.studentId, status: "PRESENT" }));
    const resub = await call(T.sharma, "POST", "/attendance", { ...classBody({ remarks: MARK }), records: rec2 });
    check("and it can be re-submitted", resub.status === 201, resub.data);
    check("editing a cancelled sheet is refused -> 409", (await call(T.admin, "PUT", `/attendance/${dbmsSessionId}`, { reason: "revive", changes: [{ recordId: target.recordId, status: "ABSENT" }] })).status === 409);
  }

  // =============================================================================================
  heading("10. Security: students see only themselves; staff only their scope");
  {
    check("student cannot read another student's attendance -> 403", (await call(T.amit, "GET", `/attendance/student/${rahul.id}`)).status === 403);
    check("...nor by the old ?studentId= trick on the insights API -> 403", (await call(T.amit, "GET", `/insights/student/${rahul.id}/attendance-trend`)).status === 403);
    check("...nor another student's ID card -> 403", (await call(T.amit, "GET", `/idcard/student/${rahul.id}`)).status === 403);
    check("a student CAN read their own via 'me'", (await call(T.amit, "GET", "/attendance/student/me")).status === 200);
    check("a student CAN read their own by id", (await call(T.amit, "GET", `/attendance/student/${amit.id}`)).status === 200);
    check("student cannot browse class sheets (history) -> 403", (await call(T.amit, "GET", "/attendance/history")).status === 403);
    check("student cannot open a sheet -> 403", (await call(T.amit, "GET", `/attendance/${dbmsSessionId}`)).status === 403);
    check("student cannot see department analytics -> 403", (await call(T.amit, "GET", "/attendance/reports/department")).status === 403);
    check("faculty cannot see department analytics -> 403", (await call(T.sharma, "GET", "/attendance/reports/department")).status === 403);
    check("HOD of another department cannot see this student's report -> 403", (await call(T.hodMgmt, "GET", `/attendance/student/${amit.id}`)).status === 403);
    check("the class PDF is denied to students -> 403", (await call(T.amit, "GET", "/reports/attendance.pdf" + qs({ subjectId: DBMS.id, sectionId: secA.id, academicSessionId: S.y2627.id }))).status === 403);
    check("...and to a faculty member who does not teach that section -> 403", (await call(T.sharma, "GET", "/reports/attendance.pdf" + qs({ subjectId: DBMS.id, sectionId: secB.id, academicSessionId: S.y2627.id }))).status === 403);
    const pdf = await call(T.sharma, "GET", "/reports/attendance.pdf" + qs({ subjectId: DBMS.id, sectionId: secA.id, academicSessionId: S.y2627.id }), undefined, true);
    check("...but the teacher of the class gets the PDF", pdf.status === 200 && /pdf/.test(pdf.data.contentType) && pdf.data.bytes > 500, pdf);
    check("old faculty roster endpoint is gone (no unscoped class lists)", (await call(T.amit, "GET", "/attendance/roster")).status === 404);

    const hist = await call(T.sharma, "GET", "/attendance/history" + qs({ academicSessionId: S.y2627.id, pageSize: 100 }));
    check("Sharma's history contains only her own classes", hist.status === 200 && hist.data.data.length > 0 && hist.data.data.every((h: any) => h.faculty === "Priya Sharma"), hist.data.data?.map((h: any) => h.faculty).slice(0, 3));
    const hodHist = await call(T.hod, "GET", "/attendance/history" + qs({ academicSessionId: S.y2627.id, pageSize: 100 }));
    check("HOD's history covers the whole department", hodHist.data.total > hist.data.total, [hodHist.data.total, hist.data.total]);
    const f = await call(T.hod, "GET", "/attendance/history" + qs({ subjectId: JAVA.id, sectionId: secA.id, pageSize: 100 }));
    check("history filters narrow by subject + section", f.data.data.length > 0 && f.data.data.every((h: any) => h.subject.code === "MCA302" && h.section.name === "A"));
  }

  // =============================================================================================
  heading("11. HOD analytics come from SQL and match an independent calculation");
  {
    const rep = await call(T.hod, "GET", "/attendance/reports/department" + qs({ academicSessionId: S.y2627.id, pageSize: 200 }));
    check("HOD analytics respond", rep.status === 200, rep.data);
    const recs = await prisma.attendanceRecord.findMany({
      where: { attendanceSession: { status: "SUBMITTED", departmentId: dept.id, academicSessionId: S.y2627.id } },
      include: { attendanceSession: true },
    });
    let C_ = 0, P_ = 0;
    const perStudent = new Map<string, { c: number; p: number }>();
    const perSem = new Map<number, { c: number; p: number }>();
    for (const r of recs) {
      const n = r.attendanceSession.numberOfClasses;
      const ok = r.status === "PRESENT" || r.status === "LATE" || (r.status === "EXCUSED" && policy.countExcusedAsPresent);
      C_ += n; if (ok) P_ += n;
      const s = perStudent.get(r.studentId) ?? { c: 0, p: 0 }; s.c += n; if (ok) s.p += n; perStudent.set(r.studentId, s);
      const m = perSem.get(r.attendanceSession.semester) ?? { c: 0, p: 0 }; m.c += n; if (ok) m.p += n; perSem.set(r.attendanceSession.semester, m);
    }
    check("overall conducted / present / percentage match", rep.data.overall.conducted === C_ && rep.data.overall.present === P_ && rep.data.overall.percentage === pct(P_, C_), [rep.data.overall, { C_, P_ }]);
    check("students counted match", rep.data.overall.students === perStudent.size, [rep.data.overall.students, perStudent.size]);
    const semOk = [...perSem.entries()].every(([n, v]) => {
      const row = rep.data.bySemester.find((x: any) => x.semester === n);
      return row && row.conducted === v.c && row.present === v.p && row.percentage === pct(v.p, v.c);
    });
    check("semester-wise percentages match (Semester 1 and Semester 3 shown)", semOk && rep.data.bySemester.length === perSem.size, rep.data.bySemester);
    const w = [...perStudent.values()].filter((v) => v.p * 100 < policy.warningPercentage * v.c).length;
    const cr = [...perStudent.values()].filter((v) => v.p * 100 < policy.criticalPercentage * v.c).length;
    check(`students below ${policy.warningPercentage}% match (${w})`, rep.data.shortage.belowWarning === w, [rep.data.shortage.belowWarning, w]);
    check(`students below ${policy.criticalPercentage}% match (${cr})`, rep.data.shortage.belowCritical === cr, [rep.data.shortage.belowCritical, cr]);
    const listPct: number[] = rep.data.shortage.list.map((s: any) => s.percentage);
    check("shortage list is sorted worst-first", listPct.every((v, i) => i === 0 || listPct[i - 1] <= v));
    check("section-wise and subject-wise breakdowns are present", rep.data.bySection.length >= 3 && rep.data.bySubject.length >= 5, [rep.data.bySection.length, rep.data.bySubject.length]);
    const sh = rep.data.byFaculty.find((x: any) => x.name === "Priya Sharma");
    check("faculty activity lists sessions taken", sh && sh.sessions > 0 && sh.classes >= sh.sessions && !!sh.lastDate, rep.data.byFaculty);
    check("HOD cannot ask for another department -> 403", (await call(T.hod, "GET", "/attendance/reports/department" + qs({ departmentId: mgmt.id }))).status === 403);
    check("admin can view another department", (await call(T.admin, "GET", "/attendance/reports/department" + qs({ departmentId: mgmt.id }))).status === 200);
  }

  // =============================================================================================
  heading("12. Attendance percentage, shortage calculator and report periods");
  {
    // find a student who is really below 75% via the API's own list, then verify the math by brute force
    const rep = await call(T.hod, "GET", "/attendance/reports/department" + qs({ academicSessionId: S.y2627.id, pageSize: 5 }));
    const low = rep.data.shortage.list[0];
    const user = await prisma.student.findUniqueOrThrow({ where: { id: low.studentId }, include: { user: true } });
    const tl = await tokenFor(user.user.email);
    const r = await call(tl, "GET", "/attendance/student/me" + qs({ view: "summary", academicSessionId: S.y2627.id }));
    const o = r.data.overview;
    let x = 0;
    while ((o.present + x) * 100 < 75 * (o.totalClasses + x)) x += 1;
    check(`shortage: needs ${x} consecutive classes (brute force) = API value`, o.hasShortage && o.classesNeededToRecover === x, [o, x]);
    check("...and the boundary is exact ((P+x)/(T+x) >= 75%, one fewer is not)", (o.present + x) * 100 >= 75 * (o.totalClasses + x) && (x === 0 || (o.present + x - 1) * 100 < 75 * (o.totalClasses + x - 1)));
    check("'if you attend / miss the next class' are computed, not invented", o.ifAttendNext === pct(o.present + 1, o.totalClasses + 1) && o.ifMissNext === pct(o.present, o.totalClasses + 1), o);
    check("subject rows also carry a recovery figure", r.data.subjects.every((s: any) => "classesNeededToRecover" in s));

    const good = await call(T.amit, "GET", "/attendance/student/me" + qs({ view: "summary" }));
    if (!good.data.overview.hasShortage) {
      const g = good.data.overview;
      const canMiss = g.classesCanMiss;
      check("above the minimum: 'classes you can still miss' keeps you at or above it", canMiss >= 0 && g.present * 100 >= 75 * (g.totalClasses + canMiss) && g.present * 100 < 75 * (g.totalClasses + canMiss + 1), [g, canMiss]);
    }

    const all = await call(T.amit, "GET", "/attendance/student/me" + qs({ view: "summary" }));
    const monthly = await call(T.amit, "GET", "/attendance/student/me" + qs({ view: "monthly" }));
    const weekly = await call(T.amit, "GET", "/attendance/student/me" + qs({ view: "weekly" }));
    const yearly = await call(T.amit, "GET", "/attendance/student/me" + qs({ view: "yearly" }));
    const bySem = await call(T.amit, "GET", "/attendance/student/me" + qs({ view: "semester" }));
    const bySes = await call(T.amit, "GET", "/attendance/student/me" + qs({ view: "session" }));
    const sum = (s: any[], k: string) => s.reduce((a, b) => a + b[k], 0);
    check("monthly buckets add up to the overall total", sum(monthly.data.series, "conducted") === all.data.overview.totalClasses, monthly.data.series);
    check("weekly buckets add up to the overall total", sum(weekly.data.series, "conducted") === all.data.overview.totalClasses);
    check("yearly view is genuinely per-year (was per-month before)", yearly.data.series.every((b: any) => /^\d{4}$/.test(b.label)), yearly.data.series);
    check("semester view lists Semester 2 (2025-2026) and Semester 3 (2026-2027) separately", bySem.data.series.map((b: any) => b.label).join("|") === "2025-2026 · Semester 2|2026-2027 · Semester 3", bySem.data.series);
    check("session view: one row per academic session", bySes.data.series.length === 2 && sum(bySes.data.series, "conducted") === all.data.overview.totalClasses, bySes.data.series);

    // Rahul: promoted from Section A to B - his 2025-26 attendance must stay under Semester 2 / session 2025-26
    const rOld = await call(T.rahul, "GET", "/attendance/student/me" + qs({ view: "summary", academicSessionId: S.y2526.id }));
    check("promoted student: last session's attendance is intact (OOP + OS)", rOld.data.subjects.map((s: any) => s.code).sort().join() === "MCA201,MCA202", rOld.data.subjects);
    const rNew = await call(T.rahul, "GET", "/attendance/student/me" + qs({ view: "summary", academicSessionId: S.y2627.id }));
    check("...and is NOT mixed into the new session's numbers", !rNew.data.subjects.some((s: any) => s.code === "MCA201"), rNew.data.subjects.map((s: any) => s.code));
    const oldRec = await prisma.attendanceRecord.findFirstOrThrow({ where: { studentId: rahul.id, attendanceSession: { subjectId: OOP.id } }, include: { enrollment: { include: { semester: true } } } });
    check("historical attendance still points at the Semester 2 enrollment", oldRec.enrollment?.semester.number === 2 && oldRec.enrollment?.endDate !== null, oldRec.enrollment);

    const sneha = await call(T.sneha, "GET", "/attendance/student/me" + qs({ view: "summary", academicSessionId: S.y2627.id }));
    const cRow = sneha.data.subjects.find((s: any) => s.code === "MCA101");
    check("backlog student: Programming with C appears, tagged BACKLOG", cRow?.registrationType === "BACKLOG", sneha.data.subjects.map((s: any) => [s.code, s.registrationType]));
  }

  // =============================================================================================
  heading("13. Student lifecycle: register -> attend -> promote -> transfer -> readmit -> defer");
  {
    const d0 = formatDateOnly(addDays(parseDateOnly(today), -12));
    const d1 = formatDateOnly(addDays(parseDateOnly(d0), 3));
    const d2 = formatDateOnly(addDays(parseDateOnly(d1), 3));
    const d3 = formatDateOnly(addDays(parseDateOnly(d2), 2));
    const reg = (extra: Record<string, unknown> = {}) => ({
      role: "STUDENT", firstName: "E2E", lastName: `Tester${Date.now() % 100000}`, email: `e2e.${Date.now()}${Math.floor(Math.random() * 999)}@student.unisphere.edu`, password: "Passw0rd1",
      departmentId: dept.id, programId: program.id, batchId: batch26.id, sectionId: secA26.id, rollNumber: `E2E${Date.now() % 1000000}${Math.floor(Math.random() * 99)}`,
      academicSessionId: S.y2627.id, semesterId: sem1, enrollmentType: "REGULAR", admissionDate: d0, guardianName: "E2E Guardian", ...extra,
    });

    check("registration without an academic session is refused (400)", (await call(T.admin, "POST", "/users", { ...reg(), academicSessionId: undefined })).status === 400);
    check("registration with a section of ANOTHER batch is refused (400)", (await call(T.admin, "POST", "/users", reg({ sectionId: secA.id }))).status === 400);
    check("registration with a program from another department is refused (400)", (await call(T.admin, "POST", "/users", reg({ programId: mba.id }))).status === 400);
    check("a REGULAR admission cannot start in Semester 3 (400)", (await call(T.admin, "POST", "/users", reg({ semesterId: sem3 }))).status === 400);
    check("only an administrator can register students (403)", (await call(T.hod, "POST", "/users", reg())).status === 403);

    const created = await call(T.admin, "POST", "/users", reg());
    check("registration succeeds (201)", created.status === 201, created.data);
    const su = await prisma.student.findFirstOrThrow({ where: { userId: created.data.user?.id }, include: { enrollments: true } });
    check("a first enrollment was created with the master profile", su.enrollments.length === 1 && su.enrollments[0].endDate === null && su.enrollments[0].enrollmentType === "REGULAR" && su.enrollments[0].admissionYear === 2026, su.enrollments);
    check("the legacy mirror columns agree (Semester 1, Section A)", su.currentSemester === 1 && su.sectionId === secA26.id && su.admissionYear === 2026);
    const dupRoll = await call(T.admin, "POST", "/users", reg({ rollNumber: su.rollNumber }));
    check("duplicate roll number -> 409", dupRoll.status === 409, dupRoll.data);

    // attend in Semester 1
    const cls = { academicSessionId: S.y2627.id, semesterId: sem1, departmentId: dept.id, programId: program.id, sectionId: secA26.id, subjectId: C.id, date: d1, period: 3, numberOfClasses: 1, remarks: MARK };
    const before = await call(T.patel, "GET", "/attendance/students" + qs(cls));
    check("the new student appears in the Semester 1 class from the admission date on", before.data.students?.some((s: any) => s.studentId === su.id));
    const earlier = await call(T.patel, "GET", "/attendance/students" + qs({ ...cls, date: formatDateOnly(addDays(parseDateOnly(d0), -1)) }));
    check("...but not the day BEFORE admission", !earlier.data.students?.some((s: any) => s.studentId === su.id), earlier.data.total);
    const sub = await call(T.patel, "POST", "/attendance", { ...cls, records: before.data.students.map((s: any) => ({ studentId: s.studentId, status: "PRESENT" })) });
    check("attendance taken while in Semester 1", sub.status === 201, sub.data);
    const oldEnrollmentId = su.enrollments[0].id;

    // promotion
    const promoted = await call(T.admin, "POST", `/students/${su.id}/enrollments/promote`, { academicSessionId: S.y2627.id, semesterId: sem2, sectionId: secA26.id, effectiveDate: d2 });
    check("promote to Semester 2 (201)", promoted.status === 201 && promoted.data.enrollment.semester.number === 2 && promoted.data.enrollment.enrollmentType === "PROMOTION", promoted.data);
    const back = await call(T.admin, "POST", `/students/${su.id}/enrollments/promote`, { academicSessionId: S.y2627.id, semesterId: sem1, effectiveDate: d3 });
    check("promoting backwards is refused (400)", back.status === 400, back.data);
    const hist = await call(T.admin, "GET", `/students/${su.id}/enrollments`);
    const old = hist.data.enrollments.find((e: any) => e.id === oldEnrollmentId);
    check("history keeps BOTH enrollments; the old one is closed as PROMOTED the day before", hist.data.enrollments.length === 2 && old.status === "PROMOTED" && old.endDate === formatDateOnly(addDays(parseDateOnly(d2), -1)), hist.data);
    const suNow = await prisma.student.findUniqueOrThrow({ where: { id: su.id } });
    check("mirror columns follow the new enrollment (Semester 2)", suNow.currentSemester === 2);
    const rec = await prisma.attendanceRecord.findFirstOrThrow({ where: { studentId: su.id } });
    check("earlier attendance still points at the OLD enrollment (never rewritten)", rec.enrollmentId === oldEnrollmentId, [rec.enrollmentId, oldEnrollmentId]);
    const sameDay = await call(T.patel, "GET", "/attendance/students" + qs({ ...cls, period: 4 }));
    check("a Semester 1 class list on the earlier date still includes them", sameDay.data.students?.some((s: any) => s.studentId === su.id));
    const later = await call(T.patel, "GET", "/attendance/students" + qs({ ...cls, date: d2, period: 4 }));
    check("a Semester 1 class list from the promotion date on excludes them", !later.data.students?.some((s: any) => s.studentId === su.id), later.data.total);
    const tSu = await tokenFor((await prisma.user.findUniqueOrThrow({ where: { id: su.userId } })).email);
    const rep = await call(tSu, "GET", "/attendance/student/me" + qs({ view: "summary" }));
    check("their own report still shows the Semester 1 subject after promotion", rep.data.subjects.some((s: any) => s.code === "MCA101"), rep.data.subjects);

    // old clients that overwrite the semester are told why it no longer works
    const overwrite = await call(T.admin, "PUT", `/students/${su.id}`, { currentSemester: 3 });
    check("editing the semester in place is refused with an explanation (400)", overwrite.status === 400 && /history/.test(overwrite.data.message), overwrite.data);

    // section transfer
    let secB26 = await prisma.section.findUnique({ where: { batchId_name: { batchId: batch26.id, name: "B" } } });
    if (!secB26) secB26 = await prisma.section.create({ data: { batchId: batch26.id, name: "B" } });
    const moved = await call(T.admin, "POST", `/students/${su.id}/enrollments/transfer`, { sectionId: secB26.id, effectiveDate: d3, reasonNote: "Timetable clash" });
    check("change section within the same semester (TRANSFER)", moved.status === 201 && moved.data.enrollment.section.name === "B" && moved.data.enrollment.enrollmentType === "TRANSFER", moved.data);
    check("transfer without a reason is refused (400)", (await call(T.admin, "POST", `/students/${su.id}/enrollments/transfer`, { sectionId: secA26.id })).status === 400);
    check("a section of another batch is refused (400)", (await call(T.admin, "POST", `/students/${su.id}/enrollments/transfer`, { sectionId: secA.id, reasonNote: "test" })).status === 400);

    // readmission / repeat
    check("repeating the semester they are already in is refused (400)", (await call(T.admin, "POST", `/students/${su.id}/enrollments/readmit`, { enrollmentType: "REPEAT", academicSessionId: S.y2627.id, semesterId: sem2, batchId: batch26.id, readmissionReason: "BACKLOG" })).status === 400);
    check("reason 'Other' requires a description (400)", (await call(T.admin, "POST", `/students/${su.id}/enrollments/readmit`, { enrollmentType: "REPEAT", academicSessionId: S.y2627.id, semesterId: sem1, batchId: batch26.id, readmissionReason: "OTHER" })).status === 400);
    const s2728 = await prisma.academicSession.findUniqueOrThrow({ where: { label: "2027-2028" } });
    const repeat = await call(T.admin, "POST", `/students/${su.id}/enrollments/readmit`, { enrollmentType: "REPEAT", academicSessionId: s2728.id, semesterId: sem2, batchId: batch26.id, sectionId: secA26.id, readmissionReason: "BACKLOG", reasonNote: "Backlog in two subjects", effectiveDate: "2027-07-01" });
    check("readmit / repeat Semester 2 in 2027-2028 (201)", repeat.status === 201 && repeat.data.enrollment.enrollmentType === "REPEAT" && repeat.data.enrollment.readmissionReason === "BACKLOG" && repeat.data.enrollment.admissionYear === 2027, repeat.data);
    const h2 = await call(T.admin, "GET", `/students/${su.id}/enrollments`);
    check("history now holds four enrollments in a linked chain", h2.data.enrollments.length === 4 && h2.data.enrollments.filter((e: any) => e.isCurrent).length === 1, h2.data.enrollments.map((e: any) => [e.enrollmentType, e.status]));

    // defer
    const deferred = await call(T.admin, "POST", `/students/${su.id}/enrollments/close`, { status: "DEFERRED", effectiveDate: "2027-09-01", reasonNote: "Academic break" });
    check("defer closes the open enrollment", deferred.status === 200 && deferred.data.enrollment.status === "DEFERRED", deferred.data);
    check("promoting a student with no open enrollment is refused (400)", (await call(T.admin, "POST", `/students/${su.id}/enrollments/promote`, { academicSessionId: s2728.id, semesterId: sem3 })).status === 400);
    const open = await prisma.studentEnrollment.count({ where: { studentId: su.id, endDate: null } });
    check("the database allows at most one open enrollment per student", open === 0);
    const dbBlock = await prisma.studentEnrollment.create({
      data: { studentId: su.id, academicSessionId: S.y2627.id, departmentId: dept.id, programId: program.id, batchId: batch26.id, semesterId: sem1, admissionYear: 2026, admissionDate: parseDateOnly("2026-08-01") },
    }).then(() => true, () => false);
    const second = await prisma.studentEnrollment.create({
      data: { studentId: su.id, academicSessionId: S.y2627.id, departmentId: dept.id, programId: program.id, batchId: batch26.id, semesterId: sem1, admissionYear: 2026, admissionDate: parseDateOnly("2026-08-02") },
    }).then(() => true, () => false);
    check("DB-level guard: a second OPEN enrollment for the same student is rejected", dbBlock === true && second === false, [dbBlock, second]);

    // backlog/elective registrations through the API
    const reg1 = await call(T.admin, "POST", `/students/${amit.id}/subject-registrations`, { subjectId: C.id, sectionId: secA26.id, type: "BACKLOG" });
    check("register a backlog subject (201)", reg1.status === 201, reg1.data);
    check("registering it twice -> 409", (await call(T.admin, "POST", `/students/${amit.id}/subject-registrations`, { subjectId: C.id, sectionId: secA26.id, type: "BACKLOG" })).status === 409);
    check("a backlog must be from an EARLIER semester (400)", (await call(T.admin, "POST", `/students/${amit.id}/subject-registrations`, { subjectId: DBMS.id, sectionId: secA.id, type: "BACKLOG" })).status === 400);
    const withBack = await call(T.patel, "GET", "/attendance/students" + qs({ ...cls, period: 5 }));
    check("the backlog student now appears in that class", withBack.data.students?.some((s: any) => s.studentId === amit.id && s.kind === "BACKLOG"));
    const del = await call(T.admin, "DELETE", `/students/subject-registrations/${reg1.data.registration.id}`);
    check("the registration can be removed while unused (200)", del.status === 200, del.data);
  }

  // =============================================================================================
  heading("13b. Student search matches every word");
  {
    const full = await call(T.admin, "GET", "/students" + qs({ search: "Rahul Kumar" }));
    check("a full name ('Rahul Kumar') finds the student (used to return nothing)", full.data.data?.some((s: any) => s.rollNumber === "MCA25B012"), full.data);
    const reversed = await call(T.admin, "GET", "/students" + qs({ search: "kumar rahul" }));
    check("word order and case do not matter", reversed.data.data?.some((s: any) => s.rollNumber === "MCA25B012"));
    const bySession = await call(T.admin, "GET", "/students" + qs({ academicSessionId: S.y2627.id, semester: 3, sectionId: secB.id, pageSize: 100 }));
    check("filters by session + semester + section use the open enrollment", bySession.data.total === 40 && bySession.data.data.every((s: any) => s.currentEnrollment?.semester === "Semester 3"), [bySession.data.total]);
  }

  // =============================================================================================
  heading("14. Academic management: sessions, periods, subjects, assignments");
  {
    const newSession = { startYear: 2090, endYear: 2091, startDate: "2090-07-01", endDate: "2091-06-30", isActive: true, isCurrent: false };
    check("faculty cannot create academic sessions (403)", (await call(T.sharma, "POST", "/academics/sessions", newSession)).status === 403);
    check("HOD cannot create academic sessions (403)", (await call(T.hod, "POST", "/academics/sessions", newSession)).status === 403);
    const c = await call(T.admin, "POST", "/academics/sessions", newSession);
    check("admin creates a session with a derived label (201)", c.status === 201 && c.data.session.label === "2090-2091", c.data);
    check("the same label again -> 409", (await call(T.admin, "POST", "/academics/sessions", newSession)).status === 409);
    check("overlapping dates -> 409", (await call(T.admin, "POST", "/academics/sessions", { ...newSession, startYear: 2091, endYear: 2092, startDate: "2091-01-01", endDate: "2091-12-31" })).status === 409);
    check("end date before start date -> 400", (await call(T.admin, "POST", "/academics/sessions", { ...newSession, startYear: 2093, endYear: 2094, startDate: "2094-01-01", endDate: "2093-01-01" })).status === 400);
    const deact = await call(T.admin, "PATCH", `/academics/sessions/${c.data.session.id}`, { isActive: false });
    check("a session can be deactivated", deact.status === 200 && deact.data.session.isActive === false);
    const inactive = await call(T.admin, "POST", "/users", { role: "STUDENT", firstName: "E2E", lastName: "Inactive", email: `e2e.inactive${Date.now()}@x.edu`, departmentId: dept.id, programId: program.id, batchId: batch26.id, rollNumber: `E2EI${Date.now() % 100000}`, academicSessionId: c.data.session.id, semesterId: sem1, enrollmentType: "REGULAR" });
    check("nobody can be enrolled into an inactive session (400)", inactive.status === 400, inactive.data);
    const cur = await call(T.admin, "PATCH", `/academics/sessions/${c.data.session.id}`, { isCurrent: true });
    check("an inactive session cannot be current (400)", cur.status === 400);

    const grid = await call(T.sharma, "GET", "/academics/periods");
    check("everyone can read the period grid", grid.status === 200 && grid.data.periods.length === 6);
    const badGrid = await call(T.admin, "PUT", "/academics/periods", { periods: [{ number: 1, startTime: "08:00", endTime: "09:30" }, { number: 2, startTime: "09:00", endTime: "10:00" }] });
    check("overlapping periods are refused (400)", badGrid.status === 400, badGrid.data);
    check("faculty cannot change the period grid (403)", (await call(T.sharma, "PUT", "/academics/periods", { periods: [] })).status === 403);
    const stillSix = await call(T.admin, "GET", "/academics/periods");
    check("a refused change left the grid untouched", stillSix.data.periods.length === 6);

    const subBody = { name: "E2E Subject", code: "E2E101", credits: 3, programId: program.id, semesterId: sem2, type: "THEORY" };
    check("HOD cannot create a subject in another department (403)", (await call(T.hod, "POST", "/academics/subjects", { ...subBody, code: "E2E102", programId: mba.id, semesterId: await sem(mba.id, 2) })).status === 403);
    check("a semester of a different program is refused (400)", (await call(T.hod, "POST", "/academics/subjects", { ...subBody, code: "E2E103", semesterId: await sem(mba.id, 2) })).status === 400);
    check("the old free-text semester form is no longer accepted (400)", (await call(T.hod, "POST", "/academics/subjects", { name: "Old style", code: "E2E104", credits: 3, semester: 2, departmentId: dept.id })).status === 400);
    const sc = await call(T.hod, "POST", "/academics/subjects", subBody);
    check("HOD creates a subject in their own program (201) with department derived", sc.status === 201 && sc.data.subject.departmentId === dept.id && sc.data.subject.semester === 2 && sc.data.subject.isMapped === true, sc.data);
    const moveSub = await call(T.hod, "PUT", `/academics/subjects/${sc.data.subject.id}`, { semesterId: sem3 });
    check("a subject can move to another semester of its own program", moveSub.status === 200 && moveSub.data.subject.semester === 3, moveSub.data);
    check("...but not to another program (400)", (await call(T.hod, "PUT", `/academics/subjects/${sc.data.subject.id}`, { programId: mba.id, semesterId: await sem(mba.id, 3) })).status === 400);

    const fac = await prisma.faculty.findFirstOrThrow({ where: { user: { email: "manoj.das@unisphere.edu" } } });
    const as = { academicSessionId: S.y2627.id, subjectId: sc.data.subject.id, sectionId: secA.id, facultyId: fac.id };
    const a1 = await call(T.hod, "POST", "/academics/assignments", as);
    check("HOD assigns faculty to subject + section + session (201)", a1.status === 201, a1.data);
    check("assigning the same person twice -> 409", (await call(T.hod, "POST", "/academics/assignments", as)).status === 409);
    check("a section of another program is refused (400)", (await call(T.hod, "POST", "/academics/assignments", { ...as, sectionId: mbaSecA.id })).status === 400);
    check("HOD of another department cannot assign it (403)", (await call(T.hodMgmt, "POST", "/academics/assignments", { ...as, facultyId: fac.id })).status === 403);
    check("faculty cannot list all assignments they do not own (only their own)", (await call(T.sharma, "GET", "/academics/assignments")).data.assignments.every((a: any) => a.faculty.fullName === "Priya Sharma"));
    check("students cannot read assignments (403)", (await call(T.amit, "GET", "/academics/assignments")).status === 403);
    check("HOD removes the assignment (200)", (await call(T.hod, "DELETE", `/academics/assignments/${a1.data.assignment.id}`)).status === 200);

    const tree = await call(T.admin, "GET", "/departments/full");
    const mca = tree.data.departments.find((d: any) => d.code === "MCA").programs.find((p: any) => p.name === "MCA");
    check("the department tree exposes each program's semesters", mca.semesters.length >= 4 && mca.semesters[0].number === 1, mca.semesters);
  }

  await cleanup();
  console.log(`\n${"=".repeat(64)}\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log("  - " + f));
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error("\nE2E crashed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
