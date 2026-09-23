import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { libraryService } from "./library.service";
import { createBookSchema, issueBookSchema, listBooksQuerySchema, updateBookSchema } from "./library.validation";

export const libraryController = {
  listBooks: catchAsync(async (req: Request, res: Response) => {
    const { search } = listBooksQuerySchema.parse(req.query);
    const books = await libraryService.listBooks(search);
    res.status(200).json({ books });
  }),

  createBook: catchAsync(async (req: Request, res: Response) => {
    const input = createBookSchema.parse(req.body);
    const book = await libraryService.createBook(input);
    res.status(201).json({ message: "Book added", book });
  }),

  updateBook: catchAsync(async (req: Request, res: Response) => {
    const input = updateBookSchema.parse(req.body);
    const book = await libraryService.updateBook(req.params.id, input);
    res.status(200).json({ message: "Book updated", book });
  }),

  removeBook: catchAsync(async (req: Request, res: Response) => {
    await libraryService.removeBook(req.params.id);
    res.status(200).json({ message: "Book deleted" });
  }),

  issueBook: catchAsync(async (req: Request, res: Response) => {
    const input = issueBookSchema.parse(req.body);
    const issue = await libraryService.issueBook(input);
    res.status(201).json({ message: "Book issued", issue });
  }),

  returnBook: catchAsync(async (req: Request, res: Response) => {
    const result = await libraryService.returnBook(req.params.issueId);
    res.status(200).json({ message: "Book returned", issue: result });
  }),

  studentIssues: catchAsync(async (req: Request, res: Response) => {
    const issues = await libraryService.studentIssues(req.params.studentId);
    res.status(200).json({ issues });
  }),

  activeIssues: catchAsync(async (_req: Request, res: Response) => {
    const issues = await libraryService.activeIssues();
    res.status(200).json({ issues });
  }),
};
