import { prisma } from "../../config/db";

export const libraryRepository = {
  listBooks(search?: string) {
    return prisma.book.findMany({
      where: {
        deletedAt: null,
        ...(search && {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { author: { contains: search, mode: "insensitive" as const } },
            { isbn: { contains: search, mode: "insensitive" as const } },
          ],
        }),
      },
      orderBy: { title: "asc" },
    });
  },

  findBookByIsbn(isbn: string) {
    return prisma.book.findUnique({ where: { isbn } });
  },

  findBookById(id: string) {
    return prisma.book.findUnique({ where: { id } });
  },

  createBook(data: {
    title: string;
    author: string;
    isbn: string;
    publisher?: string;
    category?: string;
    totalCopies: number;
  }) {
    return prisma.book.create({ data: { ...data, availableCopies: data.totalCopies } });
  },

  updateBook(id: string, data: Partial<{ title: string; author: string; publisher: string; category: string; totalCopies: number }>) {
    return prisma.book.update({ where: { id }, data });
  },

  softDeleteBook(id: string) {
    return prisma.book.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  decrementAvailable(bookId: string) {
    return prisma.book.update({ where: { id: bookId }, data: { availableCopies: { decrement: 1 } } });
  },

  incrementAvailable(bookId: string) {
    return prisma.book.update({ where: { id: bookId }, data: { availableCopies: { increment: 1 } } });
  },

  createIssue(data: { bookId: string; studentId: string; dueDate: Date }) {
    return prisma.bookIssue.create({ data, include: { book: true, student: { include: { user: true } } } });
  },

  findIssueById(id: string) {
    return prisma.bookIssue.findUnique({ where: { id }, include: { book: true, student: { include: { user: true } } } });
  },

  returnIssue(id: string, fineAmount: number) {
    return prisma.bookIssue.update({
      where: { id },
      data: { returnedAt: new Date(), status: "RETURNED", fineAmount },
    });
  },

  listIssuesForStudent(studentId: string) {
    return prisma.bookIssue.findMany({
      where: { studentId },
      include: { book: true },
      orderBy: { issuedAt: "desc" },
    });
  },

  listAllActiveIssues() {
    return prisma.bookIssue.findMany({
      where: { status: "ISSUED" },
      include: { book: true, student: { include: { user: true } } },
      orderBy: { dueDate: "asc" },
    });
  },
};
