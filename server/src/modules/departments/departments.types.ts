export interface CreateDepartmentInput {
  name: string;
  code: string;
}

export interface UpdateDepartmentInput {
  name?: string;
  code?: string;
}

export interface CreateProgramInput {
  name: string;
  durationYears: number;
}

export interface CreateBatchInput {
  startYear: number;
  endYear: number;
  label: string;
}

export interface CreateSectionInput {
  name: string;
}
