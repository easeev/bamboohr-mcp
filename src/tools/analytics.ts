import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { bambooGet, bambooPost } from '../bambooClient.js';
import { formatErrorForUser } from '../errors.js';
import { formatDatasets, formatDatasetFields, formatAnalyticsData } from '../formatters.js';
import { Dataset, DatasetField } from '../types.js';
import { datasetIdSchema } from '../validation.js';

function result(text: string, isError?: boolean) {
  return { content: [{ type: 'text' as const, text }], ...(isError ? { isError } : {}) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reg(server: McpServer, name: string, description: string, params: any, handler: any) {
  server.tool(name, description, params, handler);
}

export function registerAnalyticsTools(server: McpServer): void {
  reg(server,
    'discover-datasets',
    'List all available BambooHR datasets for analytics queries',
    {},
    async () => {
      try {
        const datasets = await bambooGet<Dataset[]>('/datasets');
        return result(`Available Datasets:\n\n${formatDatasets(datasets)}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'discover-fields',
    'List available fields for a specific BambooHR dataset',
    {
      datasetId: z.string().describe('The dataset ID (alphanumeric, hyphens, underscores)'),
    },
    async ({ datasetId }: { datasetId: string }) => {
      try {
        const id = datasetIdSchema.parse(datasetId);
        const fields = await bambooGet<DatasetField[]>(`/datasets/${id}/fields`);
        return result(`Fields for dataset "${id}":\n\n${formatDatasetFields(fields)}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'workforce-analytics',
    'Run an analytics query against a BambooHR dataset with optional filters',
    {
      datasetId: z.string().describe('The dataset ID to query'),
      filtersJson: z.string().optional().describe('JSON object of filters, e.g. \'{"department": "Engineering"}\''),
      fields: z.string().optional().describe('Comma-separated list of fields to include in the results'),
    },
    async ({ datasetId, filtersJson, fields }: { datasetId: string; filtersJson?: string; fields?: string }) => {
      try {
        const id = datasetIdSchema.parse(datasetId);
        const body: Record<string, unknown> = {};
        if (filtersJson) body.filters = JSON.parse(filtersJson);
        if (fields) body.fields = fields.split(',').map((f: string) => f.trim());
        const data = await bambooPost<unknown>(`/datasets/${id}`, body);
        return result(`Analytics Results for "${id}":\n\n${formatAnalyticsData(data)}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );
}
