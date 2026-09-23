import { Router } from "express";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import { prisma } from "../../config/db";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { resolveActor } from "../../utils/actor";
import { ApiError } from "../../utils/ApiError";
import { catchAsync } from "../../utils/catchAsync";
import { assertCanAccessClass } from "../attendance/attendance.scope";
import { getPolicy, totalsByStudent } from "../attendance/attendance.stats";

const router = Router();
router.use(authenticate);

router.get(
  "/students.xlsx",
  authorize("students", "read"),
  catchAsync(async (req, res) => {
    const departmentId = req.query.departmentId as string | undefined;
    const students = await prisma.student.findMany({
      where: { deletedAt: null, ...(departmentId && { departmentId }) },
      include: { user: true, department: true, program: true, batch: true, section: true },
      orderBy: { rollNumber: "asc" },
    });

    const rows = students.map((s) => ({
      "University ID": s.user.universityId,
      "Name": `${s.user.firstName} ${s.user.lastName}`,
      "Roll Number": s.rollNumber,
      "Email": s.user.email,
      "Department": s.department.name,
      "Program": s.program.name,
      "Batch": s.batch.label,
      "Section": s.section?.name ?? "",
      "Semester": s.currentSemester,
      "CGPA": s.cgpa ? Number(s.cgpa) : "",
      "Status": s.user.isActive ? "Active" : "Suspended",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=students-report.xlsx");
    res.send(buffer);
  })
);

router.get(
  "/fees.xlsx",
  authorize("fees", "read"),
  catchAsync(async (_req, res) => {
    const fees = await prisma.fee.findMany({
      include: { student: { include: { user: true } }, payments: true },
      orderBy: { dueDate: "asc" },
    });

    const rows = fees.map((f) => {
      const paid = f.payments.reduce((s, p) => s + Number(p.amountPaid), 0);
      return {
        "University ID": f.student.user.universityId,
        "Student": `${f.student.user.firstName} ${f.student.user.lastName}`,
        "Fee Type": f.feeType,
        "Amount Due": Number(f.amountDue),
        "Amount Paid": paid,
        "Pending": Math.max(0, Number(f.amountDue) - paid),
        "Due Date": f.dueDate.toISOString().slice(0, 10),
        "Status": f.status,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fee Collection");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=fee-collection-report.xlsx");
    res.send(buffer);
  })
);

router.get(
  "/attendance.pdf",
  authorize("attendance", "read"),
  catchAsync(async (req, res) => {
    const subjectId = req.query.subjectId as string | undefined;
    const sectionId = req.query.sectionId as string | undefined;
    const academicSessionId = req.query.academicSessionId as string | undefined;
    if (!subjectId || !sectionId || !academicSessionId) {
      throw ApiError.badRequest("subjectId, sectionId and academicSessionId are required");
    }

    const [subject, section, session] = await Promise.all([
      prisma.subject.findUnique({ where: { id: subjectId } }),
      prisma.section.findUnique({ where: { id: sectionId }, include: { batch: { include: { program: true } } } }),
      prisma.academicSession.findUnique({ where: { id: academicSessionId } }),
    ]);
    if (!subject || !section || !session) throw ApiError.notFound("Subject, section or academic session not found");
    if (!subject.semesterId) throw ApiError.badRequest("This subject is not linked to a semester yet");

    // Students may never download class-wide reports; faculty only for classes they teach.
    const actor = await resolveActor(req.user!);
    if (actor.scope === "SELF") throw ApiError.forbidden("Students cannot download class reports.");
    await assertCanAccessClass(
      actor,
      { academicSessionId, departmentId: section.batch.program.departmentId, sectionId, subjectId },
      "download reports for"
    );

    // Everyone who was enrolled in this class during the session, in roll-number order.
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { academicSessionId, sectionId, semesterId: subject.semesterId },
      include: { student: { include: { user: true } } },
    });
    const students = [...new Map(enrollments.map((e) => [e.studentId, e.student])).values()].sort((a, b) =>
      a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true })
    );

    const policy = await getPolicy();
    const totals = await totalsByStudent({ academicSessionId, sectionId, subjectId }, policy);

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=attendance-report.pdf");
    doc.pipe(res);

    doc.fontSize(16).text("UniSphere ERP — Attendance Report", { align: "center" });
    doc.fontSize(11).text(`${subject.code} · ${subject.name}`, { align: "center" });
    doc
      .fontSize(10)
      .text(`${section.batch.program.name} · ${section.batch.label} · Section ${section.name} · ${session.label}`, { align: "center" });
    doc.moveDown(1.5);

    for (const s of students) {
      const t = totals.get(s.id) ?? { conducted: 0, present: 0 };
      const pct = t.conducted > 0 ? Math.round((t.present / t.conducted) * 1000) / 10 : 0;
      doc
        .fontSize(10)
        .text(`${s.rollNumber}  ${s.user.firstName} ${s.user.lastName}  —  ${t.present}/${t.conducted} (${pct}%)`);
    }

    doc.end();
  })
);

export default router;
