/**
 * Demo / test dataset for the Academic + Enrollment + Attendance modules.
 *
 *     npm run prisma:seed          # once: roles, permissions, policy, super admin
 *     npm run prisma:seed:demo     # this file - safe to re-run (it skips what already exists)
 *
 * It builds the structure described in the requirements:
 *   Sessions   2025-2026, 2026-2027 (current), 2027-2028
 *   Program    MCA (Department of Computer Applications) with Semesters 1-4, batches 2025-2027 and 2026-2028
 *   Sem 3      Section A (60 students on the test date) and Section B (40) - DBMS, Java, CN, AI, SE (+ an elective)
 *   Sem 1      Section A of the 2026 batch (32 people incl. a repeater and a backlog student)
 *   Special    promoted student with a section change, readmitted (REPEAT) student, backlog student,
 *              deferred student, late admission, elective registrations, section-level faculty override
 *   Other dept Management Studies / MBA - used to prove HODs and faculty cannot cross departments
 *
 * Every account uses the password  Demo@1234
 */
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { ensureDatabaseInvariants } from "../config/dbInvariants";
import { syncPermissions } from "../config/permissionMatrix";
import { ensureProgramSemesters } from "../modules/academics/academics.helpers";

const prisma = new PrismaClient();
const PASSWORD = "Demo@1234";

// Deterministic pseudo-random numbers so the dataset (and the tests built on it) is reproducible.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260918);

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

const FIRST = ["Amit", "Rahul", "Priya", "Sneha", "Vikram", "Anjali", "Rohan", "Kavita", "Deepak", "Neha", "Arjun", "Pooja", "Sanjay", "Meera", "Karan", "Divya", "Manish", "Ritu", "Suresh", "Ananya", "Nikhil", "Swati", "Harsh", "Tanvi", "Gaurav", "Isha", "Varun", "Shreya", "Ajay", "Komal"];
const LAST = ["Kumar", "Das", "Singh", "Reddy", "Rao", "Patel", "Sharma", "Nair", "Mishra", "Panda", "Behera", "Mohanty", "Sahu", "Jena", "Rout", "Nayak", "Gupta", "Verma", "Iyer", "Khan", "Ali", "Dash", "Swain", "Pradhan", "Tripathy", "Mahapatra", "Bose", "Roy", "Sen", "Joshi"];
const nameAt = (i: number) => ({ firstName: FIRST[i % FIRST.length], lastName: LAST[(Math.floor(i / FIRST.length) + i * 7) % LAST.length] });

const PERIODS: [number, string, string][] = [
  [1, "08:00", "09:00"],
  [2, "09:00", "10:00"],
  [3, "10:15", "11:15"],
  [4, "11:15", "12:15"],
  [5, "13:15", "14:15"],
  [6, "14:15", "15:15"],
];

