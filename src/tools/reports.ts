import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { bambooGet, bambooPost } from '../bambooClient.js';
import { formatErrorForUser } from '../errors.js';
import { CustomReport } from '../types.js';
import { reportIdSchema, reportFormatSchema } from '../validation.js';
import { reportPresets, listPresets } from '../reportPresets.js';

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
        const response = await bambooGet<CustomReport[] | { reports?: CustomReport[] }>('/custom-reports');
        const reports: CustomReport[] = Array.isArray(response)
          ? response
          : response?.reports ?? [];
        if (reports.length === 0) {
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

  reg(server,
    'list-report-presets',
    'List built-in field-set presets that run-adhoc-report can execute by name',
    {},
    async () => {
      const lines = Object.entries(reportPresets).map(
        ([key, p]) => `- **${key}** — ${p.description} (${p.fields.length} fields)`
      );
      return result(
        lines.length === 0
          ? 'No presets defined.'
          : `Report Presets:\n\n${lines.join('\n')}`
      );
    }
  );

  reg(server,
    'run-adhoc-report',
    'Run an ad-hoc custom report by posting a field list to BambooHR. Use either a saved preset (presetName) or pass an explicit fields array. Returns JSON unless format=CSV. Set onlyCurrent=false to include terminated employees.',
    {
      presetName: z
        .string()
        .optional()
        .describe(`Saved preset name. Available: ${listPresets().join(', ')}`),
      fields: z
        .array(z.string())
        .optional()
        .describe('Explicit list of BambooHR field IDs or aliases (e.g. firstName, 4670)'),
      title: z.string().optional().describe('Report title (defaults to preset title or "Ad-hoc Report")'),
      onlyCurrent: z
        .boolean()
        .optional()
        .describe('Limit to current/active employees only (default: true)'),
      format: z.string().optional().describe('Output format: JSON (default) or CSV'),
    },
    async ({
      presetName,
      fields,
      title,
      onlyCurrent,
      format,
    }: {
      presetName?: string;
      fields?: string[];
      title?: string;
      onlyCurrent?: boolean;
      format?: string;
    }) => {
      try {
        let resolvedFields = fields;
        let resolvedTitle = title;

        if (presetName) {
          const preset = reportPresets[presetName];
          if (!preset) {
            return result(
              `Unknown preset "${presetName}". Available: ${listPresets().join(', ')}`,
              true
            );
          }
          resolvedFields = resolvedFields ?? preset.fields;
          resolvedTitle = resolvedTitle ?? preset.title;
        }

        if (!resolvedFields || resolvedFields.length === 0) {
          return result(
            'Either presetName or a non-empty fields array is required.',
            true
          );
        }

        const outputFormat = reportFormatSchema.parse(format || 'JSON');
        const includeAll = onlyCurrent === false;
        const params: Record<string, unknown> = {
          format: outputFormat,
          onlyCurrent: includeAll ? 'no' : 'yes',
        };

        const body = {
          title: resolvedTitle ?? 'Ad-hoc Report',
          fields: resolvedFields,
        };

        const data = await bambooPost<unknown>('/reports/custom', body, params);

        if (typeof data === 'string') {
          return result(data);
        }
        return result(JSON.stringify(data, null, 2));
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );
}
