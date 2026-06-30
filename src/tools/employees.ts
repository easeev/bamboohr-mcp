import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { bambooGet, bambooPost } from '../bambooClient.js';
import { loadConfig } from '../config.js';
import { formatErrorForUser } from '../errors.js';
import { formatEmployee, formatEmployeeList } from '../formatters.js';
import { Employee, EmployeeDirectory, EmployeeGoal } from '../types.js';
import {
  employeeIdSchema,
  photoSizeSchema,
} from '../validation.js';

const DEFAULT_FIELDS = [
  'firstName', 'lastName', 'preferredName', 'displayName', 'jobTitle',
  'workPhone', 'mobilePhone', 'workEmail', 'department', 'division',
  'location', 'supervisor', 'supervisorId', 'status', 'hireDate', 'photoUrl',
];

function result(text: string, isError?: boolean) {
  return { content: [{ type: 'text' as const, text }], ...(isError ? { isError } : {}) };
}

// Helper to register a tool, working around TS2589 deep type instantiation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reg(server: McpServer, name: string, description: string, params: any, handler: any) {
  server.tool(name, description, params, handler);
}

export function registerEmployeeTools(server: McpServer): void {
  reg(server,
    'get-employee',
    'Get detailed information about a specific employee by their ID',
    {
      employeeId: z.string().describe('The employee ID (numeric)'),
      fields: z.string().optional().describe('Comma-separated fields to retrieve. Defaults to common fields.'),
    },
    async ({ employeeId, fields }: { employeeId: string; fields?: string }) => {
      try {
        const id = employeeIdSchema.parse(employeeId);
        const fieldList = fields ? fields : DEFAULT_FIELDS.join(',');
        const employee = await bambooGet<Employee>(`/employees/${id}`, { fields: fieldList });
        employee.id = id;
        return result(formatEmployee(employee));
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'find-employee',
    'Search the employee directory by name, email, department, or job title',
    {
      query: z.string().describe('Search query to match against employee name, email, department, or title'),
    },
    async ({ query }: { query: string }) => {
      try {
        const directory = await bambooGet<EmployeeDirectory>('/employees/directory');
        const q = query.toLowerCase();
        const matches = directory.employees.filter((emp) => {
          const searchable = [
            emp.displayName, emp.firstName, emp.lastName,
            emp.workEmail, emp.department, emp.jobTitle, emp.location,
          ].filter(Boolean).join(' ').toLowerCase();
          return searchable.includes(q);
        });
        return result(
          matches.length > 0
            ? `Found ${matches.length} employee(s) matching "${query}":\n\n${formatEmployeeList(matches)}`
            : `No employees found matching "${query}".`
        );
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'update-employee',
    'Update employee information. Fields may be restricted by BAMBOO_UPDATE_ALLOWED_FIELDS env var.',
    {
      employeeId: z.string().describe('The employee ID (numeric)'),
      fieldsJson: z.string().describe('JSON string mapping field names to new values, e.g. \'{"mobilePhone": "555-1234"}\''),
    },
    async ({ employeeId, fieldsJson }: { employeeId: string; fieldsJson: string }) => {
      try {
        const id = employeeIdSchema.parse(employeeId);
        const config = loadConfig();

        let fields: Record<string, string>;
        try {
          fields = JSON.parse(fieldsJson);
        } catch {
          return result('Error: fieldsJson must be a valid JSON object', true);
        }

        if (config.updateAllowedFields) {
          const disallowed = Object.keys(fields).filter(
            (f) => !config.updateAllowedFields!.includes(f)
          );
          if (disallowed.length > 0) {
            return result(
              `Error: The following fields are not in the allowed update list: ${disallowed.join(', ')}.\nAllowed fields: ${config.updateAllowedFields.join(', ')}`,
              true
            );
          }
        }

        await bambooPost(`/employees/${id}`, fields);
        return result(`Successfully updated employee ${id}. Updated fields: ${Object.keys(fields).join(', ')}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'get-employee-directory',
    'Get the full company employee directory',
    {},
    async () => {
      try {
        const directory = await bambooGet<EmployeeDirectory>('/employees/directory');
        const count = directory.employees.length;
        return result(`Employee Directory (${count} employees):\n\n${formatEmployeeList(directory.employees)}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'get-employee-photo',
    'Get the URL for an employee photo in a specific size',
    {
      employeeId: z.string().describe('The employee ID (numeric)'),
      size: z.string().optional().describe('Photo size: original, large, medium, small, xs, tiny. Default: medium'),
    },
    async ({ employeeId, size }: { employeeId: string; size?: string }) => {
      try {
        const id = employeeIdSchema.parse(employeeId);
        const photoSize = photoSizeSchema.parse(size || 'medium');
        const employee = await bambooGet<Employee>(`/employees/${id}`, { fields: 'photoUrl' });
        const photoUrl = employee.photoUrl;
        if (!photoUrl) {
          return result(`No photo available for employee ${id}.`);
        }
        return result(`Photo URL for employee ${id} (${photoSize}): ${photoUrl}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'get-employee-goals',
    'Get performance goals for a specific employee',
    {
      employeeId: z.string().describe('The employee ID (numeric)'),
    },
    async ({ employeeId }: { employeeId: string }) => {
      try {
        const id = employeeIdSchema.parse(employeeId);
        const response = await bambooGet<EmployeeGoal[] | { goals?: EmployeeGoal[] }>(`/performance/employees/${id}/goals`);
        const goals = Array.isArray(response) ? response : response.goals ?? [];
        if (!goals || goals.length === 0) {
          return result(`No goals found for employee ${id}.`);
        }
        const formatted = goals
          .map((g) => {
            let line = `- **${g.title}**`;
            if (g.status) line += ` [${g.status}]`;
            if (g.percentComplete !== undefined) line += ` (${g.percentComplete}% complete)`;
            if (g.description) line += `\n  ${g.description}`;
            return line;
          })
          .join('\n');
        return result(`Goals for employee ${id}:\n\n${formatted}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );
}
