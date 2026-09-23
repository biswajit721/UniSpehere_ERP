import multer from "multer";

const storage = multer.memoryStorage();

export const uploadSingle = (fieldName: string) =>
  multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  }).single(fieldName);
