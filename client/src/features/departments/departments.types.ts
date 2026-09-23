export interface Section {
  id: string;
  name: string;
  batchId: string;
}

export interface Batch {
  id: string;
  label: string;
  startYear: number;
  endYear: number;
  programId: string;
  sections: Section[];
}

export interface Semester {
  id: string;
  programId: string;
  number: number;
  name: string;
}

export interface Program {
  id: string;
  name: string;
  durationYears: number;
  departmentId: string;
  batches: Batch[];
  /** created automatically from durationYears (two per year) - Academics is the source of truth */
  semesters: Semester[];
}

export interface Department {
  id: string;
  name: string;
  code: string;
  programs: Program[];
}
