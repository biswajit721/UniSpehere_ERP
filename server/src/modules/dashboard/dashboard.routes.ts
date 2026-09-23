import { Router } from "express";
import { prisma } from "../../config/db";
import { authenticate } from "../../middleware/authenticate";
import { catchAsync } from "../../utils/catchAsync";
import { getPolicy, totalsForStudent } from "../attendance/attendance.stats";

const router = Router();
router.use(authenticate);

router.get(
  "/summary",
  catchAsync(async (req, res) => {
    const role = req.user!.roleName;

    if (["SUPER_ADMIN", "UNIV_ADMIN", "PRINCIPAL", "HOD"].includes(role)) {
      const [totalStudents, totalFaculty, totalDepartments, totalSubjects, pendingFees] = await Promise.all([
        prisma.student.count({ where: { deletedAt: null } }),
        prisma.faculty.count({ where: { deletedAt: null } }),
        prisma.department.count({ where: { deletedAt: null } }),
        prisma.subject.count({ where: { deletedAt: null } }),
        prisma.fee.aggregate({ _sum: { amountDue: true }, where: { status: { not: "PAID" } } }),
      ]);
      return res.status(200).json({
        role,
        stats: [
          { label: "Total Students", value: totalStudents },
          { label: "Total Faculty", value: totalFaculty },
          { label: "Departments", value: totalDepartments },
          { label: "Subjects Offered", value: totalSubjects },
        ],
        pendingFeesTotal: Number(pendingFees._sum.amountDue ?? 0),
      });
    }

    if (role === "FACULTY") {
      const faculty = await prisma.faculty.findUnique({ where: { userId: req.user!.userId } });
      if (!faculty) return res.status(200).json({ role, stats: [] });
      // Subjects taught = default faculty of the subject, or assigned to a section of it.
      const [subjectCount, draftExams] = await Promise.all([
        prisma.subject.count({
          where: {
            deletedAt: null,
            OR: [{ facultyId: faculty.id }, { facultyAssignments: { some: { facultyId: faculty.id } } }],
          },
        }),
        prisma.exam.count({ where: { subject: { facultyId: faculty.id }, status: "DRAFT" } }),
      ]);
      return res.status(200).json({
        role,
        stats: [
          { label: "My Subjects", value: subjectCount },
          { label: "Exams Awaiting Publish", value: draftExams },
        ],
      });
    }

    if (role === "STUDENT") {
      const student = await prisma.student.findUnique({ where: { userId: req.user!.userId } });
      if (!student) return res.status(200).json({ role, stats: [] });

      const policy = await getPolicy();
      const [attendanceTotals, pendingFees, publishedResults] = await Promise.all([
        totalsForStudent(student.id, {}, policy),
        prisma.fee.findMany({ where: { studentId: student.id }, include: { payments: true } }),
        prisma.marks.count({ where: { studentId: student.id, exam: { status: "PUBLISHED" } } }),
      ]);

      const attendancePct = attendanceTotals.conducted > 0 ? attendanceTotals.percentage : null;

      const pendingAmount = pendingFees.reduce((sum, f) => {
        const paid = f.payments.reduce((s, p) => s + Number(p.amountPaid), 0);
        return sum + Math.max(0, Number(f.amountDue) - paid);
      }, 0);

      return res.status(200).json({
        role,
        stats: [
          { label: "Attendance", value: attendancePct !== null ? `${attendancePct}%` : "—" },
          { label: "Pending Fees", value: `₹${pendingAmount.toLocaleString()}` },
          { label: "Published Results", value: publishedResults },
        ],
      });
    }

    if (role === "ACCOUNTANT") {
      const [pendingFees, paidCount] = await Promise.all([
        prisma.fee.aggregate({ _sum: { amountDue: true }, where: { status: { not: "PAID" } } }),
        prisma.payment.count(),
      ]);
      return res.status(200).json({
        role,
        stats: [
          { label: "Outstanding Dues", value: `₹${Number(pendingFees._sum.amountDue ?? 0).toLocaleString()}` },
          { label: "Payments Recorded", value: paidCount },
        ],
      });
    }

    if (role === "EXAM_CONTROLLER") {
      const [draft, published] = await Promise.all([
        prisma.exam.count({ where: { status: "DRAFT" } }),
        prisma.exam.count({ where: { status: "PUBLISHED" } }),
      ]);
      return res.status(200).json({
        role,
        stats: [
          { label: "Draft Exams", value: draft },
          { label: "Published Exams", value: published },
        ],
      });
    }

    res.status(200).json({ role, stats: [] });
  })
);

export default router;
