import { prisma } from "../config/db";

export function writeAudit(params: {
  userId?: string;
  action: string;
  module: string;
  metadata?: object;
  ipAddress?: string;
}) {
  return prisma.auditLog
    .create({
      data: {
        userId: params.userId,
        action: params.action,
        module: params.module,
        metadata: params.metadata as any,
        ipAddress: params.ipAddress,
      },
    })
    .catch(() => undefined); // never let audit logging break the real operation
}
