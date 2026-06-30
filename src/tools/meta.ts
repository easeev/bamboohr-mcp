import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { bambooGet } from '../bambooClient.js';
import { formatErrorForUser } from '../errors.js';
import { formatEmployeeList } from '../formatters.js';
import { MetaField, Department, EmployeeDirectory } from '../types.js';
import { metaFieldTypeSchema } from '../validation.js';

type MetaFieldLike = {
  id: number | string;
  name: string;
  type: string;
  alias?: string;
};

type TimeOffTypesResponse = {
  timeOffTypes?: Array<{ id: number | string; name: string; units?: string }>;
};

type ListFieldResponse = Array<{
  alias?: string;
  name?: string;
  options?: Array<{
    id: number | string;
    name: string;
    archived?: string;
  }>;
}>;

function result(text: string, isError?: boolean) {
  return { content: [{ type: 'text' as const, text }], ...(isError ? { isError } : {}) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reg(server: McpServer, name: string, description: string, params: any, handler: any) {
  server.tool(name, description, params, handler);
}

function formatMetaFields(fields: MetaFieldLike[]): string {
  return fields
    .map((f) => {
      let line = `- **${f.name}** (ID: ${f.id}, type: ${f.type})`;
      if (f.alias) line += ` [alias: ${f.alias}]`;
      return line;
    })
    .join('\n');
}

export function registerMetaTools(server: McpServer): void {
  reg(server,
    'get-meta-fields',
    'Get BambooHR field metadata. Optionally filter by type: list, time_off_type, time_off_policy',
    {
      type: z.string().optional().describe('Optional field type filter: list, time_off_type, time_off_policy'),
    },
    async ({ type }: { type?: string }) => {
      try {
        if (type) metaFieldTypeSchema.parse(type);
        const path = type === 'time_off_type'
          ? '/meta/time_off/types'
          : type === 'time_off_policy'
            ? '/meta/time_off/policies'
            : type
              ? `/meta/fields/${type}`
              : '/meta/fields';
        const response = await bambooGet<MetaField[] | TimeOffTypesResponse>(path);
        const fields: MetaFieldLike[] = type === 'time_off_type'
          ? (Array.isArray(response) ? response : response.timeOffTypes ?? [])
            .map((field) => {
              const units = 'units' in field && typeof field.units === 'string' ? field.units : undefined;
              return {
                id: field.id,
                name: field.name,
                type: 'time_off_type',
                alias: units,
              };
            })
          : type === 'time_off_policy'
            ? (Array.isArray(response) ? response : [])
              .map((field) => ({
                ...field,
                type: 'time_off_policy',
              }))
            : Array.isArray(response)
              ? response
              : [];
        if (!fields || fields.length === 0) {
          return result('No meta fields found.');
        }
        const formatted = formatMetaFields(fields);
        return result(`Meta Fields:\n\n${formatted}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'get-departments',
    'Get all departments in the company',
    {},
    async () => {
      try {
        const lists = await bambooGet<ListFieldResponse>('/meta/lists', { format: 'json' });
        const departmentList = lists.find((list) =>
          list.alias?.toLowerCase() === 'department'
          || list.name?.toLowerCase() === 'department'
        );
        const departments: Department[] = (departmentList?.options ?? [])
          .filter((option) => option.archived !== 'yes')
          .map((option) => ({
            id: String(option.id),
            name: option.name,
          }));
        if (!departments || departments.length === 0) {
          return result('No departments found.');
        }
        const formatted = departments
          .map((d) => `- **${d.name}** (ID: ${d.id})`)
          .join('\n');
        return result(`Departments:\n\n${formatted}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'get-team-info',
    'Get team members for a specific supervisor/manager from the employee directory',
    {
      supervisorId: z.string().optional().describe('Filter by supervisor employee ID (numeric)'),
      department: z.string().optional().describe('Filter by department name'),
    },
    async ({ supervisorId, department }: { supervisorId?: string; department?: string }) => {
      try {
        const directory = await bambooGet<EmployeeDirectory>('/employees/directory');
        let members = directory.employees;

        if (supervisorId) {
          members = members.filter((e) => String(e.supervisorId) === supervisorId);
        }
        if (department) {
          const deptLower = department.toLowerCase();
          members = members.filter(
            (e) => e.department && e.department.toLowerCase().includes(deptLower)
          );
        }

        if (members.length === 0) {
          const filters: string[] = [];
          if (supervisorId) filters.push(`supervisor ID: ${supervisorId}`);
          if (department) filters.push(`department: ${department}`);
          return result(`No team members found matching ${filters.join(', ')}.`);
        }

        return result(`Team Members (${members.length}):\n\n${formatEmployeeList(members)}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );
}
