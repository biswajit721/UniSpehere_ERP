import { ApiError } from "../../utils/ApiError";
import { notificationsService } from "../notifications/notifications.service";
import { leaveRepository } from "./leave.repository";

function toDto(l: any) {
  return {
    id: l.id,
    applicantId: l.applicantId,
    applicantName: l.applicant ? `${l.applicant.firstName} ${l.applicant.lastName}` : undefined,
    applicantRole: l.applicant?.role?.name,
    leaveType: l.leaveType,
    reason: l.reason,
    startDate: l.startDate,
    endDate: l.endDate,
    status: l.status,
    decisionNote: l.decisionNote,
    createdAt: l.createdAt,
  };
}

export const leaveService = {
  async create(applicantId: string, input: { leaveType: string; reason: string; startDate: string; endDate: string }) {
    const leave = await leaveRepository.create({
      applicantId,
      leaveType: input.leaveType as any,
      reason: input.reason,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
    });
    return toDto(leave);
  },

  async myRequests(applicantId: string) {
    const rows = await leaveRepository.listForApplicant(applicantId);
    return rows.map(toDto);
  },

  async pendingQueue() {
    const rows = await leaveRepository.listPending();
    return rows.map(toDto);
  },

  async allRequests() {
    const rows = await leaveRepository.listAll();
    return rows.map(toDto);
  },

  async decide(id: string, decidedById: string, status: "APPROVED" | "REJECTED", decisionNote?: string) {
    const existing = await leaveRepository.findById(id);
    if (!existing) throw ApiError.notFound("Leave request not found");
    if (existing.status !== "PENDING") throw ApiError.conflict("This request has already been decided");

    const updated = await leaveRepository.decide(id, status, decidedById, decisionNote);

    await notificationsService.notifyUser(
      existing.applicantId,
      `Leave request ${status.toLowerCase()}`,
      decisionNote || `Your ${existing.leaveType.toLowerCase()} leave request has been ${status.toLowerCase()}.`,
      "LEAVE"
    );

    return toDto(updated);
  },
};
