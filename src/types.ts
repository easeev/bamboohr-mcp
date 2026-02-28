// Employee types
export interface Employee {
  id: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  preferredName?: string;
  jobTitle?: string;
  workPhone?: string;
  mobilePhone?: string;
  workEmail?: string;
  department?: string;
  location?: string;
  division?: string;
  photoUrl?: string;
  supervisor?: string;
  supervisorId?: string;
  status?: string;
  hireDate?: string;
  [key: string]: unknown;
}

export interface EmployeeDirectory {
  fields: Array<{ id: string; type: string; name: string }>;
  employees: Employee[];
}

// Time Off types
export interface TimeOffRequest {
  id: string;
  employeeId: string;
  status: { lastChanged: string; lastChangedByUserId: string; status: string };
  name: string;
  start: string;
  end: string;
  created: string;
  type: { id: string; name: string };
  amount: { unit: string; amount: string };
  notes?: { [key: string]: unknown };
  dates?: { [date: string]: string };
  [key: string]: unknown;
}

export interface WhosOutEntry {
  id?: number;
  type: string;
  employeeId?: number;
  name?: string;
  start: string;
  end: string;
  [key: string]: unknown;
}

export interface TimeOffBalance {
  end: string;
  estimate: number;
  [key: string]: unknown;
}

// File types
export interface CompanyFile {
  id: string;
  name: string;
  originalFileName: string;
  size: number;
  dateCreated: string;
  createdBy: string;
  [key: string]: unknown;
}

export interface CompanyFileCategory {
  id: string;
  name: string;
  files: CompanyFile[];
}

export interface EmployeeFileCategory {
  id: string;
  name: string;
  files: CompanyFile[];
}

// Meta types
export interface MetaField {
  id: number;
  name: string;
  type: string;
  alias?: string;
  [key: string]: unknown;
}

export interface Department {
  id: string;
  name: string;
  parentId?: string;
  [key: string]: unknown;
}

// Analytics types
export interface Dataset {
  name: string;
  lastUpdateDatetime?: string;
  [key: string]: unknown;
}

export interface DatasetField {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

// Report types
export interface CustomReport {
  id: string;
  name: string;
  lastModified?: string;
  [key: string]: unknown;
}

// Goal types
export interface EmployeeGoal {
  id: string;
  title: string;
  description?: string;
  percentComplete?: number;
  status?: string;
  [key: string]: unknown;
}

// Tool handler result — index signature required by MCP SDK
export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}
