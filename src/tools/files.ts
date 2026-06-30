import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { bambooGet } from '../bambooClient.js';
import { formatErrorForUser } from '../errors.js';
import { CompanyFileCategory, EmployeeFileCategory } from '../types.js';
import { employeeIdSchema, fileIdSchema } from '../validation.js';

function result(text: string, isError?: boolean) {
  return { content: [{ type: 'text' as const, text }], ...(isError ? { isError } : {}) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reg(server: McpServer, name: string, description: string, params: any, handler: any) {
  server.tool(name, description, params, handler);
}

function fileCategories(response: CompanyFileCategory[] | EmployeeFileCategory[] | { categories?: CompanyFileCategory[] | EmployeeFileCategory[] }): CompanyFileCategory[] | EmployeeFileCategory[] {
  return Array.isArray(response) ? response : response.categories ?? [];
}

function formatFileCategories(categories: CompanyFileCategory[] | EmployeeFileCategory[]): string {
  return categories
    .map((cat) => {
      const files = cat.files
        .map((f) => `  - ${f.name} (ID: ${f.id}, ${f.size} bytes, created: ${f.dateCreated})`)
        .join('\n');
      return `**${cat.name}** (Category ID: ${cat.id}):\n${files || '  (empty)'}`;
    })
    .join('\n\n');
}

export function registerFileTools(server: McpServer): void {
  reg(server,
    'list-company-files',
    'List all company-level files organized by category',
    {},
    async () => {
      try {
        const response = await bambooGet<CompanyFileCategory[] | { categories?: CompanyFileCategory[] }>('/files/view');
        const categories = fileCategories(response);
        if (!categories || categories.length === 0) {
          return result('No company files found.');
        }
        return result(`Company Files:\n\n${formatFileCategories(categories)}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'get-company-file',
    'Get metadata for a specific company file',
    {
      fileId: z.string().describe('The file ID (numeric)'),
    },
    async ({ fileId }: { fileId: string }) => {
      try {
        const id = fileIdSchema.parse(fileId);
        const file = await bambooGet<Record<string, unknown>>(`/files/${id}`);
        return result(`File details:\n${JSON.stringify(file, null, 2)}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'get-employee-files',
    'List all files for a specific employee organized by category',
    {
      employeeId: z.string().describe('The employee ID (numeric)'),
    },
    async ({ employeeId }: { employeeId: string }) => {
      try {
        const id = employeeIdSchema.parse(employeeId);
        const response = await bambooGet<EmployeeFileCategory[] | { categories?: EmployeeFileCategory[] }>(`/employees/${id}/files/view`);
        const categories = fileCategories(response);
        if (!categories || categories.length === 0) {
          return result(`No files found for employee ${id}.`);
        }
        return result(`Files for employee ${id}:\n\n${formatFileCategories(categories)}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );
}
