import { ApiError } from "./ApiError";
import { cloudinary } from "../config/cloudinary";
import { env } from "../config/env";

export interface UploadResult {
  url: string;
  publicId: string;
}

export function uploadBuffer(buffer: Buffer, folder: string): Promise<UploadResult> {
  if (!env.cloudinary.isConfigured) {
    throw ApiError.internal(
      "File uploads are not configured on this server. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env."
    );
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `unisphere-erp/${folder}`, resource_type: "auto" },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Upload failed"));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

export function deleteByPublicId(publicId: string): Promise<void> {
  if (!env.cloudinary.isConfigured) return Promise.resolve();
  return cloudinary.uploader.destroy(publicId).then(() => undefined);
}
