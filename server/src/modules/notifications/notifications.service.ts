import { NotificationType } from "@prisma/client";
import { notificationsRepository } from "./notifications.repository";

export const notificationsService = {
  async notifyUser(userId: string, title: string, message: string, type: NotificationType) {
    await notificationsRepository.createOne({ userId, title, message, type });
  },

  async notifyRole(role: string, title: string, message: string, type: NotificationType) {
    const users = await notificationsRepository.allUserIdsByRole(role);
    await notificationsRepository.createMany(users.map((u) => ({ userId: u.id, title, message, type })));
  },

  async notifyDepartment(departmentId: string, title: string, message: string, type: NotificationType) {
    const users = await notificationsRepository.userIdsInDepartment(departmentId);
    await notificationsRepository.createMany(users.map((u) => ({ userId: u.id, title, message, type })));
  },

  async notifyAll(title: string, message: string, type: NotificationType) {
    const users = await notificationsRepository.allActiveUserIds();
    await notificationsRepository.createMany(users.map((u) => ({ userId: u.id, title, message, type })));
  },

  async inbox(userId: string) {
    const [items, unread] = await Promise.all([
      notificationsRepository.listForUser(userId),
      notificationsRepository.unreadCount(userId),
    ]);
    return { items, unread };
  },

  markRead(id: string, userId: string) {
    return notificationsRepository.markRead(id, userId);
  },

  markAllRead(userId: string) {
    return notificationsRepository.markAllRead(userId);
  },
};
