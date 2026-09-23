import { Router } from "express";
import QRCode from "qrcode";
import { prisma } from "../../config/db";
import { authenticate } from "../../middleware/authenticate";
import { ApiError } from "../../utils/ApiError";
import { catchAsync } from "../../utils/catchAsync";
import { assertCanViewStudent } from "../../utils/studentAccess";

const router = Router();
router.use(authenticate);

async function buildCard(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true, department: true, program: true, batch: true },
  });
  if (!student) throw ApiError.notFound("Student not found");

  const verifyPayload = JSON.stringify({
    universityId: student.user.universityId,
    name: `${student.user.firstName} ${student.user.lastName}`,
    department: student.department.code,
    rollNumber: student.rollNumber,
  });

  const qrDataUrl = await QRCode.toDataURL(verifyPayload, { width: 240, margin: 1 });

  return {
    universityId: student.user.universityId,
    fullName: `${student.user.firstName} ${student.user.lastName}`,
    rollNumber: student.rollNumber,
    department: student.department.name,
    program: student.program.name,
    batch: student.batch.label,
    profilePhoto: student.user.profilePhoto,
    validUntil: `${student.batch.endYear}`,
    qrDataUrl,
  };
}

router.get(
  "/me",
  catchAsync(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const student = await prisma.student.findUnique({ where: { userId: req.user.userId } });
    if (!student) throw ApiError.notFound("No student profile linked to this account");
    const card = await buildCard(student.id);
    res.status(200).json({ card });
  })
);

router.get(
  "/student/:studentId",
  catchAsync(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    await assertCanViewStudent(req.user, req.params.studentId);
    const card = await buildCard(req.params.studentId);
    res.status(200).json({ card });
  })
);

export default router;
