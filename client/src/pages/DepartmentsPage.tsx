import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { EntityFormModal, FieldConfig } from "../features/departments/EntityFormModal";
import { Batch, Department, Program, Section } from "../features/departments/departments.types";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { extractErrorMessage } from "../utils/errorMessage";

type ModalState =
  | { type: "department"; mode: "create" }
  | { type: "department"; mode: "edit"; entity: Department }
  | { type: "program"; mode: "create"; departmentId: string }
  | { type: "program"; mode: "edit"; entity: Program }
  | { type: "batch"; mode: "create"; programId: string }
  | { type: "batch"; mode: "edit"; entity: Batch }
  | { type: "section"; mode: "create"; batchId: string }
  | { type: "section"; mode: "edit"; entity: Section }
  | null;

const DEPARTMENT_FIELDS: FieldConfig[] = [
  { key: "name", label: "Department name", placeholder: "Department of Computer Applications" },
  { key: "code", label: "Code", placeholder: "MCA" },
];
const PROGRAM_FIELDS: FieldConfig[] = [
  { key: "name", label: "Program name", placeholder: "MCA" },
  { key: "durationYears", label: "Duration (years)", type: "number", placeholder: "3" },
];
const BATCH_FIELDS: FieldConfig[] = [
  { key: "label", label: "Label", placeholder: "2025-2028" },
  { key: "startYear", label: "Start year", type: "number", placeholder: "2025" },
  { key: "endYear", label: "End year", type: "number", placeholder: "2028" },
];
const SECTION_FIELDS: FieldConfig[] = [{ key: "name", label: "Section name", placeholder: "A" }];

