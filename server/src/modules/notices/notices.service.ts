import { prisma } from "../../config/db";
import { notificationsService } from "../notifications/notifications.service";
import { noticesRepository } from "./notices.repository";

async function resolveDepartmentId(userId: string, role: string): Promise<string | undefined> {
  if (role === "STUDENT") {
    const s = await prisma.student.findUnique({ where: { userId } });
    return s?.departmentId;
  }
  if (role === "FACULTY" || role === "HOD") {
    const f = await prisma.faculty.findUnique({ where: { userId } });
    return f?.departmentId;
  }
  return undefined;
}

function toDto(n: any) {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    category: n.category,
    priority: n.priority,
    postedBy: `${n.postedBy.firstName} ${n.postedBy.lastName}`,
    targetRole: n.targetRole,
    createdAt: n.createdAt,
    expiresAt: n.expiresAt,
  };
}

export const noticesService = {
  async list(userId: string, role: string) {
    const departmentId = await resolveDepartmentId(userId, role);
    const rows = await noticesRepository.listFor(role, departmentId);
    return rows
      .filter((n) => !n.expiresAt || n.expiresAt > new Date())
      .map(toDto);
  },

  async create(input: {
    title: string;
    content: string;
    category: string;
    priority: string;
    targetRole?: string;
    targetDepartmentId?: string;
    expiresAt?: string;
    postedById: string;
  }) {
    const notice = await noticesRepository.create({
      ...input,
      category: input.category as any,
      priority: input.priority as any,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    });

    const title = `New notice: ${input.title}`;
    const message = input.content.slice(0, 140);
    if (input.targetRole) {
      await notificationsService.notifyRole(input.targetRole, title, message, "NOTICE");
    } else if (input.targetDepartmentId) {
      await notificationsService.notifyDepartment(input.targetDepartmentId, title, message, "NOTICE");
    } else {
      await notificationsService.notifyAll(title, message, "NOTICE");
    }

    return toDto(notice);
  },

  remove(id: string) {
    return noticesRepository.remove(id);
  },
};