type Day = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";
const DAY_INDEX: Record<string, Day> = { 1: "MON", 2: "TUE", 3: "WED", 4: "THU", 5: "FRI", 6: "SAT" };

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  console.log("Preparing reference data...");
  await syncPermissions(prisma);
  await prisma.attendancePolicy.upsert({ where: { singleton: true }, update: {}, create: { singleton: true } });
  await ensureDatabaseInvariants(prisma);
  const role = async (name: string) => (await prisma.role.findUniqueOrThrow({ where: { name } })).id;
  const roleIds = {
    admin: await role("UNIV_ADMIN"), hod: await role("HOD"), faculty: await role("FACULTY"), student: await role("STUDENT"),
  };

  // ----------------------------------------------------------------------------------- sessions
  console.log("Academic sessions...");
  const sessionDefs = [
    { label: "2025-2026", startYear: 2025, endYear: 2026, isCurrent: false },
    { label: "2026-2027", startYear: 2026, endYear: 2027, isCurrent: true },
    { label: "2027-2028", startYear: 2027, endYear: 2028, isCurrent: false },
  ];
  const sessions: Record<string, { id: string }> = {};
  for (const s of sessionDefs) {
    sessions[s.label] = await prisma.academicSession.upsert({
      where: { label: s.label },
      update: {},
      create: {
        label: s.label, startYear: s.startYear, endYear: s.endYear,
        startDate: utc(`${s.startYear}-07-01`), endDate: utc(`${s.endYear}-06-30`),
        isCurrent: s.isCurrent, isActive: true,
      },
    });
  }
  const S2526 = sessions["2025-2026"].id;
  const S2627 = sessions["2026-2027"].id;

  // ----------------------------------------------------------------------------------- period grid
  console.log("Period grid...");
  for (const [number, startTime, endTime] of PERIODS) {
    await prisma.periodDefinition.upsert({ where: { number }, update: {}, create: { number, startTime, endTime } });
  }

  // ----------------------------------------------------------------------------------- departments / programs / batches
  console.log("Departments, programs, batches, sections...");
  const dept = await prisma.department.upsert({ where: { code: "MCA" }, update: {}, create: { name: "Department of Computer Applications", code: "MCA" } });
  const program = await prisma.program.upsert({
    where: { name_departmentId: { name: "MCA", departmentId: dept.id } },
    update: {}, create: { name: "MCA", departmentId: dept.id, durationYears: 2 },
  });
  await ensureProgramSemesters(prisma, program.id, Math.max(program.durationYears * 2, 4));
  const sem = async (programId: string, n: number) => (await prisma.semester.findUniqueOrThrow({ where: { programId_number: { programId, number: n } } })).id;
  const semId = { 1: await sem(program.id, 1), 2: await sem(program.id, 2), 3: await sem(program.id, 3), 4: await sem(program.id, 4) };

  const batchOf = async (programId: string, startYear: number, endYear: number) => {
    const label = `${startYear}-${endYear}`;
    return (await prisma.batch.findFirst({ where: { programId, label } })) ?? prisma.batch.create({ data: { programId, startYear, endYear, label } });
  };
  const batch25 = await batchOf(program.id, 2025, 2027);
  const batch26 = await batchOf(program.id, 2026, 2028);
  const sectionOf = (batchId: string, name: string) =>
    prisma.section.upsert({ where: { batchId_name: { batchId, name } }, update: {}, create: { batchId, name } });
  const secA25 = await sectionOf(batch25.id, "A");
  const secB25 = await sectionOf(batch25.id, "B");
  const secA26 = await sectionOf(batch26.id, "A");

  // Second department: only used to prove scope rules (HOD / faculty cannot cross departments).
  const mgmt = await prisma.department.upsert({ where: { code: "MBA" }, update: {}, create: { name: "Department of Management Studies", code: "MBA" } });
  const mba = await prisma.program.upsert({
    where: { name_departmentId: { name: "MBA", departmentId: mgmt.id } },
    update: {}, create: { name: "MBA", departmentId: mgmt.id, durationYears: 2 },
  });
  await ensureProgramSemesters(prisma, mba.id, 4);
  const mbaSem3 = await sem(mba.id, 3);
  const mbaBatch = await batchOf(mba.id, 2025, 2027);
  const mbaSecA = await sectionOf(mbaBatch.id, "A");

  // ----------------------------------------------------------------------------------- staff
  console.log("Faculty...");
  const staff = async (email: string, first: string, last: string, uid: string, roleId: string, departmentId: string, designation: string) => {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { universityId: uid, email, passwordHash, firstName: first, lastName: last, roleId, mustResetPassword: false },
    });
    const faculty = await prisma.faculty.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, employeeId: uid, departmentId, designation },
    });
    return { user, faculty };
  };
  const mehta = await staff("hod.mehta@unisphere.edu", "Anil", "Mehta", "HOD0001", roleIds.hod, dept.id, "HOD");
  const sharma = await staff("priya.sharma@unisphere.edu", "Priya", "Sharma", "FAC0001", roleIds.faculty, dept.id, "Associate Professor");
  const verma = await staff("rakesh.verma@unisphere.edu", "Rakesh", "Verma", "FAC0002", roleIds.faculty, dept.id, "Assistant Professor");
  const iyer = await staff("sunita.iyer@unisphere.edu", "Sunita", "Iyer", "FAC0003", roleIds.faculty, dept.id, "Professor");
  const das = await staff("manoj.das@unisphere.edu", "Manoj", "Das", "FAC0004", roleIds.faculty, dept.id, "Assistant Professor");
  const patel = await staff("neha.patel@unisphere.edu", "Neha", "Patel", "FAC0005", roleIds.faculty, dept.id, "Assistant Professor");
  const nairM = await staff("hod.nair@unisphere.edu", "Rekha", "Nair", "HOD0002", roleIds.hod, mgmt.id, "HOD");
  await prisma.department.update({ where: { id: dept.id }, data: { hodId: mehta.faculty.id } }).catch(() => undefined);
  await prisma.department.update({ where: { id: mgmt.id }, data: { hodId: nairM.faculty.id } }).catch(() => undefined);
  await prisma.user.upsert({
    where: { email: "admin@unisphere.edu" },
    update: {},
    create: { universityId: "ADM0002", email: "admin@unisphere.edu", passwordHash, firstName: "Univ", lastName: "Admin", roleId: roleIds.admin, mustResetPassword: false },
  });

  // ----------------------------------------------------------------------------------- subjects
  console.log("Subjects...");
  const subj = async (code: string, name: string, semester: 1 | 2 | 3 | 4, faculty: { faculty: { id: string } } | null, opts: { elective?: boolean; practical?: boolean } = {}) => {
    const existing = await prisma.subject.findUnique({ where: { code } });
    if (existing) return existing;
    return prisma.subject.create({
      data: {
        name, code, credits: 4, semester, type: opts.practical ? "PRACTICAL" : "THEORY", isElective: Boolean(opts.elective),
        departmentId: dept.id, programId: program.id, semesterId: semId[semester], facultyId: faculty?.faculty.id,
      },
    });
  };
  const C = await subj("MCA101", "Programming with C", 1, patel);
  const DM = await subj("MCA102", "Discrete Mathematics", 1, das);
  const CO = await subj("MCA103", "Computer Organization", 1, iyer);
  const DS = await subj("MCA104", "Data Structures", 1, verma);
  const OOP = await subj("MCA201", "Object Oriented Programming", 2, verma);
  const OS = await subj("MCA202", "Operating Systems", 2, iyer);
  const DBMS = await subj("MCA301", "Database Management System", 3, sharma);
  const JAVA = await subj("MCA302", "Java Programming", 3, verma);
  const CN = await subj("MCA303", "Computer Networks", 3, iyer);
  const AI = await subj("MCA304", "Artificial Intelligence", 3, iyer);
  const SE = await subj("MCA305", "Software Engineering", 3, das);
  const DA = await subj("MCA306", "Data Analytics (Elective)", 3, sharma, { elective: true });
  await subj("MCA401", "Machine Learning", 4, sharma);

  const mktg = (await prisma.subject.findUnique({ where: { code: "MBA301" } })) ??
    (await prisma.subject.create({
      data: { name: "Marketing Management", code: "MBA301", credits: 4, semester: 3, departmentId: mgmt.id, programId: mba.id, semesterId: mbaSem3, facultyId: nairM.faculty.id },
    }));

  // ----------------------------------------------------------------------------------- faculty assignments (2026-2027)
  console.log("Faculty assignments...");
  const assign = (subjectId: string, sectionId: string, facultyId: string) =>
    prisma.facultySubjectAssignment.upsert({
      where: { academicSessionId_subjectId_sectionId_facultyId: { academicSessionId: S2627, subjectId, sectionId, facultyId } },
      update: {}, create: { academicSessionId: S2627, subjectId, sectionId, facultyId },
    });
  // Section A
  await assign(DBMS.id, secA25.id, sharma.faculty.id);
  await assign(JAVA.id, secA25.id, verma.faculty.id);
  await assign(CN.id, secA25.id, iyer.faculty.id);
  await assign(AI.id, secA25.id, iyer.faculty.id);
  await assign(SE.id, secA25.id, das.faculty.id);
  await assign(DA.id, secA25.id, sharma.faculty.id);
  // Section B - DBMS is taught by Verma (NOT the subject's default Sharma) and AI by Sharma: section-level overrides
  await assign(DBMS.id, secB25.id, verma.faculty.id);
  await assign(JAVA.id, secB25.id, verma.faculty.id);
  await assign(CN.id, secB25.id, iyer.faculty.id);
  await assign(AI.id, secB25.id, sharma.faculty.id);
  await assign(SE.id, secB25.id, das.faculty.id);
  // Semester 1, 2026 batch
  await assign(C.id, secA26.id, patel.faculty.id);
  await assign(DM.id, secA26.id, das.faculty.id);
  await assign(CO.id, secA26.id, iyer.faculty.id);
  await assign(DS.id, secA26.id, verma.faculty.id);
  // Management
  await assign(mktg.id, mbaSecA.id, nairM.faculty.id);

  // ----------------------------------------------------------------------------------- timetable
  console.log("Timetable...");
  type Slot = { subject: string; faculty: string; section: string; day: Day; start: string; end: string };
  const slots: Slot[] = [
    // Sem 3, Section A
    { subject: DBMS.id, faculty: sharma.faculty.id, section: secA25.id, day: "MON", start: "08:00", end: "09:00" },
    { subject: JAVA.id, faculty: verma.faculty.id, section: secA25.id, day: "MON", start: "09:00", end: "10:00" },
    { subject: CN.id, faculty: iyer.faculty.id, section: secA25.id, day: "MON", start: "10:15", end: "11:15" },
    { subject: AI.id, faculty: iyer.faculty.id, section: secA25.id, day: "TUE", start: "08:00", end: "09:00" },
    { subject: SE.id, faculty: das.faculty.id, section: secA25.id, day: "TUE", start: "09:00", end: "10:00" },
    { subject: DBMS.id, faculty: sharma.faculty.id, section: secA25.id, day: "TUE", start: "10:15", end: "11:15" },
    { subject: CN.id, faculty: iyer.faculty.id, section: secA25.id, day: "WED", start: "08:00", end: "09:00" },
    { subject: JAVA.id, faculty: verma.faculty.id, section: secA25.id, day: "WED", start: "09:00", end: "10:00" },
    { subject: SE.id, faculty: das.faculty.id, section: secA25.id, day: "WED", start: "10:15", end: "11:15" },
    { subject: JAVA.id, faculty: verma.faculty.id, section: secA25.id, day: "THU", start: "13:15", end: "15:15" }, // 2-period lab
    { subject: DBMS.id, faculty: sharma.faculty.id, section: secA25.id, day: "FRI", start: "08:00", end: "09:00" },
    { subject: AI.id, faculty: iyer.faculty.id, section: secA25.id, day: "FRI", start: "09:00", end: "10:00" },
    // Sem 3, Section B
    { subject: CN.id, faculty: iyer.faculty.id, section: secB25.id, day: "MON", start: "08:00", end: "09:00" },
    { subject: SE.id, faculty: das.faculty.id, section: secB25.id, day: "MON", start: "09:00", end: "10:00" },
    { subject: DBMS.id, faculty: verma.faculty.id, section: secB25.id, day: "MON", start: "10:15", end: "11:15" },
    { subject: DBMS.id, faculty: verma.faculty.id, section: secB25.id, day: "TUE", start: "08:00", end: "09:00" },
    { subject: AI.id, faculty: sharma.faculty.id, section: secB25.id, day: "TUE", start: "09:00", end: "10:00" },
    { subject: CN.id, faculty: iyer.faculty.id, section: secB25.id, day: "TUE", start: "10:15", end: "11:15" },
    { subject: JAVA.id, faculty: verma.faculty.id, section: secB25.id, day: "WED", start: "08:00", end: "09:00" },
    { subject: SE.id, faculty: das.faculty.id, section: secB25.id, day: "WED", start: "09:00", end: "10:00" },
    { subject: AI.id, faculty: sharma.faculty.id, section: secB25.id, day: "WED", start: "10:15", end: "11:15" },
    { subject: JAVA.id, faculty: verma.faculty.id, section: secB25.id, day: "THU", start: "08:00", end: "09:00" },
    { subject: CN.id, faculty: iyer.faculty.id, section: secB25.id, day: "THU", start: "09:00", end: "10:00" },
    { subject: SE.id, faculty: das.faculty.id, section: secB25.id, day: "FRI", start: "08:00", end: "09:00" },
    { subject: JAVA.id, faculty: verma.faculty.id, section: secB25.id, day: "FRI", start: "10:15", end: "11:15" },
    // Sem 1, Section A (2026 batch)
    { subject: C.id, faculty: patel.faculty.id, section: secA26.id, day: "MON", start: "08:00", end: "09:00" },
    { subject: DM.id, faculty: das.faculty.id, section: secA26.id, day: "TUE", start: "08:00", end: "09:00" },
    { subject: CO.id, faculty: iyer.faculty.id, section: secA26.id, day: "WED", start: "10:15", end: "11:15" },
    { subject: DS.id, faculty: verma.faculty.id, section: secA26.id, day: "THU", start: "10:15", end: "11:15" },
    { subject: C.id, faculty: patel.faculty.id, section: secA26.id, day: "FRI", start: "09:00", end: "10:00" },
  ];
  // Guard: the demo timetable itself must be conflict-free (a teacher cannot be in two rooms at once).
  for (const a of slots) {
    for (const b of slots) {
      if (a !== b && a.day === b.day && a.start < b.end && b.start < a.end && (a.faculty === b.faculty || a.section === b.section)) {
        throw new Error(`Demo timetable conflict on ${a.day} ${a.start}`);
      }
    }
  }
  if ((await prisma.timetableSlot.count({ where: { sectionId: { in: [secA25.id, secB25.id, secA26.id] } } })) === 0) {
    await prisma.timetableSlot.createMany({
      data: slots.map((s) => ({ subjectId: s.subject, facultyId: s.faculty, sectionId: s.section, dayOfWeek: s.day, startTime: s.start, endTime: s.end })),
    });
  }

  // ----------------------------------------------------------------------------------- students
  console.log("Students (this creates ~140 accounts)...");
  type Plan = {
    key: string; index: number; roll: string; first: string; last: string; section: "A" | "B";
    kind: "REGULAR" | "SECTION_CHANGE" | "DEFERRED" | "LATE" | "CURRENT_ONLY";
    admitted?: string; deferredOn?: string;
  };
  const plans: Plan[] = [];
  // batch 2025: Section A = 61 rows (60 active on the test date + 1 deferred), Section B = 40 rows
  for (let i = 1; i <= 61; i += 1) {
    const n = nameAt(i - 1);
    let kind: Plan["kind"] = "REGULAR";
    const extra: Partial<Plan> = {};
    if (i === 1) { n.firstName = "Amit"; n.lastName = "Kumar"; }
    if (i === 61) { n.firstName = "Deepak"; n.lastName = "Nair"; kind = "DEFERRED"; extra.deferredOn = "2026-08-15"; }
    if (i === 60) { n.firstName = "Farhan"; n.lastName = "Ali"; kind = "LATE"; extra.admitted = "2026-08-20"; }
    if (i === 17) { n.firstName = "Sneha"; n.lastName = "Reddy"; }
    plans.push({ key: `A${i}`, index: i, roll: `MCA25A${String(i).padStart(3, "0")}`, first: n.firstName, last: n.lastName, section: "A", kind, ...extra });
  }
  for (let i = 1; i <= 40; i += 1) {
    const n = nameAt(100 + i);
    let kind: Plan["kind"] = "REGULAR";
    if (i === 12) { n.firstName = "Rahul"; n.lastName = "Kumar"; kind = "SECTION_CHANGE"; } // Section A in 2025-26, Section B now
    plans.push({ key: `B${i}`, index: 100 + i, roll: `MCA25B${String(i).padStart(3, "0")}`, first: n.firstName, last: n.lastName, section: "B", kind });
  }

  const studentByKey = new Map<string, { studentId: string; e3: string | null }>();
  for (const p of plans) {
    const email = `${p.roll.toLowerCase()}@student.unisphere.edu`;
    const existingUser = await prisma.user.findUnique({ where: { email }, include: { student: true } });
    if (existingUser?.student) {
      const open = await prisma.studentEnrollment.findFirst({ where: { studentId: existingUser.student.id, academicSessionId: S2627, semesterId: semId[3] } });
      studentByKey.set(p.key, { studentId: existingUser.student.id, e3: open?.id ?? null });
      continue;
    }
    const user = await prisma.user.create({
      data: { universityId: `STU25${String(p.index).padStart(4, "0")}`, email, passwordHash, firstName: p.first, lastName: p.last, roleId: roleIds.student, mustResetPassword: false },
    });
    const sec3 = p.section === "A" ? secA25.id : secB25.id;
    const sec12 = p.kind === "SECTION_CHANGE" ? secA25.id : sec3; // Rahul sat in Section A during 2025-26
    const student = await prisma.student.create({
      data: {
        userId: user.id, rollNumber: p.roll, registrationNumber: `UNI2025${String(p.index).padStart(5, "0")}`,
        departmentId: dept.id, programId: program.id, batchId: batch25.id, sectionId: sec3, currentSemester: 3, admissionYear: 2025,
        gender: p.index % 2 === 0 ? "Female" : "Male", guardianName: `${nameAt(p.index + 3).firstName} ${p.last}`, guardianRelation: "Father", guardianPhone: `98${String(10000000 + p.index * 137).slice(0, 8)}`,
      },
    });
    const base = { studentId: student.id, departmentId: dept.id, programId: program.id, batchId: batch25.id, admissionYear: 2025 };
    const e1 = await prisma.studentEnrollment.create({
      data: { ...base, academicSessionId: S2526, semesterId: semId[1], sectionId: sec12, admissionDate: utc("2025-07-01"), endDate: utc("2025-12-31"), enrollmentType: "REGULAR", status: "PROMOTED" },
    });
    const e2 = await prisma.studentEnrollment.create({
      data: { ...base, academicSessionId: S2526, semesterId: semId[2], sectionId: sec12, admissionDate: utc("2026-01-01"), endDate: utc("2026-06-30"), enrollmentType: "PROMOTION", status: "PROMOTED", previousEnrollmentId: e1.id },
    });
    const start = p.kind === "LATE" ? utc(p.admitted!) : utc("2026-07-01");
    const e3 = await prisma.studentEnrollment.create({
      data: {
        ...base, academicSessionId: S2627, semesterId: semId[3], sectionId: sec3, admissionDate: start,
        endDate: p.kind === "DEFERRED" ? addDays(utc(p.deferredOn!), -1) : null,
        enrollmentType: p.kind === "LATE" ? "LATERAL" : "PROMOTION",
        status: p.kind === "DEFERRED" ? "DEFERRED" : "ACTIVE",
        reasonNote: p.kind === "DEFERRED" ? "Deferred the semester for medical reasons" : p.kind === "SECTION_CHANGE" ? "Moved to Section B when promoted" : undefined,
        previousEnrollmentId: e2.id,
      },
    });
    studentByKey.set(p.key, { studentId: student.id, e3: e3.id });
    (studentByKey.get(p.key) as any).e2 = e2.id;
  }

  // batch 2026, Semester 1, Section A
  const sem1Students: { studentId: string; enrollmentId: string; index: number }[] = [];
  for (let i = 1; i <= 30; i += 1) {
    const n = nameAt(200 + i);
    const roll = `MCA26A${String(i).padStart(3, "0")}`;
    const email = `${roll.toLowerCase()}@student.unisphere.edu`;
    const existingUser = await prisma.user.findUnique({ where: { email }, include: { student: true } });
    if (existingUser?.student) {
      const e = await prisma.studentEnrollment.findFirstOrThrow({ where: { studentId: existingUser.student.id, semesterId: semId[1], academicSessionId: S2627 } });
      sem1Students.push({ studentId: existingUser.student.id, enrollmentId: e.id, index: i });
      continue;
    }
    const user = await prisma.user.create({
      data: { universityId: `STU26${String(i).padStart(4, "0")}`, email, passwordHash, firstName: n.firstName, lastName: n.lastName, roleId: roleIds.student, mustResetPassword: false },
    });
    const student = await prisma.student.create({
      data: {
        userId: user.id, rollNumber: roll, registrationNumber: `UNI2026${String(i).padStart(5, "0")}`, departmentId: dept.id, programId: program.id,
        batchId: batch26.id, sectionId: secA26.id, currentSemester: 1, admissionYear: 2026,
      },
    });
    const e = await prisma.studentEnrollment.create({
      data: {
        studentId: student.id, academicSessionId: S2627, departmentId: dept.id, programId: program.id, batchId: batch26.id, semesterId: semId[1],
        sectionId: secA26.id, admissionYear: 2026, admissionDate: utc("2026-07-15"), enrollmentType: "REGULAR", status: "ACTIVE",
      },
    });
    sem1Students.push({ studentId: student.id, enrollmentId: e.id, index: i });
  }

  // Vikram Rao - REPEAT: failed Semester 1 with the 2025 batch, repeats it with the 2026 batch
  {
    const email = "vikram.rao@student.unisphere.edu";
    if (!(await prisma.user.findUnique({ where: { email } }))) {
      const user = await prisma.user.create({
        data: { universityId: "STU250999", email, passwordHash, firstName: "Vikram", lastName: "Rao", roleId: roleIds.student, mustResetPassword: false },
      });
      const student = await prisma.student.create({
        data: { userId: user.id, rollNumber: "MCA26R001", registrationNumber: "UNI202500999", departmentId: dept.id, programId: program.id, batchId: batch26.id, sectionId: secA26.id, currentSemester: 1, admissionYear: 2025 },
      });
      const first = await prisma.studentEnrollment.create({
        data: {
          studentId: student.id, academicSessionId: S2526, departmentId: dept.id, programId: program.id, batchId: batch25.id, semesterId: semId[1],
          sectionId: secA25.id, admissionYear: 2025, admissionDate: utc("2025-07-01"), endDate: utc("2026-06-30"), enrollmentType: "REGULAR", status: "REPEATED",
        },
      });
      await prisma.studentEnrollment.create({
        data: {
          studentId: student.id, academicSessionId: S2627, departmentId: dept.id, programId: program.id, batchId: batch26.id, semesterId: semId[1],
          sectionId: secA26.id, admissionYear: 2026, admissionDate: utc("2026-07-15"), enrollmentType: "REPEAT", status: "ACTIVE",
          readmissionReason: "ACADEMIC_REPEAT", reasonNote: "Repeating Semester 1 after failing three subjects", previousEnrollmentId: first.id,
        },
      });
    }
  }
  // Sneha Reddy - BACKLOG: Semester 3 student re-attending Programming with C with the 2026 batch
  {
    const sneha = studentByKey.get("A17");
    if (sneha?.e3) {
      await prisma.studentSubjectRegistration.upsert({
        where: { enrollmentId_subjectId: { enrollmentId: sneha.e3, subjectId: C.id } },
        update: {}, create: { enrollmentId: sneha.e3, subjectId: C.id, sectionId: secA26.id, academicSessionId: S2627, type: "BACKLOG" },
      });
    }
  }
  // Elective: Data Analytics is taken by 12 Section A students only
  for (let i = 2; i <= 13; i += 1) {
    const s = studentByKey.get(`A${i}`);
    if (s?.e3) {
      await prisma.studentSubjectRegistration.upsert({
        where: { enrollmentId_subjectId: { enrollmentId: s.e3, subjectId: DA.id } },
        update: {}, create: { enrollmentId: s.e3, subjectId: DA.id, sectionId: secA25.id, academicSessionId: S2627, type: "ELECTIVE" },
      });
    }
  }

  // MBA (other department): 5 students in Semester 3, Section A
  for (let i = 1; i <= 5; i += 1) {
    const roll = `MBA25A${String(i).padStart(3, "0")}`;
    const email = `${roll.toLowerCase()}@student.unisphere.edu`;
    if (await prisma.user.findUnique({ where: { email } })) continue;
    const n = nameAt(300 + i);
    const user = await prisma.user.create({
      data: { universityId: `STU25M${String(i).padStart(3, "0")}`, email, passwordHash, firstName: n.firstName, lastName: n.lastName, roleId: roleIds.student, mustResetPassword: false },
    });
    const student = await prisma.student.create({
      data: { userId: user.id, rollNumber: roll, departmentId: mgmt.id, programId: mba.id, batchId: mbaBatch.id, sectionId: mbaSecA.id, currentSemester: 3, admissionYear: 2025 },
    });
    await prisma.studentEnrollment.create({
      data: {
        studentId: student.id, academicSessionId: S2627, departmentId: mgmt.id, programId: mba.id, batchId: mbaBatch.id, semesterId: mbaSem3,
        sectionId: mbaSecA.id, admissionYear: 2025, admissionDate: utc("2026-07-01"), enrollmentType: "PROMOTION", status: "ACTIVE",
      },
    });
  }

  // ----------------------------------------------------------------------------------- past attendance
  const already = await prisma.attendanceSession.count({ where: { sectionId: { in: [secA25.id, secB25.id, secA26.id] } } });
  if (already > 0) {
    console.log("Attendance history already present - skipping.");
  } else {
    console.log("Attendance history (Aug-Sep 2026 and Feb 2026)...");
    // per-student attendance propensity: most ~90%, some ~72% (warning), some ~58% (critical)
    const propensity = (index: number) => (index % 11 === 0 ? 0.58 : index % 5 === 0 ? 0.72 : 0.9 - (index % 7) * 0.01);
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { academicSessionId: S2627, sectionId: { in: [secA25.id, secB25.id, secA26.id] } },
      include: { student: true },
    });
    const regs = await prisma.studentSubjectRegistration.findMany({ where: { academicSessionId: S2627 }, include: { enrollment: { include: { student: true } } } });
    const periodOf = (start: string) => PERIODS.find((p) => p[1] === start)![0];
    const coveredClasses = (start: string, end: string) => PERIODS.filter((p) => p[1] >= start && p[2] <= end).length;

    const last = utc("2026-09-04");
    for (let d = utc("2026-08-03"); d <= last; d = addDays(d, 1)) {
      const day = DAY_INDEX[d.getUTCDay()];
      if (!day) continue;
      for (const s of slots.filter((x) => x.day === day)) {
        const semester = s.section === secA26.id ? 1 : 3;
        const roster = enrollments
          .filter((e) => e.sectionId === s.section && e.semesterId === semId[semester as 1 | 3] && e.admissionDate <= d && (!e.endDate || e.endDate >= d))
          .map((e) => ({ enrollmentId: e.id, studentId: e.studentId, index: Number(e.student.rollNumber.replace(/\D/g, "").slice(-3)) }));
        if (s.section === secA26.id) {
          for (const r of regs.filter((r) => r.subjectId === s.subject && r.sectionId === s.section && r.enrollment.admissionDate <= d)) {
            if (!roster.some((x) => x.studentId === r.enrollment.studentId)) roster.push({ enrollmentId: r.enrollmentId, studentId: r.enrollment.studentId, index: 5 });
          }
        }
        if (roster.length === 0) continue;
        const classes = coveredClasses(s.start, s.end);
        const first = periodOf(s.start);
        await prisma.attendanceSession.create({
          data: {
            academicSessionId: S2627, semester, semesterId: semId[semester as 1 | 3], departmentId: dept.id, programId: program.id,
            sectionId: s.section, subjectId: s.subject, facultyId: s.faculty, recordedById: [sharma, verma, iyer, das, patel].find((f) => f.faculty.id === s.faculty)!.user.id,
            date: d, period: first, numberOfClasses: classes, startTime: s.start, endTime: s.end, status: "SUBMITTED",
            records: { create: roster.map((r) => ({ studentId: r.studentId, enrollmentId: r.enrollmentId, status: rand() < propensity(r.index) ? "PRESENT" : "ABSENT" })) },
            slots: { create: Array.from({ length: classes }, (_, k) => ({ sectionId: s.section, subjectId: s.subject, date: d, periodNumber: first + k })) },
          },
        });
      }
    }

    // Semester 2 of the previous session (kept linked to each student's OLD enrollment after promotion)
    const past = await prisma.studentEnrollment.findMany({ where: { academicSessionId: S2526, semesterId: semId[2], sectionId: secA25.id } });
    for (const [dateStr, subjectId, facultyId, period] of [
      ["2026-02-09", OOP.id, verma.faculty.id, 1], ["2026-02-11", OS.id, iyer.faculty.id, 2], ["2026-02-16", OOP.id, verma.faculty.id, 1], ["2026-02-18", OS.id, iyer.faculty.id, 2],
    ] as const) {
      const d = utc(dateStr);
      await prisma.attendanceSession.create({
        data: {
          academicSessionId: S2526, semester: 2, semesterId: semId[2], departmentId: dept.id, programId: program.id, sectionId: secA25.id, subjectId,
          facultyId, recordedById: facultyId === verma.faculty.id ? verma.user.id : iyer.user.id, date: d, period, numberOfClasses: 1,
          startTime: PERIODS[period - 1][1], endTime: PERIODS[period - 1][2], status: "SUBMITTED",
          records: { create: past.map((e, k) => ({ studentId: e.studentId, enrollmentId: e.id, status: rand() < propensity(k + 1) ? "PRESENT" : "ABSENT" })) },
          slots: { create: [{ sectionId: secA25.id, subjectId, date: d, periodNumber: period }] },
        },
      });
    }
  }

  const counts = {
    students: await prisma.student.count(), enrollments: await prisma.studentEnrollment.count(),
    sessions: await prisma.attendanceSession.count(), records: await prisma.attendanceRecord.count(),
  };
  console.log("\nDemo data ready:", counts);
  console.log("\nLogin accounts (password: Demo@1234)");
  console.log("  Faculty   priya.sharma@unisphere.edu    DBMS (Section A), AI (Section B), Data Analytics elective");
  console.log("  Faculty   rakesh.verma@unisphere.edu    Java (A, B), DBMS (Section B), Data Structures");
  console.log("  HOD       hod.mehta@unisphere.edu       Department of Computer Applications");
  console.log("  Admin     admin@unisphere.edu");
  console.log("  Student   mca25a001@student.unisphere.edu   (Amit Kumar, Semester 3 Section A)");
  console.log("  Student   mca25b012@student.unisphere.edu   (Rahul Kumar - promoted A -> B, full history)");
  console.log("  Student   vikram.rao@student.unisphere.edu  (repeat / readmission)");
  console.log("  Student   mca25a017@student.unisphere.edu   (Sneha Reddy - backlog in Programming with C)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
