import { Employee, WhosOutEntry, TimeOffRequest, Dataset, DatasetField } from './types.js';

export function formatEmployee(emp: Employee): string {
  const lines: string[] = [];
  lines.push(`**${emp.displayName || `${emp.firstName} ${emp.lastName}`}** (ID: ${emp.id})`);
  if (emp.jobTitle) lines.push(`  Title: ${emp.jobTitle}`);
  if (emp.department) lines.push(`  Department: ${emp.department}`);
  if (emp.division) lines.push(`  Division: ${emp.division}`);
  if (emp.location) lines.push(`  Location: ${emp.location}`);
  if (emp.workEmail) lines.push(`  Email: ${emp.workEmail}`);
  if (emp.workPhone) lines.push(`  Work Phone: ${emp.workPhone}`);
  if (emp.mobilePhone) lines.push(`  Mobile: ${emp.mobilePhone}`);
  if (emp.supervisor) lines.push(`  Supervisor: ${emp.supervisor}`);
  if (emp.status) lines.push(`  Status: ${emp.status}`);
  if (emp.hireDate) lines.push(`  Hire Date: ${emp.hireDate}`);
  return lines.join('\n');
}

export function formatEmployeeList(employees: Employee[]): string {
  if (employees.length === 0) return 'No employees found.';
  return employees.map(formatEmployee).join('\n\n');
}

export function formatWhosOut(entries: WhosOutEntry[]): string {
  if (entries.length === 0) return 'No one is currently out.';
  return entries
    .map((entry) => {
      const name = entry.name || `Employee ${entry.employeeId}`;
      return `- **${name}**: ${entry.start} to ${entry.end} (${entry.type})`;
    })
    .join('\n');
}

export function formatTimeOffRequest(req: TimeOffRequest): string {
  const lines: string[] = [];
  lines.push(`**${req.name}** — ${req.type.name}`);
  lines.push(`  Status: ${req.status.status}`);
  lines.push(`  Period: ${req.start} to ${req.end}`);
  lines.push(`  Amount: ${req.amount.amount} ${req.amount.unit}`);
  lines.push(`  Created: ${req.created}`);
  return lines.join('\n');
}

export function formatTimeOffRequests(requests: TimeOffRequest[]): string {
  if (requests.length === 0) return 'No time-off requests found.';
  return requests.map(formatTimeOffRequest).join('\n\n');
}

export function formatDatasets(datasets: Dataset[]): string {
  if (datasets.length === 0) return 'No datasets found.';
  return datasets
    .map((ds) => {
      let line = `- **${ds.name}**`;
      if (ds.lastUpdateDatetime) line += ` (last updated: ${ds.lastUpdateDatetime})`;
      return line;
    })
    .join('\n');
}

export function formatDatasetFields(fields: DatasetField[]): string {
  if (fields.length === 0) return 'No fields found.';
  return fields
    .map((f) => `- **${f.name}** (${f.id}): ${f.type}`)
    .join('\n');
}

export function formatAnalyticsData(data: unknown): string {
  if (Array.isArray(data)) {
    if (data.length === 0) return 'No data returned.';
    // Format as a compact table
    const headers = Object.keys(data[0] as Record<string, unknown>);
    const rows = data.map((row) => {
      const r = row as Record<string, unknown>;
      return headers.map((h) => String(r[h] ?? '')).join(' | ');
    });
    return `${headers.join(' | ')}\n${'---'.repeat(headers.length)}\n${rows.join('\n')}`;
  }
  return JSON.stringify(data, null, 2);
}
