import { useEffect, useState } from "react";
import { EntityFormModal, FieldConfig } from "../features/departments/EntityFormModal";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";

interface SubjectOpt {
  id: string;
  name: string;
  departmentId: string;
  semester: number;
}
interface ExamRow {
  id: string;
  title: string;
  subject: string;
  subjectId: string;
  examType: string;
  examDate: string;
  totalMarks: number;
  status: "DRAFT" | "PUBLISHED";
  marksEntered: number;
}

export function ExaminationPage() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === "STUDENT") return <StudentResultsView />;
  if (role === "FACULTY") return <FacultyMarksView />;
  return <ControllerExamView />;
}

function useSubjects(facultyId?: string) {
  const [subjects, setSubjects] = useState<SubjectOpt[]>([]);
  useEffect(() => {
    api
      .get("/academics/subjects", { params: facultyId ? { facultyId } : undefined })
      .then(({ data }) => setSubjects(data.subjects));
  }, [facultyId]);
  return subjects;
}

function ExamsTable({ exams, onPublish }: { exams: ExamRow[]; onPublish?: (id: string) => void }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="bg-surface dark:bg-surface-dark text-left text-text-secondary">
          <tr>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Subject</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Total marks</th>
            <th className="px-4 py-3 font-medium">Marks entered</th>
            <th className="px-4 py-3 font-medium">Status</th>
            {onPublish && <th className="px-4 py-3 font-medium text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border dark:divide-border-dark">
          {exams.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-text-secondary">No exams yet.</td>
            </tr>
          )}
          {exams.map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-3 text-text-primary dark:text-text-dark-primary whitespace-nowrap">{e.title}</td>
              <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{e.subject}</td>
              <td className="px-4 py-3 text-text-secondary">{e.examType}</td>
              <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{new Date(e.examDate).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-text-secondary">{e.totalMarks}</td>
              <td className="px-4 py-3 text-text-secondary">{e.marksEntered}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${e.status === "PUBLISHED" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
                  {e.status === "PUBLISHED" ? "Published" : "Draft"}
                </span>
              </td>
              {onPublish && (
                <td className="px-4 py-3 text-right">
                  {e.status === "DRAFT" && (
                    <button onClick={() => onPublish(e.id)} className="text-primary text-xs font-medium">
                      Publish
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ControllerExamView() {
  const subjects = useSubjects();
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/examination");
      setExams(data.exams);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const publish = async (id: string) => {
    if (!confirm("Publish results for this exam? Students will be able to see their marks.")) return;
    await api.patch(`/examination/${id}/publish`);
    load();
  };

  const fields: FieldConfig[] = [
    { key: "title", label: "Exam title", placeholder: "Mid-Semester Exam" },
    {
      key: "subjectId",
      label: "Subject",
      type: "select",
      options: subjects.map((s) => ({ value: s.id, label: `${s.name} (Sem ${s.semester})` })),
    },
    {
      key: "examType",
      label: "Exam type",
      type: "select",
      options: [
        { value: "INTERNAL", label: "Internal" },
        { value: "EXTERNAL", label: "External" },
        { value: "PRACTICAL", label: "Practical" },
      ],
    },
    { key: "examDate", label: "Exam date", type: "date" },
    { key: "totalMarks", label: "Total marks", type: "number", placeholder: "100" },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Examination</h1>
          <p className="text-sm text-text-secondary mt-1">Create exams and publish results once marks are finalized.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary self-start sm:self-auto">
          Create exam
        </button>
      </div>

      {loading ? <p className="text-text-secondary text-sm">Loading...</p> : <ExamsTable exams={exams} onPublish={publish} />}

      {modalOpen && (
        <EntityFormModal
          title="Create exam"
          fields={fields}
          onClose={() => setModalOpen(false)}
          onSubmit={async (v) => {
            await api.post("/examination", { ...v, examDate: new Date(v.examDate as string).toISOString() });
            load();
          }}
        />
      )}
    </div>
  );
}

function FacultyMarksView() {
  const [facultyId, setFacultyId] = useState<string>();
  const subjects = useSubjects(facultyId);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [marksModal, setMarksModal] = useState<{ exam: ExamRow; subject: SubjectOpt } | null>(null);

  useEffect(() => {
    api.get("/faculty/me").then(({ data }) => setFacultyId(data.faculty.id));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/examination");
      setExams(data.exams.filter((e: ExamRow) => subjects.some((s) => s.id === e.subjectId)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subjects.length > 0) load();
    else setLoading(false);
  }, [subjects]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Examination</h1>
        <p className="text-sm text-text-secondary mt-1">Enter marks for exams on your assigned subjects.</p>
      </div>

      {loading ? (
        <p className="text-text-secondary text-sm">Loading...</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-surface dark:bg-surface-dark text-left text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Total marks</th>
                <th className="px-4 py-3 font-medium">Marks entered</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-border-dark">
              {exams.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-text-secondary">No exams assigned to your subjects yet.</td></tr>
              )}
              {exams.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 text-text-primary dark:text-text-dark-primary whitespace-nowrap">{e.title}</td>
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{e.subject}</td>
                  <td className="px-4 py-3 text-text-secondary">{e.totalMarks}</td>
                  <td className="px-4 py-3 text-text-secondary">{e.marksEntered}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${e.status === "PUBLISHED" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
                      {e.status === "PUBLISHED" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        const subject = subjects.find((s) => s.id === e.subjectId)!;
                        setMarksModal({ exam: e, subject });
                      }}
                      className="text-primary text-xs font-medium"
                    >
                      Enter marks
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {marksModal && (
        <MarksEntryModal
          exam={marksModal.exam}
          subject={marksModal.subject}
          onClose={() => setMarksModal(null)}
          onSaved={() => {
            setMarksModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function MarksEntryModal({
  exam,
  subject,
  onClose,
  onSaved,
}: {
  exam: ExamRow;
  subject: SubjectOpt;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<{ studentId: string; rollNumber: string; fullName: string; marksObtained: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: studentsData }, { data: examData }] = await Promise.all([
        api.get("/students", { params: { departmentId: subject.departmentId, semester: subject.semester, pageSize: 100 } }),
        api.get(`/examination/${exam.id}`),
      ]);
      const existingByStudent = new Map(examData.exam.marks.map((m: any) => [m.studentId, m.marksObtained]));
      setRows(
        studentsData.data.map((s: any) => ({
          studentId: s.id,
          rollNumber: s.rollNumber,
          fullName: s.fullName,
          marksObtained: (existingByStudent.get(s.id) as number) ?? 0,
        }))
      );
      setLoading(false);
    })();
  }, [exam.id, subject]);

  const updateMark = (studentId: string, value: number) => {
    setRows((prev) => prev.map((r) => (r.studentId === studentId ? { ...r, marksObtained: value } : r)));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/examination/${exam.id}/marks`, {
        records: rows.map((r) => ({ studentId: r.studentId, marksObtained: r.marksObtained })),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0 -z-10" onClick={onClose} />
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-1">
          {exam.title} — {exam.subject}
        </h3>
        <p className="text-sm text-text-secondary mb-4">Out of {exam.totalMarks} marks</p>

        {loading ? (
          <p className="text-text-secondary text-sm">Loading roster...</p>
        ) : (
          <div className="space-y-2 mb-4">
            {rows.map((r) => (
              <div key={r.studentId} className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="text-text-primary dark:text-text-dark-primary">{r.fullName}</span>
                  <span className="text-text-secondary ml-2 font-mono text-xs">{r.rollNumber}</span>
                </div>
                <input
                  type="number"
                  min={0}
                  max={exam.totalMarks}
                  value={r.marksObtained}
                  onChange={(e) => updateMark(r.studentId, Number(e.target.value))}
                  className="input-field w-24"
                />
              </div>
            ))}
          </div>
        )}

        <button onClick={save} disabled={saving || loading} className="btn-primary w-full">
          {saving ? "Saving..." : "Save marks"}
        </button>
      </div>
    </div>
  );
}

function StudentResultsView() {
  const [results, setResults] = useState<
    { subject: string; examTitle: string; examType: string; marksObtained: number; totalMarks: number; percentage: number; grade: string; points: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/students/me").then(({ data }) =>
      api.get(`/examination/results/${data.student.id}`).then(({ data: r }) => {
        setResults(r.results);
        setLoading(false);
      })
    );
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">My Results</h1>
        <p className="text-sm text-text-secondary mt-1">Published exam results only.</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface dark:bg-surface-dark text-left text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">Exam</th>
              <th className="px-4 py-3 font-medium">Marks</th>
              <th className="px-4 py-3 font-medium">Percentage</th>
              <th className="px-4 py-3 font-medium">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-border-dark">
            {loading && <tr><td colSpan={5} className="px-4 py-6 text-center text-text-secondary">Loading...</td></tr>}
            {!loading && results.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-text-secondary">No published results yet.</td></tr>
            )}
            {results.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-3 text-text-primary dark:text-text-dark-primary whitespace-nowrap">{r.subject}</td>
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{r.examTitle}</td>
                <td className="px-4 py-3 text-text-secondary">{r.marksObtained}/{r.totalMarks}</td>
                <td className="px-4 py-3 text-text-secondary">{r.percentage}%</td>
                <td className="px-4 py-3 font-medium text-text-primary dark:text-text-dark-primary">{r.grade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
