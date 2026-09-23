import { ApiError } from "../../utils/ApiError";
import { deleteByPublicId, uploadBuffer } from "../../utils/uploadFile";
import { documentsRepository } from "./documents.repository";

export const documentsService = {
  async upload(ownerId: string, title: string, category: string, buffer: Buffer) {
    const result = await uploadBuffer(buffer, "documents");
    return documentsRepository.create({ ownerId, title, category: category as any, fileUrl: result.url, publicId: result.publicId });
  },

  myDocuments(ownerId: string) {
    return documentsRepository.listForOwner(ownerId);
  },

  async allDocuments(status?: string) {
    const rows = await documentsRepository.listAll(status);
    return rows.map((d: any) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      fileUrl: d.fileUrl,
      status: d.status,
      reviewNote: d.reviewNote,
      uploadedAt: d.uploadedAt,
      ownerName: `${d.owner.firstName} ${d.owner.lastName}`,
      ownerUniversityId: d.owner.universityId,
    }));
  },

  async review(id: string, status: "VERIFIED" | "REJECTED", reviewNote?: string) {
    const doc = await documentsRepository.findById(id);
    if (!doc) throw ApiError.notFound("Document not found");
    return documentsRepository.updateStatus(id, status, reviewNote);
  },

  async remove(id: string, requesterId: string, isAdmin: boolean) {
    const doc = await documentsRepository.findById(id);
    if (!doc) throw ApiError.notFound("Document not found");
    if (!isAdmin && doc.ownerId !== requesterId) throw ApiError.forbidden("Not your document");
    await deleteByPublicId(doc.publicId).catch(() => undefined);
    await documentsRepository.remove(id);
  },
};
