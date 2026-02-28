import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { bambooGet } from '../bambooClient.js';
import { formatErrorForUser } from '../errors.js';
import { CustomReport } from '../types.js';
import { reportIdSchema, reportFormatSchema } from '../validation.js';

function result(text: string, isError?: boolean) {
  return { content: [{ type: 'text' as const, text }], ...(isError ? { isError } : {}) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reg(server: McpServer, name: string, description: string, params: any, handler: any) {
  server.tool(name, description, params, handler);
}

export function registerReportTools(server: McpServer): void {
  reg(server,
    'list-custom-reports',
    'List all saved custom reports available in BambooHR',
    {},
    async () => {
      try {
        const reports = await bambooGet<CustomReport[]>('/custom-reports');
        if (!reports || reports.length === 0) {
          return result('No custom reports found.');
        }
        const formatted = reports
          .map((r) => {
            let line = `- **${r.name}** (ID: ${r.id})`;
            if (r.lastModified) line += ` [last modified: ${r.lastModified}]`;
            return line;
          })
          .join('\n');
        return result(`Custom Reports:\n\n${formatted}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'run-custom-report',
    'Execute a saved custom report and get results',
    {
      reportId: z.string().describe('The report ID (numeric)'),
      format: z.string().optional().describe('Output format: JSON (default), CSV, XML, PDF'),
    },
    async ({ reportId, format }: { reportId: string; format?: string }) => {
      try {
        const id = reportIdSchema.parse(reportId);
        const outputFormat = reportFormatSchema.parse(format || 'JSON');
        const data = await bambooGet<unknown>(`/custom-reports/${id}`, { format: outputFormat });
        if (typeof data === 'string') {
          return result(data);
        }
        return result(`Report ${id} Results:\n\n${JSON.stringify(data, null, 2)}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );
}
