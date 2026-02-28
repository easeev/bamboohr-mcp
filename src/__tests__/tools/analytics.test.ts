import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as bambooClient from '../../bambooClient';
import { registerAnalyticsTools } from '../../tools/analytics';

jest.mock('../../bambooClient');

const mockedClient = bambooClient as jest.Mocked<typeof bambooClient>;

describe('analytics tools', () => {
  let handlers: Map<string, Function>;

  beforeAll(() => {
    handlers = new Map();
    const server = {
      tool: (name: string, _desc: string, _params: any, handler: Function) => {
        handlers.set(name, handler);
      },
    } as unknown as McpServer;
    registerAnalyticsTools(server);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('discover-datasets', () => {
    it('lists available datasets', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce([
        { name: 'employee_data', lastUpdateDatetime: '2026-02-28T10:00:00Z' },
        { name: 'time_off' },
      ]);

      const handler = handlers.get('discover-datasets')!;
      const result = await handler({});
      expect(result.content[0].text).toContain('employee_data');
      expect(result.content[0].text).toContain('time_off');
      expect(result.content[0].text).toContain('last updated');
    });

    it('handles empty datasets', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce([]);

      const handler = handlers.get('discover-datasets')!;
      const result = await handler({});
      expect(result.content[0].text).toContain('No datasets');
    });
  });

  describe('discover-fields', () => {
    it('lists fields for a dataset', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce([
        { id: 'firstName', name: 'First Name', type: 'text' },
        { id: 'hireDate', name: 'Hire Date', type: 'date' },
      ]);

      const handler = handlers.get('discover-fields')!;
      const result = await handler({ datasetId: 'employee_data' });
      expect(result.content[0].text).toContain('First Name');
      expect(result.content[0].text).toContain('Hire Date');
    });

    it('validates dataset ID', async () => {
      const handler = handlers.get('discover-fields')!;
      const result = await handler({ datasetId: 'invalid/id' });
      expect(result.isError).toBe(true);
    });
  });

  describe('workforce-analytics', () => {
    it('returns analytics results', async () => {
      mockedClient.bambooPost.mockResolvedValueOnce([
        { firstName: 'John', department: 'Engineering' },
        { firstName: 'Jane', department: 'Sales' },
      ]);

      const handler = handlers.get('workforce-analytics')!;
      const result = await handler({ datasetId: 'employee_data' });
      expect(result.content[0].text).toContain('John');
      expect(result.content[0].text).toContain('Engineering');
    });

    it('passes filters and fields', async () => {
      mockedClient.bambooPost.mockResolvedValueOnce([]);

      const handler = handlers.get('workforce-analytics')!;
      await handler({
        datasetId: 'employee_data',
        filtersJson: '{"department": "Engineering"}',
        fields: 'firstName,lastName',
      });

      expect(mockedClient.bambooPost).toHaveBeenCalledWith(
        '/datasets/employee_data',
        {
          filters: { department: 'Engineering' },
          fields: ['firstName', 'lastName'],
        }
      );
    });

    it('validates dataset ID', async () => {
      const handler = handlers.get('workforce-analytics')!;
      const result = await handler({ datasetId: 'bad id!' });
      expect(result.isError).toBe(true);
    });
  });
});
