import { ApiError } from "../../utils/ApiError";
import { libraryRepository } from "./library.repository";

const FINE_PER_DAY = 5; // ₹5/day overdue

export const libraryService = {
  listBooks(search?: string) {
    return libraryRepository.listBooks(search);
  },

  async createBook(input: { title: string; author: string; isbn: string; publisher?: string; category?: string; totalCopies: number }) {
    const existing = await libraryRepository.findBookByIsbn(input.isbn);
    if (existing) throw ApiError.conflict("A book with this ISBN already exists");
    return libraryRepository.createBook(input);
  },

  updateBook(id: string, data: any) {
    return libraryRepository.updateBook(id, data);
  },

  async removeBook(id: string) {
    const book = await libraryRepository.findBookById(id);
    if (!book) throw ApiError.notFound("Book not found");
    if (book.availableCopies < book.totalCopies) {
      throw ApiError.conflict("Cannot delete a book while copies are currently issued");
    }
    await libraryRepository.softDeleteBook(id);
  },

  async issueBook(input: { bookId: string; studentId: string; dueDate: string }) {
    const book = await libraryRepository.findBookById(input.bookId);
    if (!book) throw ApiError.notFound("Book not found");
    if (book.availableCopies < 1) throw ApiError.conflict("No copies available to issue");

    const issue = await libraryRepository.createIssue({
      bookId: input.bookId,
      studentId: input.studentId,
      dueDate: new Date(input.dueDate),
    });
    await libraryRepository.decrementAvailable(input.bookId);
    return issue;
  },

  async returnBook(issueId: string) {
    const issue = await libraryRepository.findIssueById(issueId);
    if (!issue) throw ApiError.notFound("Issue record not found");
    if (issue.status === "RETURNED") throw ApiError.conflict("This book has already been returned");

    const overdueDays = Math.max(0, Math.ceil((Date.now() - issue.dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    const fine = overdueDays * FINE_PER_DAY;

    const updated = await libraryRepository.returnIssue(issueId, fine);
    await libraryRepository.incrementAvailable(issue.bookId);
    return { ...updated, fineAmount: fine };
  },

  studentIssues(studentId: string) {
    return libraryRepository.listIssuesForStudent(studentId);
  },

  activeIssues() {
    return libraryRepository.listAllActiveIssues();
  },
};
