import { prisma } from "../../config/db";

export const timetableRepository = {
  list(params: { sectionId?: string; facultyId?: string }) {
    return prisma.timetableSlot.findMany({
      where: {
        ...(params.sectionId && { sectionId: params.sectionId }),
        ...(params.facultyId && { facultyId: params.facultyId }),
      },
      include: {
        subject: true,
        faculty: { include: { user: true } },
        section: { include: { batch: { include: { program: true } } } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  },

  findOverlapping(params: {
    facultyId: string;
    sectionId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
  }) {
    return prisma.timetableSlot.findMany({
      where: {
        dayOfWeek: params.dayOfWeek as any,
        OR: [{ facultyId: params.facultyId }, { sectionId: params.sectionId }],
        AND: [{ startTime: { lt: params.endTime } }, { endTime: { gt: params.startTime } }],
      },
      include: { subject: true, faculty: { include: { user: true } } },
    });
  },

  create(data: {
    subjectId: string;
    facultyId: string;
    sectionId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    room?: string;
  }) {
    return prisma.timetableSlot.create({
      data: data as any,
      include: { subject: true, faculty: { include: { user: true } }, section: true },
    });
  },

  delete(id: string) {
    return prisma.timetableSlot.delete({ where: { id } });
  },
};
