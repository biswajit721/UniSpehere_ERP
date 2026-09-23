import { Router } from "express";
import { prisma } from "../../config/db";
import { authenticate } from "../../middleware/authenticate";
import { ApiError } from "../../utils/ApiError";
import { catchAsync } from "../../utils/catchAsync";
import { askGemini } from "../../utils/gemini";
import { getPolicy, totalsForStudent } from "../attendance/attendance.stats";

const router = Router();
router.use(authenticate);

async function gatherContext(userId: string, role: string): Promise<string> {
  if (role !== "STUDENT") {
    return `The user is a ${role.replace("_", " ")}. Answer generally about how UniSphere ERP works — Academics, Attendance, Examination, Fees, Timetable, Library, Placement, Leave, Grievance, Notices.`;
  }

  const student = await prisma.student.findUnique({
    where: { userId },
    include: { department: true, batch: true },
  });
  if (!student) return "No student profile found for this user.";

  const policy = await getPolicy();
  const [attendanceTotals, fees, marks, notices] = await Promise.all([
    totalsForStudent(student.id, {}, policy),
    prisma.fee.findMany({ where: { studentId: student.id }, include: { payments: true } }),
    prisma.marks.findMany({ where: { studentId: student.id, exam: { status: "PUBLISHED" } }, include: { exam: { include: { subject: true } } } }),
    prisma.notice.findMany({ where: { OR: [{ targetRole: null }, { targetRole: "STUDENT" }] }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const attendancePct = attendanceTotals.conducted > 0 ? attendanceTotals.percentage : null;

  const pendingFees = fees.reduce((sum, f) => {
    const paid = f.payments.reduce((s, p) => s + Number(p.amountPaid), 0);
    return sum + Math.max(0, Number(f.amountDue) - paid);
  }, 0);

  const resultsSummary = marks
    .map((m) => `${m.exam.subject.name}: ${Math.round((Number(m.marksObtained) / m.exam.totalMarks) * 100)}%`)
    .join(", ") || "none published yet";

  const noticesSummary = notices.map((n) => `"${n.title}" (${n.category})`).join("; ") || "none";

  return `Student: ${student.rollNumber}, ${student.department.name}, batch ${student.batch.label}, semester ${student.currentSemester}.
Overall attendance: ${attendancePct !== null ? `${attendancePct}%` : "no data yet"}.
Pending fees: ₹${pendingFees}.
Published exam results: ${resultsSummary}.
Recent notices: ${noticesSummary}.`;
}

router.post(
  "/ask",
  catchAsync(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      throw ApiError.badRequest("message is required");
    }

    const context = await gatherContext(req.user.userId, req.user.roleName);
    const prompt = `You are the UniSphere ERP assistant, helping a university user with questions about their attendance, fees, exams, timetable, and general use of the ERP system. Be concise (2-4 sentences), friendly, and use the real data below when relevant. If asked something outside this ERP's scope, say so briefly.

Context about this user:
${context}

User's question: ${message}`;

    try {
      const reply = await askGemini(prompt);
      res.status(200).json({ reply, aiPowered: true });
    } catch (err: any) {
      // Surface the real reason so the problem is debuggable instead of silently degrading.
      res.status(200).json({
        reply: `The AI assistant isn't available right now. ${err?.message ?? ""}`.trim(),
        aiPowered: false,
      });
    }
  })
);

export default router;