export function DepartmentsPage() {
  const canEdit = useAuthStore((s) => s.user?.role === "SUPER_ADMIN" || s.user?.role === "UNIV_ADMIN");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/departments/full");
      setDepartments(data.departments);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (set: Set<string>, setSet: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setSet(next);
  };

  const handleDelete = async (kind: "department" | "program" | "batch" | "section", id: string) => {
    if (!confirm(`Delete this ${kind}? This cannot be undone.`)) return;
    try {
      const path =
        kind === "department"
          ? `/departments/${id}`
          : kind === "program"
          ? `/departments/programs/${id}`
          : kind === "batch"
          ? `/departments/batches/${id}`
          : `/departments/sections/${id}`;
      await api.delete(path);
      load();
    } catch (err: any) {
      alert(extractErrorMessage(err, "Could not delete — it may still have records under it."));
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">
            Departments
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage the department → program → batch → section hierarchy.
          </p>
        </div>
        <button
          onClick={() => setModal({ type: "department", mode: "create" })}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
          style={{ display: canEdit ? undefined : "none" }}
        >
          <Plus className="h-4 w-4" />
          Add department
        </button>
      </div>

      {loading && <p className="text-text-secondary text-sm">Loading...</p>}
      {!loading && departments.length === 0 && (
        <div className="card p-6 text-center text-text-secondary text-sm">
          No departments yet — add the first one above.
        </div>
      )}

      <div className="space-y-3">
        {departments.map((dept) => {
          const isOpen = expandedDepts.has(dept.id);
          return (
            <div key={dept.id} className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => toggle(expandedDepts, setExpandedDepts, dept.id)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-text-secondary" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-text-secondary" />
                  )}
                  <span className="font-medium text-text-primary dark:text-text-dark-primary">
                    {dept.name}
                  </span>
                  <span className="text-xs text-text-secondary">({dept.code})</span>
                  <span className="text-xs text-text-secondary">
                    · {dept.programs.length} program{dept.programs.length !== 1 && "s"}
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  {canEdit && (
                    <>
                      <IconBtn onClick={() => setModal({ type: "program", mode: "create", departmentId: dept.id })} title="Add program">
                        <Plus className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn onClick={() => setModal({ type: "department", mode: "edit", entity: dept })} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn onClick={() => handleDelete("department", dept.id)} title="Delete" danger>
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    </>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-border dark:border-border-dark divide-y divide-border dark:divide-border-dark">
                  {dept.programs.map((prog) => {
                    const progOpen = expandedPrograms.has(prog.id);
                    return (
                      <div key={prog.id} className="pl-8 pr-4">
                        <div className="flex items-center justify-between py-2.5">
                          <button
                            onClick={() => toggle(expandedPrograms, setExpandedPrograms, prog.id)}
                            className="flex items-center gap-2 text-left flex-1"
                          >
                            {progOpen ? (
                              <ChevronDown className="h-3.5 w-3.5 text-text-secondary" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-text-secondary" />
                            )}
                            <span className="text-sm font-medium text-text-primary dark:text-text-dark-primary">
                              {prog.name}
                            </span>
                            <span className="text-xs text-text-secondary">
                              {prog.durationYears}y · {prog.batches.length} batch
                              {prog.batches.length !== 1 && "es"}
                            </span>
                          </button>
                          <div className="flex items-center gap-1">
                            {canEdit && (
                              <>
                                <IconBtn onClick={() => setModal({ type: "batch", mode: "create", programId: prog.id })} title="Add batch">
                                  <Plus className="h-3.5 w-3.5" />
                                </IconBtn>
                                <IconBtn onClick={() => setModal({ type: "program", mode: "edit", entity: prog })} title="Edit">
                                  <Pencil className="h-3.5 w-3.5" />
                                </IconBtn>
                                <IconBtn onClick={() => handleDelete("program", prog.id)} title="Delete" danger>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </IconBtn>
                              </>
                            )}
                          </div>
                        </div>

                        {progOpen && (
                          <div className="pl-6 pb-2 space-y-1">
                            {prog.batches.map((batch) => {
                              const batchOpen = expandedBatches.has(batch.id);
                              return (
                                <div key={batch.id}>
                                  <div className="flex items-center justify-between py-1.5">
                                    <button
                                      onClick={() => toggle(expandedBatches, setExpandedBatches, batch.id)}
                                      className="flex items-center gap-2 text-left flex-1"
                                    >
                                      {batchOpen ? (
                                        <ChevronDown className="h-3 w-3 text-text-secondary" />
                                      ) : (
                                        <ChevronRight className="h-3 w-3 text-text-secondary" />
                                      )}
                                      <span className="text-sm text-text-primary dark:text-text-dark-primary">
                                        {batch.label}
                                      </span>
                                      <span className="text-xs text-text-secondary">
                                        {batch.sections.length} section{batch.sections.length !== 1 && "s"}
                                      </span>
                                    </button>
                                    <div className="flex items-center gap-1">
                                      {canEdit && (
                                        <>
                                          <IconBtn onClick={() => setModal({ type: "section", mode: "create", batchId: batch.id })} title="Add section">
                                            <Plus className="h-3 w-3" />
                                          </IconBtn>
                                          <IconBtn onClick={() => setModal({ type: "batch", mode: "edit", entity: batch })} title="Edit">
                                            <Pencil className="h-3 w-3" />
                                          </IconBtn>
                                          <IconBtn onClick={() => handleDelete("batch", batch.id)} title="Delete" danger>
                                            <Trash2 className="h-3 w-3" />
                                          </IconBtn>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  {batchOpen && (
                                    <div className="pl-5 pb-1.5 flex flex-wrap gap-2">
                                      {batch.sections.map((s) => (
                                        <span
                                          key={s.id}
                                          className="inline-flex items-center gap-1.5 rounded-full bg-surface dark:bg-surface-dark px-2.5 py-1 text-xs text-text-secondary"
                                        >
                                          Sec {s.name}
                                          {canEdit && (
                                            <>
                                              <button onClick={() => setModal({ type: "section", mode: "edit", entity: s })}>
                                                <Pencil className="h-2.5 w-2.5" />
                                              </button>
                                              <button onClick={() => handleDelete("section", s.id)}>
                                                <Trash2 className="h-2.5 w-2.5 text-danger" />
                                              </button>
                                            </>
                                          )}
                                        </span>
                                      ))}
                                      {batch.sections.length === 0 && (
                                        <span className="text-xs text-text-secondary">No sections yet.</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {prog.batches.length === 0 && (
                              <p className="text-xs text-text-secondary py-1">No batches yet.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {dept.programs.length === 0 && (
                    <p className="text-xs text-text-secondary py-2 pl-8">No programs yet.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal?.type === "department" && modal.mode === "create" && (
        <EntityFormModal
          title="Add department"
          fields={DEPARTMENT_FIELDS}
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.post("/departments", v);
            load();
          }}
        />
      )}
      {modal?.type === "department" && modal.mode === "edit" && (
        <EntityFormModal
          title="Edit department"
          fields={DEPARTMENT_FIELDS}
          initialValues={{ name: modal.entity.name, code: modal.entity.code }}
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.put(`/departments/${modal.entity.id}`, v);
            load();
          }}
        />
      )}
      {modal?.type === "program" && modal.mode === "create" && (
        <EntityFormModal
          title="Add program"
          fields={PROGRAM_FIELDS}
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.post(`/departments/${modal.departmentId}/programs`, v);
            load();
          }}
        />
      )}
      {modal?.type === "program" && modal.mode === "edit" && (
        <EntityFormModal
          title="Edit program"
          fields={PROGRAM_FIELDS}
          initialValues={{ name: modal.entity.name, durationYears: modal.entity.durationYears }}
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.put(`/departments/programs/${modal.entity.id}`, v);
            load();
          }}
        />
      )}
      {modal?.type === "batch" && modal.mode === "create" && (
        <EntityFormModal
          title="Add batch"
          fields={BATCH_FIELDS}
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.post(`/departments/programs/${modal.programId}/batches`, v);
            load();
          }}
        />
      )}
      {modal?.type === "batch" && modal.mode === "edit" && (
        <EntityFormModal
          title="Edit batch"
          fields={BATCH_FIELDS}
          initialValues={{
            label: modal.entity.label,
            startYear: modal.entity.startYear,
            endYear: modal.entity.endYear,
          }}
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.put(`/departments/batches/${modal.entity.id}`, v);
            load();
          }}
        />
      )}
      {modal?.type === "section" && modal.mode === "create" && (
        <EntityFormModal
          title="Add section"
          fields={SECTION_FIELDS}
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.post(`/departments/batches/${modal.batchId}/sections`, v);
            load();
          }}
        />
      )}
      {modal?.type === "section" && modal.mode === "edit" && (
        <EntityFormModal
          title="Edit section"
          fields={SECTION_FIELDS}
          initialValues={{ name: modal.entity.name }}
          onClose={() => setModal(null)}
          onSubmit={async (v) => {
            await api.put(`/departments/sections/${modal.entity.id}`, v);
            load();
          }}
        />
      )}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-md p-1.5 hover:bg-surface dark:hover:bg-surface-dark ${
        danger ? "text-danger" : "text-text-secondary"
      }`}
    >
      {children}
    </button>
  );
}
