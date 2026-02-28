import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as bambooClient from '../../bambooClient';
import { registerReportTools } from '../../tools/reports';

jest.mock('../../bambooClient');

const mockedClient = bambooClient as jest.Mocked<typeof bambooClient>;

describe('report tools', () => {
  let handlers: Map<string, Function>;

  beforeAll(() => {
    handlers = new Map();
    const server = {
      tool: (name: string, _desc: string, _params: any, handler: Function) => {
        handlers.set(name, handler);
      },
    } as unknown as McpServer;
    registerReportTools(server);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list-custom-reports', () => {
    it('lists available reports', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce([
        { id: '1', name: 'Headcount Report', lastModified: '2026-02-01' },
        { id: '2', name: 'Turnover Report' },
      ]);

      const handler = handlers.get('list-custom-reports')!;
      const result = await handler({});
      expect(result.content[0].text).toContain('Headcount Report');
      expect(result.content[0].text).toContain('Turnover Report');
      expect(result.content[0].text).toContain('last modified');
    });

    it('handles no reports', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce([]);

      const handler = handlers.get('list-custom-reports')!;
      const result = await handler({});
      expect(result.content[0].text).toContain('No custom reports');
    });
  });

  describe('run-custom-report', () => {
    it('runs a report and returns JSON results', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({
        fields: [{ id: 'name', name: 'Name' }],
        employees: [{ name: 'John Doe' }],
      });

      const handler = handlers.get('run-custom-report')!;
      const result = await handler({ reportId: '1' });
      expect(result.content[0].text).toContain('John Doe');
    });

    it('returns string data as-is', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce('CSV,data,here');

      const handler = handlers.get('run-custom-report')!;
      const result = await handler({ reportId: '1', format: 'CSV' });
      expect(result.content[0].text).toBe('CSV,data,here');
    });

    it('validates report ID', async () => {
      const handler = handlers.get('run-custom-report')!;
      const result = await handler({ reportId: 'abc' });
      expect(result.isError).toBe(true);
    });

    it('validates format', async () => {
      const handler = handlers.get('run-custom-report')!;
      const result = await handler({ reportId: '1', format: 'INVALID' });
      expect(result.isError).toBe(true);
    });
  });
});
