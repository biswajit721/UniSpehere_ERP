import { prisma } from "../../config/db";

export const hostelRepository = {
  listHostels() {
    return prisma.hostel.findMany({
      include: {
        rooms: {
          include: { allocations: { where: { status: "ACTIVE" } } },
        },
      },
      orderBy: { name: "asc" },
    });
  },

  createHostel(data: { name: string; warden?: string }) {
    return prisma.hostel.create({ data });
  },

  createRoom(hostelId: string, data: { roomNumber: string; capacity: number }) {
    return prisma.room.create({ data: { ...data, hostelId } });
  },

  findRoom(id: string) {
    return prisma.room.findUnique({
      where: { id },
      include: { allocations: { where: { status: "ACTIVE" } } },
    });
  },

  createAllocation(roomId: string, studentId: string) {
    return prisma.roomAllocation.create({ data: { roomId, studentId } });
  },

  findActiveAllocationForStudent(studentId: string) {
    return prisma.roomAllocation.findFirst({
      where: { studentId, status: "ACTIVE" },
      include: { room: { include: { hostel: true } } },
    });
  },

  vacate(id: string) {
    return prisma.roomAllocation.update({
      where: { id },
      data: { status: "VACATED", vacatedAt: new Date() },
    });
  },

  findAllocation(id: string) {
    return prisma.roomAllocation.findUnique({ where: { id } });
  },
};
