import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { bambooGet, bambooPut } from '../bambooClient.js';
import { formatErrorForUser } from '../errors.js';
import { formatWhosOut, formatTimeOffRequests } from '../formatters.js';
import { WhosOutEntry, TimeOffRequest, TimeOffBalance } from '../types.js';
import {
  employeeIdSchema,
  dateSchema,
  timeOffStatusSchema,
  timeOffActionSchema,
} from '../validation.js';

function result(text: string, isError?: boolean) {
  return { content: [{ type: 'text' as const, text }], ...(isError ? { isError } : {}) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reg(server: McpServer, name: string, description: string, params: any, handler: any) {
  server.tool(name, description, params, handler);
}

export function registerTimeOffTools(server: McpServer): void {
  reg(server,
    'get-whos-out',
    'Get a list of employees who are currently out or will be out in a date range',
    {
      start: z.string().optional().describe('Start date (YYYY-MM-DD). Defaults to today.'),
      end: z.string().optional().describe('End date (YYYY-MM-DD). Defaults to 14 days from start.'),
    },
    async ({ start, end }: { start?: string; end?: string }) => {
      try {
        if (start) dateSchema.parse(start);
        if (end) dateSchema.parse(end);
        const params: Record<string, string> = {};
        if (start) params.start = start;
        if (end) params.end = end;
        const entries = await bambooGet<WhosOutEntry[]>('/time_off/whos_out', params);
        return result(formatWhosOut(entries));
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'get-time-off-requests',
    'Get time-off requests filtered by date range, employee, status, or action',
    {
      start: z.string().describe('Start date (YYYY-MM-DD)'),
      end: z.string().describe('End date (YYYY-MM-DD)'),
      employeeId: z.string().optional().describe('Filter by employee ID (numeric)'),
      status: z.string().optional().describe('Filter by status: approved, denied, superceded, requested, canceled'),
      action: z.string().optional().describe('Filter by action: view, approve, deny, cancel'),
    },
    async ({ start, end, employeeId, status, action }: {
      start: string; end: string; employeeId?: string; status?: string; action?: string;
    }) => {
      try {
        dateSchema.parse(start);
        dateSchema.parse(end);
        if (employeeId) employeeIdSchema.parse(employeeId);
        if (status) timeOffStatusSchema.parse(status);
        if (action) timeOffActionSchema.parse(action);
        const params: Record<string, string> = { start, end };
        if (employeeId) params.employeeId = employeeId;
        if (status) params.status = status;
        if (action) params.action = action;
        const requests = await bambooGet<TimeOffRequest[]>('/time_off/requests', params);
        return result(formatTimeOffRequests(requests));
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'estimate-time-off-balance',
    'Estimate future time-off balance for an employee on a given date',
    {
      employeeId: z.string().describe('The employee ID (numeric)'),
      end: z.string().describe('The date to estimate balance for (YYYY-MM-DD)'),
    },
    async ({ employeeId, end }: { employeeId: string; end: string }) => {
      try {
        const id = employeeIdSchema.parse(employeeId);
        dateSchema.parse(end);
        const balance = await bambooGet<TimeOffBalance>(
          `/employees/${id}/time_off/calculator`,
          { end }
        );
        return result(`Estimated time-off balance for employee ${id} as of ${end}: ${balance.estimate} hours`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'create-time-off-request',
    'Create a new time-off request for an employee',
    {
      employeeId: z.string().describe('The employee ID (numeric)'),
      start: z.string().describe('Start date (YYYY-MM-DD)'),
      end: z.string().describe('End date (YYYY-MM-DD)'),
      timeOffTypeId: z.string().describe('Time-off type ID (numeric, get from get-meta-fields)'),
      amount: z.string().describe('Amount of time off requested (in days, as a number)'),
      status: z.string().optional().describe('Request status: approved, denied, requested. Default: requested'),
      previousRequest: z.string().optional().describe('ID of a previous request this supersedes'),
    },
    async ({ employeeId, start, end, timeOffTypeId, amount, status, previousRequest }: {
      employeeId: string; start: string; end: string; timeOffTypeId: string;
      amount: string; status?: string; previousRequest?: string;
    }) => {
      try {
        const id = employeeIdSchema.parse(employeeId);
        dateSchema.parse(start);
        dateSchema.parse(end);

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount)) {
          return result('Error: amount must be a valid number', true);
        }

        const body: Record<string, unknown> = {
          start, end, timeOffTypeId,
          amount: parsedAmount,
          status: status || 'requested',
        };
        if (previousRequest) body.previousRequest = previousRequest;

        await bambooPut(`/employees/${id}/time_off/request`, body);
        return result(`Time-off request created successfully for employee ${id}: ${start} to ${end}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );
}
