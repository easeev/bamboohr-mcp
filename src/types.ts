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

// Recruiting types
export interface Application {
  id: number;
  appliedDate: string;
  status: { id: number; label: string };
  rating: number | null;
  applicant: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    source?: string;
    avatar?: string | null;
  };
  job: {
    id: number;
    title: { id: number | null; label: string };
  };
}

export interface ApplicationDetails {
  id: number;
  appliedDate: string;
  status: {
    id: number;
    label: string;
    dateChanged?: string;
    changedByUser?: {
      id: number;
      firstName: string;
      lastName: string;
      avatar?: string | null;
      jobTitle?: { id: number | null; label: string | null };
    } | null;
  };
  rating: number | null;
  resumeFileId: number | null;
  coverLetterFileId: number | null;
  attachmentCount: number | null;
  attachments?: Array<{
    id: number;
    name: string;
    fileUrl: string;
  }> | null;
  movedTo?: unknown[] | null;
  movedFrom?: unknown[] | null;
  alsoConsideredForCount: number;
  duplicateApplicationCount: number;
  referredBy: string | null;
  desiredSalary: string | null;
  commentCount: number;
  emailCount: number;
  eventCount: number;
  questionsAndAnswers: Array<{
    question: { id: number; label: string };
    answer: { id: number; label: string } | null;
    hasRevisions?: boolean | null;
    isArchived?: boolean | null;
    archivedDate?: string | null;
    editedDate?: string | null;
    editedEndDate?: string | null;
  }>;
  applicationReferences: string | null;
  applicant: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string | null;
    avatar: string | null;
    source: string | null;
    twitterUsername: string | null;
    address: {
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      state: string | null;
      zipcode: string | null;
      country: string | null;
    } | null;
    linkedinUrl: string | null;
    websiteUrl: string | null;
    availableStartDate: string | null;
    education: {
      institution: string | null;
      level: { id: number; label: string } | null;
    } | null;
  };
  job: {
    id: number;
    title: { id: number | null; label: string };
    hiringLead?: {
      employeeId: number;
      firstName: string;
      lastName: string;
      avatar: string | null;
      jobTitle: { id: number | null; label: string | null } | null;
    } | null;
  };
}

export interface JobSummary {
  id: number;
  title: { id: number | null; label: string };
  postedDate: string;
  location: { id: number; label: string; address: unknown } | null;
  department: { id: number; label: string } | null;
  status: { id: number; label: string };
  hiringLead: {
    employeeId: number;
    firstName: string;
    lastName: string;
    avatar: string | null;
    jobTitle: unknown;
  } | null;
  newApplicantsCount: number;
  activeApplicantsCount: number;
  totalApplicantsCount: number;
  postingUrl: string | null;
}

export interface ApplicantStatus {
  id: string;
  code: string | null;
  name: string;
  translatedName: string;
  description: string | null;
  enabled: boolean;
  manageable: boolean;
}

// Tool handler result — index signature required by MCP SDK
export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}
