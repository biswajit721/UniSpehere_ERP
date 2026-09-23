import { useEffect, useState } from "react";
import { EntityFormModal, FieldConfig } from "../features/departments/EntityFormModal";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { extractErrorMessage } from "../utils/errorMessage";

interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  publisher: string | null;
  category: string | null;
  totalCopies: number;
  availableCopies: number;
}

export function LibraryPage() {
  const role = useAuthStore((s) => s.user?.role);
  return role === "LIBRARIAN" || role === "SUPER_ADMIN" ? <LibrarianView /> : <BrowseView />;
}

function BookCatalog({ books, action }: { books: Book[]; action?: (b: Book) => React.ReactNode }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="bg-surface dark:bg-surface-dark text-left text-text-secondary">
          <tr>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Author</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Available</th>
            {action && <th className="px-4 py-3 font-medium text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border dark:divide-border-dark">
          {books.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-text-secondary">No books found.</td></tr>
          )}
          {books.map((b) => (
            <tr key={b.id}>
              <td className="px-4 py-3 text-text-primary dark:text-text-dark-primary whitespace-nowrap">{b.title}</td>
              <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{b.author}</td>
              <td className="px-4 py-3 text-text-secondary">{b.category ?? "—"}</td>
              <td className="px-4 py-3">
                <span className={`text-xs font-medium ${b.availableCopies > 0 ? "text-success" : "text-danger"}`}>
                  {b.availableCopies}/{b.totalCopies}
                </span>
              </td>
              {action && <td className="px-4 py-3 text-right">{action(b)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LibrarianView() {
  const [books, setBooks] = useState<Book[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [issueBook, setIssueBook] = useState<Book | null>(null);
  const [activeIssues, setActiveIssues] = useState<any[]>([]);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/library/books", { params: { search: search || undefined } });
      setBooks(data.books);
    } finally {
      setLoading(false);
    }
  };
  const loadIssues = async () => {
    const { data } = await api.get("/library/issues/active");
    setActiveIssues(data.issues);
  };

  useEffect(() => {
    const t = setTimeout(loadBooks, 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    loadIssues();
  }, []);

  const bookFields: FieldConfig[] = [
    { key: "title", label: "Title" },
    { key: "author", label: "Author" },
    { key: "isbn", label: "ISBN" },
    { key: "publisher", label: "Publisher" },
    { key: "category", label: "Category" },
    { key: "totalCopies", label: "Total copies", type: "number", placeholder: "1" },
  ];

  const returnBook = async (issueId: string) => {
    const { data } = await api.patch(`/library/issue/${issueId}/return`);
    alert(data.issue.fineAmount > 0 ? `Returned. Fine: ₹${data.issue.fineAmount}` : "Returned. No fine.");
    loadIssues();
    loadBooks();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Library</h1>
          <p className="text-sm text-text-secondary mt-1">Manage the catalog, issue and return books.</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary self-start sm:self-auto">Add book</button>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search books" className="input-field sm:w-72 mb-4" />

      {loading ? (
        <p className="text-text-secondary text-sm">Loading...</p>
      ) : (
        <BookCatalog
          books={books}
          action={(b) => (
            <button onClick={() => setIssueBook(b)} disabled={b.availableCopies < 1} className="text-primary text-xs font-medium disabled:opacity-40">
              Issue
            </button>
          )}
        />
      )}

      <h2 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mt-8 mb-3">Currently issued</h2>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-surface dark:bg-surface-dark text-left text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Book</th>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Due date</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-border-dark">
            {activeIssues.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-text-secondary">No active issues.</td></tr>
            )}
            {activeIssues.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3 text-text-primary dark:text-text-dark-primary whitespace-nowrap">{i.book.title}</td>
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{i.student.user.firstName} {i.student.user.lastName}</td>
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{new Date(i.dueDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => returnBook(i.id)} className="text-primary text-xs font-medium">Mark returned</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <EntityFormModal
          title="Add book"
          fields={bookFields}
          onClose={() => setAddOpen(false)}
          onSubmit={async (v) => {
            await api.post("/library/books", v);
            loadBooks();
          }}
        />
      )}

      {issueBook && (
        <IssueBookModal book={issueBook} onClose={() => setIssueBook(null)} onIssued={() => { setIssueBook(null); loadIssues(); loadBooks(); }} />
      )}
    </div>
  );
}

function IssueBookModal({ book, onClose, onIssued }: { book: Book; onClose: () => void; onIssued: () => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; fullName: string; rollNumber: string }[]>([]);
  const [studentId, setStudentId] = useState("");
  const [studentLabel, setStudentLabel] = useState("");
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (search.length < 2) return setResults([]);
    const t = setTimeout(() => {
      api.get("/students", { params: { search, pageSize: 8 } }).then(({ data }) => setResults(data.data));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const submit = async () => {
    if (!studentId) return setError("Select a student first");
    setError(null);
    setSaving(true);
    try {
      await api.post("/library/issue", { bookId: book.id, studentId, dueDate: new Date(dueDate).toISOString() });
      onIssued();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Could not issue book"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0 -z-10" onClick={onClose} />
      <div className="w-full max-w-sm card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-1">Issue "{book.title}"</h3>
        {error && <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}

        <label className="block text-sm font-medium text-text-primary mb-1.5 mt-3">Student</label>
        {studentId ? (
          <div className="flex items-center justify-between input-field">
            <span>{studentLabel}</span>
            <button onClick={() => { setStudentId(""); setStudentLabel(""); }} className="text-xs text-danger">Change</button>
          </div>
        ) : (
          <>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student" className="input-field" />
            {results.length > 0 && (
              <div className="mt-1 border border-border dark:border-border-dark rounded-lg overflow-hidden">
                {results.map((r) => (
                  <button key={r.id} onClick={() => { setStudentId(r.id); setStudentLabel(`${r.fullName} (${r.rollNumber})`); setResults([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-surface dark:hover:bg-surface-dark">
                    {r.fullName} <span className="text-text-secondary text-xs">{r.rollNumber}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <label className="block text-sm font-medium text-text-primary mb-1.5 mt-3">Due date</label>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-field mb-4" />

        <button onClick={submit} disabled={saving} className="btn-primary w-full">{saving ? "Issuing..." : "Issue book"}</button>
      </div>
    </div>
  );
}

function BrowseView() {
  const role = useAuthStore((s) => s.user?.role);
  const [books, setBooks] = useState<Book[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [myIssues, setMyIssues] = useState<any[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get("/library/books", { params: { search: search || undefined } }).then(({ data }) => {
        setBooks(data.books);
        setLoading(false);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (role === "STUDENT") {
      api.get("/students/me").then(({ data }) =>
        api.get(`/library/issues/student/${data.student.id}`).then(({ data: i }) => setMyIssues(i.issues))
      );
    }
  }, [role]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Library</h1>
        <p className="text-sm text-text-secondary mt-1">Browse the catalog{role === "STUDENT" ? " and track your issued books" : ""}.</p>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search books" className="input-field sm:w-72 mb-4" />
      {loading ? <p className="text-text-secondary text-sm">Loading...</p> : <BookCatalog books={books} />}

      {role === "STUDENT" && myIssues.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mt-8 mb-3">My issued books</h2>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-surface dark:bg-surface-dark text-left text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">Book</th>
                  <th className="px-4 py-3 font-medium">Due date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Fine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-border-dark">
                {myIssues.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-3 text-text-primary dark:text-text-dark-primary whitespace-nowrap">{i.book.title}</td>
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{new Date(i.dueDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-text-secondary">{i.status}</td>
                    <td className="px-4 py-3 text-text-secondary">{Number(i.fineAmount) > 0 ? `₹${i.fineAmount}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
