import { prisma } from "../../config/db";
import { NotificationType } from "@prisma/client";

export const notificationsRepository = {
  createMany(rows: { userId: string; title: string; message: string; type: NotificationType }[]) {
    if (rows.length === 0) return Promise.resolve({ count: 0 });
    return prisma.notification.createMany({ data: rows });
  },

  createOne(row: { userId: string; title: string; message: string; type: NotificationType }) {
    return prisma.notification.create({ data: row });
  },

  listForUser(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
  },

  unreadCount(userId: string) {
    return prisma.notification.count({ where: { userId, isRead: false } });
  },

  markRead(id: string, userId: string) {
    return prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  },

  markAllRead(userId: string) {
    return prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  },

  allUserIdsByRole(role: string) {
    return prisma.user.findMany({ where: { role: { name: role }, isActive: true }, select: { id: true } });
  },

  allActiveUserIds() {
    return prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
  },

  userIdsInDepartment(departmentId: string) {
    return prisma.user.findMany({
      where: {
        isActive: true,
        OR: [{ student: { departmentId } }, { faculty: { departmentId } }],
      },
      select: { id: true },
    });
  },
};
