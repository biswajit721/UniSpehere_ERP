import { Copy, Loader2 } from "lucide-react";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { Alert } from "../../components/ui/Feedback";
import { Modal } from "../../components/ui/Modal";
import { SelectField } from "../../components/ui/SelectField";
import { api } from "../../services/api";
import { todayLocal } from "../../utils/dates";
import { extractErrorMessage } from "../../utils/errorMessage";
import { useRemote } from "../../utils/useRemote";
import { academicsApi } from "../academics/academics.api";
import { CREATABLE_ROLES, CreatableRole, CreatedUserResult, Department } from "./users.types";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const NEEDS_DEPARTMENT: CreatableRole[] = ["FACULTY", "HOD", "STUDENT"];
const NEEDS_FACULTY_FIELDS: CreatableRole[] = ["FACULTY", "HOD"];

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-semibold text-text-primary">{title}</legend>
      {hint && <p className="-mt-1 text-xs text-text-secondary">{hint}</p>}
      {children}
    </fieldset>
  );
}

function Field({ label, value, onChange, type = "text", required, placeholder, hint, max }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string; hint?: string; max?: string }) {
  return (
    <div className="min-w-0">
      <label className="field-label">{label}{required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}</label>
      <input type={type} value={value} placeholder={placeholder} max={max} onChange={(e) => onChange(e.target.value)} className="input-field" required={required} />
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-text-secondary">{label}</p>
        <p className="truncate font-mono text-sm text-text-primary">{value}</p>
      </div>
      <button type="button" onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="ml-3 inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-surface hover:text-primary" aria-label={`Copy ${label}`}>
        {copied ? <span className="text-xs text-success">Copied</span> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function CreateUserModal({ onClose, onCreated }: Props) {
  const [role, setRole] = useState<CreatableRole>("STUDENT");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [useCustomPassword, setUseCustomPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designation, setDesignation] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  // student: academic placement (every value is chosen - nothing is defaulted)
  const [academicSessionId, setAcademicSessionId] = useState("");
  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [enrollmentType, setEnrollmentType] = useState<"" | "REGULAR" | "LATERAL">("");
  const [semesterId, setSemesterId] = useState("");
  const [sectionId, setSectionId] = useState("");
  // student: admission + profile
  const [admissionDate, setAdmissionDate] = useState(todayLocal());
  const [admissionYear, setAdmissionYear] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelation, setGuardianRelation] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreatedUserResult | null>(null);

  const isStudent = role === "STUDENT";
  const tree = useRemote<Department[]>(NEEDS_DEPARTMENT.includes(role) ? "tree" : null, () => api.get("/departments/full").then(({ data }) => data.departments));
  const sessions = useRemote(isStudent ? "sessions" : null, () => academicsApi.sessions(true));

  const selectedDepartment = useMemo(() => tree.data?.find((d) => d.id === departmentId), [tree.data, departmentId]);
  const selectedProgram = useMemo(() => selectedDepartment?.programs.find((p) => p.id === programId), [selectedDepartment, programId]);
  const selectedBatch = useMemo(() => selectedProgram?.batches.find((b) => b.id === batchId), [selectedProgram, batchId]);
  const selectedSession = sessions.data?.find((s) => s.id === academicSessionId);

  // A regular admission starts in Semester 1; a lateral entry joins a later semester. The server enforces the same rule.
  const semesterOptions = (selectedProgram?.semesters ?? []).filter((s) => (enrollmentType === "REGULAR" ? s.number === 1 : enrollmentType === "LATERAL" ? s.number > 1 : true));

  useEffect(() => {
    // reset the placement when the type changes and the chosen semester is no longer allowed
    if (semesterId && !semesterOptions.some((s) => s.id === semesterId)) setSemesterId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollmentType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data } = await api.post("/users", {
        role, firstName, lastName, email,
        phone: phone || undefined,
        password: useCustomPassword && password ? password : undefined,
        departmentId: NEEDS_DEPARTMENT.includes(role) ? departmentId : undefined,
        designation: NEEDS_FACULTY_FIELDS.includes(role) ? designation : undefined,
        employeeId: NEEDS_FACULTY_FIELDS.includes(role) ? employeeId || undefined : undefined,
        ...(isStudent && {
          academicSessionId, programId, batchId, semesterId, enrollmentType,
          sectionId: sectionId || undefined,
          rollNumber,
          registrationNumber: registrationNumber || undefined,
          admissionDate: admissionDate || undefined,
          admissionYear: admissionYear ? Number(admissionYear) : undefined,
          gender: gender || undefined,
          dateOfBirth: dateOfBirth || undefined,
          guardianName: guardianName || undefined,
          guardianRelation: guardianRelation || undefined,
          guardianPhone: guardianPhone || undefined,
        }),
      });
      setResult(data.user);
      onCreated();
    } catch (err) {
      setError(extractErrorMessage(err, "Could not create user. Check the fields and try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <Modal open onClose={onClose} title="Account created" description="Share these credentials securely - the temporary password won't be shown again." size="sm" footer={<button onClick={onClose} className="btn-primary w-full sm:w-auto">Done</button>}>
        <div className="space-y-3">
          <CredentialRow label="University ID" value={result.universityId} />
          <CredentialRow label="Email" value={result.email} />
          {result.tempPassword ? <CredentialRow label="Temporary password" value={result.tempPassword} /> : (
            <div className="rounded-lg border border-border px-3 py-2.5"><p className="text-xs text-text-secondary">Password</p><p className="text-sm text-text-primary">The password you set</p></div>
          )}
        </div>
        <p className="mt-4 text-xs text-text-secondary">The user will be required to set a new password on first login.</p>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!submitting}
      size="lg"
      title={isStudent ? "Register student" : "Create user account"}
      description={isStudent ? "Creates the student's master profile and their first academic enrollment together." : undefined}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>Cancel</button>
          <button type="submit" form="create-user-form" disabled={submitting} className="btn-primary">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Creating…" : isStudent ? "Register student" : "Create account"}
          </button>
        </>
      }
    >
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <form id="create-user-form" onSubmit={handleSubmit} className="space-y-6">
        <Section title="Account">
          <div>
            <label className="field-label">Role</label>
            <select value={role} onChange={(e) => { setRole(e.target.value as CreatableRole); setDepartmentId(""); setProgramId(""); setBatchId(""); setSemesterId(""); setSectionId(""); }} className="input-field">
              {CREATABLE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" value={firstName} onChange={setFirstName} required />
            <Field label="Last name" value={lastName} onChange={setLastName} required />
            <Field label="Email" type="email" value={email} onChange={setEmail} required />
            <Field label="Phone (optional)" value={phone} onChange={setPhone} />
          </div>
          <div className="rounded-lg border border-border p-3">
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input type="checkbox" checked={useCustomPassword} onChange={(e) => setUseCustomPassword(e.target.checked)} className="h-4 w-4 rounded" />
              Set password myself
            </label>
            {useCustomPassword ? (
              <>
                <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter a password" className="input-field mt-2" required />
                <p className="mt-1 text-xs text-text-secondary">At least 8 characters, one uppercase letter, one number.</p>
              </>
            ) : <p className="mt-1 text-xs text-text-secondary">A secure temporary password is generated and shown once.</p>}
          </div>
        </Section>

        {NEEDS_FACULTY_FIELDS.includes(role) && (
          <Section title="Position">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="Department" required value={departmentId} onChange={setDepartmentId} loading={tree.loading} error={tree.error} onRetry={tree.reload} emptyText="No departments yet" options={(tree.data ?? []).map((d) => ({ value: d.id, label: d.name }))} />
              <Field label="Designation" value={designation} onChange={setDesignation} required placeholder="Assistant Professor" />
              <Field label="Employee ID (optional)" value={employeeId} onChange={setEmployeeId} hint="Generated automatically if left blank" />
            </div>
          </Section>
        )}

        {isStudent && (
          <>
            <Section title="Academic placement" hint="Every choice comes from the Academics module. The server re-checks that each one belongs to the one before it.">
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField label="Academic session" required value={academicSessionId} onChange={setAcademicSessionId} placeholder="Select academic session" loading={sessions.loading} error={sessions.error} onRetry={sessions.reload} emptyText="No active sessions - create one under Academics" options={(sessions.data ?? []).map((s) => ({ value: s.id, label: s.isCurrent ? `${s.label} (Current)` : s.label }))} />
                <SelectField label="Department" required value={departmentId} onChange={(v) => { setDepartmentId(v); setProgramId(""); setBatchId(""); setSemesterId(""); setSectionId(""); }} loading={tree.loading} error={tree.error} onRetry={tree.reload} emptyText="No departments yet" options={(tree.data ?? []).map((d) => ({ value: d.id, label: d.name }))} />
                <SelectField label="Program" required value={programId} onChange={(v) => { setProgramId(v); setBatchId(""); setSemesterId(""); setSectionId(""); }} waitingFor={!departmentId ? "department" : null} emptyText="No programs in this department" options={(selectedDepartment?.programs ?? []).map((p) => ({ value: p.id, label: p.name }))} />
                <SelectField label="Batch" required value={batchId} onChange={(v) => { setBatchId(v); setSectionId(""); }} waitingFor={!programId ? "program" : null} emptyText="No batches in this program" options={(selectedProgram?.batches ?? []).map((b) => ({ value: b.id, label: b.label }))} />
                <SelectField label="Admission type" required value={enrollmentType} onChange={(v) => setEnrollmentType(v as "REGULAR" | "LATERAL")} placeholder="Select admission type" options={[{ value: "REGULAR", label: "Regular admission (Semester 1)" }, { value: "LATERAL", label: "Lateral entry (later semester)" }]} />
                <SelectField label="Semester" required value={semesterId} onChange={setSemesterId} waitingFor={!programId ? "program" : !enrollmentType ? "admission type" : null} emptyText="No matching semester" options={semesterOptions.map((s) => ({ value: s.id, label: s.name }))} hint={enrollmentType === "REGULAR" ? "Regular admissions start in Semester 1" : enrollmentType === "LATERAL" ? "Lateral entry joins after Semester 1" : undefined} />
                <SelectField label="Section (optional)" value={sectionId} onChange={setSectionId} placeholder="Unassigned" waitingFor={!batchId ? "batch" : null} emptyText="No sections in this batch" options={(selectedBatch?.sections ?? []).map((s) => ({ value: s.id, label: s.name }))} hint="A student only appears on attendance lists once a section is set" />
              </div>
            </Section>

            <Section title="Admission">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Admission date" type="date" value={admissionDate} onChange={setAdmissionDate} required hint="The student appears on class lists from this date" />
                <Field label="Admission year" type="number" value={admissionYear} onChange={setAdmissionYear} placeholder={selectedSession ? String(selectedSession.startYear) : "Defaults to the session's start year"} hint="Leave blank to use the academic session's start year" />
              </div>
            </Section>

            <Section title="Student profile">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Roll number" value={rollNumber} onChange={setRollNumber} required />
                <Field label="University registration no. (optional)" value={registrationNumber} onChange={setRegistrationNumber} placeholder="e.g. UNI202600123" />
                <SelectField label="Gender (optional)" value={gender} onChange={setGender} placeholder="Select" options={[{ value: "Female", label: "Female" }, { value: "Male", label: "Male" }, { value: "Other", label: "Other" }]} />
                <Field label="Date of birth (optional)" type="date" value={dateOfBirth} onChange={setDateOfBirth} max={todayLocal()} />
                <Field label="Guardian name (optional)" value={guardianName} onChange={setGuardianName} />
                <Field label="Guardian relation (optional)" value={guardianRelation} onChange={setGuardianRelation} placeholder="Father, Mother…" />
                <Field label="Guardian phone (optional)" value={guardianPhone} onChange={setGuardianPhone} />
              </div>
            </Section>
          </>
        )}
      </form>
    </Modal>
  );
}
