import { ApiError } from "../../utils/ApiError";
import { notificationsService } from "../notifications/notifications.service";
import { grievanceRepository } from "./grievance.repository";

function toDto(c: any) {
  return {
    id: c.id,
    raisedById: c.raisedById,
    raisedByName: c.raisedBy ? `${c.raisedBy.firstName} ${c.raisedBy.lastName}` : undefined,
    category: c.category,
    subject: c.subject,
    description: c.description,
    priority: c.priority,
    status: c.status,
    resolutionNote: c.resolutionNote,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export const grievanceService = {
  async create(raisedById: string, input: { category: string; subject: string; description: string; priority: string }) {
    const complaint = await grievanceRepository.create({
      raisedById,
      category: input.category as any,
      subject: input.subject,
      description: input.description,
      priority: input.priority as any,
    });
    return toDto(complaint);
  },

  async myComplaints(userId: string) {
    const rows = await grievanceRepository.listForUser(userId);
    return rows.map(toDto);
  },

  async allComplaints() {
    const rows = await grievanceRepository.listAll();
    return rows.map(toDto);
  },

  async update(id: string, status: string, resolutionNote?: string) {
    const existing = await grievanceRepository.findById(id);
    if (!existing) throw ApiError.notFound("Complaint not found");

    const updated = await grievanceRepository.update(id, { status: status as any, resolutionNote });

    await notificationsService.notifyUser(
      existing.raisedById,
      `Grievance "${existing.subject}" — ${status.replace("_", " ").toLowerCase()}`,
      resolutionNote || `Your ticket status changed to ${status.replace("_", " ").toLowerCase()}.`,
      "GRIEVANCE"
    );

    return toDto(updated);
  },
};
