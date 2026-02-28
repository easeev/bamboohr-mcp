import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { bambooGet } from '../bambooClient.js';
import { formatErrorForUser } from '../errors.js';
import { formatEmployeeList } from '../formatters.js';
import { MetaField, Department, EmployeeDirectory } from '../types.js';
import { metaFieldTypeSchema } from '../validation.js';

function result(text: string, isError?: boolean) {
  return { content: [{ type: 'text' as const, text }], ...(isError ? { isError } : {}) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reg(server: McpServer, name: string, description: string, params: any, handler: any) {
  server.tool(name, description, params, handler);
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
        const path = type ? `/meta/fields/${type}` : '/meta/fields';
        const fields = await bambooGet<MetaField[]>(path);
        if (!fields || fields.length === 0) {
          return result('No meta fields found.');
        }
        const formatted = fields
          .map((f) => {
            let line = `- **${f.name}** (ID: ${f.id}, type: ${f.type})`;
            if (f.alias) line += ` [alias: ${f.alias}]`;
            return line;
          })
          .join('\n');
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
        const departments = await bambooGet<Department[]>('/meta/departments');
        if (!departments || departments.length === 0) {
          return result('No departments found.');
        }
        const formatted = departments
          .map((d) => {
            let line = `- **${d.name}** (ID: ${d.id})`;
            if (d.parentId) line += ` [parent: ${d.parentId}]`;
            return line;
          })
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
