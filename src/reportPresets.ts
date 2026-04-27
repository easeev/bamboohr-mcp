// Saved field-set presets for ad-hoc custom reports.
// BambooHR's REST API does not expose a way to create *saved* custom reports
// (that's UI-only). These presets let callers refer to a known field set by
// name and run it via POST /reports/custom.
//
// Each preset lists BambooHR field IDs / aliases. Use /meta/fields to discover
// IDs for a given workspace.

export interface ReportPreset {
  title: string;
  description: string;
  fields: string[];
}

export const reportPresets: Record<string, ReportPreset> = {
  // Mirrors the xlsx report "Employee List (finance close)" used by Finance.
  // Output columns: Employee #, First Name, Last Name, Hire Date, Function,
  // Division, Job Title, Department, Location, Country, Pay rate (incl currency),
  // Salary Hosting %, Salary Enterprise %, Employment Status (FTE), Status,
  // Termination Date, Segment.
  'finance-close': {
    title: 'Employee List (finance close)',
    description:
      'Finance close employee roster: pay rate, hosting/enterprise allocation %, segment, function, location, status.',
    fields: [
      'employeeNumber',
      'firstName',
      'lastName',
      'hireDate',
      '4436', // customFunction
      'division',
      'jobTitle',
      'department',
      'location',
      'country',
      'payRate',
      '4693', // Salary Hosting, %
      '4695', // Salary Enterprise, %
      'employmentHistoryStatus',
      'status',
      'terminationDate',
      '4670', // customSegment (Hosting / Enterprise / etc.)
    ],
  },
};

export function listPresets(): string[] {
  return Object.keys(reportPresets);
}
