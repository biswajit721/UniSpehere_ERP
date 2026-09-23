import { z } from "zod";

export const createBookSchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1),
  isbn: z.string().min(5),
  publisher: z.string().optional(),
  category: z.string().optional(),
  totalCopies: z.coerce.number().int().min(1),
});

export const updateBookSchema = z.object({
  title: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  publisher: z.string().optional(),
  category: z.string().optional(),
  totalCopies: z.coerce.number().int().min(1).optional(),
});

export const issueBookSchema = z.object({
  bookId: z.string().uuid(),
  studentId: z.string().uuid(),
  dueDate: z.string().datetime(),
});

export const listBooksQuerySchema = z.object({
  search: z.string().optional(),
});
