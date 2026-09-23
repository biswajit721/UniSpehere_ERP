import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { extractErrorMessage } from "../utils/errorMessage";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const DAY_LABELS: Record<string, string> = { MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri", SAT: "Sat" };

interface Slot {
  id: string;
  subject: string;
  subjectId: string;
  facultyName: string;
  facultyId: string;
  section: string;
  sectionId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room?: string;
}

function Grid({ slots, showSection, onDelete }: { slots: Slot[]; showSection?: boolean; onDelete?: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {DAYS.map((day) => {
        const daySlots = slots.filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
        return (
          <div key={day} className="card p-3">
            <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary mb-2">{DAY_LABELS[day]}</h3>
            <div className="space-y-2">
              {daySlots.length === 0 && <p className="text-xs text-text-secondary">No classes</p>}
              {daySlots.map((s) => (
                <div key={s.id} className="rounded-lg border border-border dark:border-border-dark p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-text-primary dark:text-text-dark-primary">{s.startTime}–{s.endTime}</span>
                    {onDelete && (
                      <button onClick={() => onDelete(s.id)} className="text-danger">
                        ✕
                      </button>
                    )}
                  </div>
                  <p className="text-text-secondary mt-0.5">{s.subject}</p>
                  {showSection ? (
                    <p className="text-text-secondary">Sec {s.section} · {s.facultyName}</p>
                  ) : (
                    <p className="text-text-secondary">{s.facultyName}</p>
                  )}
                  {s.room && <p className="text-text-secondary">Room {s.room}</p>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TimetablePage() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === "HOD" || role === "UNIV_ADMIN" || role === "SUPER_ADMIN") return <AdminTimetableView />;
  if (role === "FACULTY") return <FacultyTimetableView />;
  return <StudentTimetableView />;
}

function AdminTimetableView() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [sections, setSections] = useState<{ id: string; name: string; batchLabel: string }[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [subjects, setSubjects] = useState<{ id: string; name: string; facultyId: string | null; facultyName: string | null }[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [form, setForm] = useState({ subjectId: "", dayOfWeek: "MON", startTime: "09:00", endTime: "10:00", room: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/departments/full").then(({ data }) => setDepartments(data.departments));
  }, []);

  useEffect(() => {
    const dept = departments.find((d) => d.id === departmentId);
    const flat: { id: string; name: string; batchLabel: string }[] = [];
    dept?.programs.forEach((p: any) => p.batches.forEach((b: any) => b.sections.forEach((sec: any) => flat.push({ id: sec.id, name: sec.name, batchLabel: b.label }))));
    setSections(flat);
    setSectionId("");
    if (departmentId) {
      api.get("/academics/subjects", { params: { departmentId } }).then(({ data }) =>
        setSubjects(data.subjects.map((s: any) => ({ id: s.id, name: s.name, facultyId: s.facultyId, facultyName: s.facultyName })))
      );
    }
  }, [departmentId, departments]);

  const loadSlots = async () => {
    if (!sectionId) return;
    const { data } = await api.get("/timetable", { params: { sectionId } });
    setSlots(data.slots);
  };
  useEffect(() => {
    loadSlots();
  }, [sectionId]);

  const addSlot = async () => {
    const subject = subjects.find((s) => s.id === form.subjectId);
    if (!subject || !subject.facultyId) {
      setError("Assign a faculty member to this subject first (Academics page)");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api.post("/timetable", { ...form, sectionId, facultyId: subject.facultyId });
      loadSlots();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Could not schedule this class"));
    } finally {
      setSaving(false);
    }
  };

  const removeSlot = async (id: string) => {
    if (!confirm("Remove this class from the timetable?")) return;
    await api.delete(`/timetable/${id}`);
    loadSlots();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Timetable</h1>
        <p className="text-sm text-text-secondary mt-1">Build the weekly schedule — conflicts are blocked automatically.</p>
      </div>

      <div className="card p-4 mb-4 flex flex-col sm:flex-row flex-wrap gap-3">
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="input-field sm:w-56">
          <option value="">Select department</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="input-field sm:w-56" disabled={!departmentId}>
          <option value="">Select section</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.batchLabel} · Sec {s.name}</option>)}
        </select>
      </div>

      {sectionId && (
        <>
          <div className="card p-4 mb-4 flex flex-col sm:flex-row flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Subject</label>
              <select value={form.subjectId} onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))} className="input-field sm:w-48">
                <option value="">Select subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Day</label>
              <select value={form.dayOfWeek} onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: e.target.value }))} className="input-field sm:w-32">
                {DAYS.map((d) => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Start</label>
              <input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} className="input-field sm:w-28" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">End</label>
              <input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} className="input-field sm:w-28" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Room (optional)</label>
              <input value={form.room} onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))} className="input-field sm:w-28" />
            </div>
            <button onClick={addSlot} disabled={saving || !form.subjectId} className="btn-primary">
              {saving ? "Adding..." : "Add class"}
            </button>
          </div>

          {error && <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}

          <Grid slots={slots} onDelete={removeSlot} />
        </>
      )}
    </div>
  );
}

function FacultyTimetableView() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/faculty/me").then(({ data }) =>
      api.get("/timetable", { params: { facultyId: data.faculty.id } }).then(({ data: t }) => {
        setSlots(t.slots);
        setLoading(false);
      })
    );
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">My Timetable</h1>
        <p className="text-sm text-text-secondary mt-1">Your weekly teaching schedule.</p>
      </div>
      {loading ? <p className="text-text-secondary text-sm">Loading...</p> : <Grid slots={slots} showSection />}
    </div>
  );
}

function StudentTimetableView() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [noSection, setNoSection] = useState(false);

  useEffect(() => {
    api.get("/students/me").then(({ data }) => {
      if (!data.student.sectionId) {
        setNoSection(true);
        setLoading(false);
        return;
      }
      api.get("/timetable", { params: { sectionId: data.student.sectionId } }).then(({ data: t }) => {
        setSlots(t.slots);
        setLoading(false);
      });
    });
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">My Timetable</h1>
        <p className="text-sm text-text-secondary mt-1">Your weekly class schedule.</p>
      </div>
      {loading ? (
        <p className="text-text-secondary text-sm">Loading...</p>
      ) : noSection ? (
        <div className="card p-6 text-center text-sm text-text-secondary">
          You're not assigned to a section yet — ask your admin to assign one.
        </div>
      ) : slots.length > 0 ? (
        <Grid slots={slots} />
      ) : (
        <div className="card p-6 text-center text-sm text-text-secondary">
          No timetable published for your section yet.
        </div>
      )}
    </div>
  );
}
