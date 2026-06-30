import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as bambooClient from '../../bambooClient';
import { registerMetaTools } from '../../tools/meta';

jest.mock('../../bambooClient');

const mockedClient = bambooClient as jest.Mocked<typeof bambooClient>;

describe('meta tools', () => {
  let handlers: Map<string, Function>;

  beforeAll(() => {
    handlers = new Map();
    const server = {
      tool: (name: string, _desc: string, _params: any, handler: Function) => {
        handlers.set(name, handler);
      },
    } as unknown as McpServer;
    registerMetaTools(server);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get-meta-fields', () => {
    it('returns all meta fields', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce([
        { id: 1, name: 'Status', type: 'list' },
        { id: 2, name: 'Department', type: 'list', alias: 'dept' },
      ]);

      const handler = handlers.get('get-meta-fields')!;
      const result = await handler({});
      expect(result.content[0].text).toContain('Status');
      expect(result.content[0].text).toContain('Department');
      expect(result.content[0].text).toContain('alias: dept');
    });

    it('filters by type', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({
        timeOffTypes: [
          { id: '3', name: 'Vacation', units: 'days' },
        ],
      });

      const handler = handlers.get('get-meta-fields')!;
      const result = await handler({ type: 'time_off_type' });
      expect(result.content[0].text).toContain('Vacation');
      expect(result.content[0].text).toContain('units: days');
      expect(result.content[0].text).not.toContain('alias: days');
      expect(mockedClient.bambooGet).toHaveBeenCalledWith('/meta/time_off/types');
    });

    it('uses the documented time off policies endpoint', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce([
        { id: 4, timeOffTypeId: 3, name: 'Vacation Policy', type: 'manual' },
      ]);

      const handler = handlers.get('get-meta-fields')!;
      const result = await handler({ type: 'time_off_policy' });
      expect(result.content[0].text).toContain('Vacation Policy');
      expect(result.content[0].text).toContain('type: time_off_policy');
      expect(mockedClient.bambooGet).toHaveBeenCalledWith('/meta/time_off/policies');
    });

    it('returns empty message', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce([]);

      const handler = handlers.get('get-meta-fields')!;
      const result = await handler({});
      expect(result.content[0].text).toContain('No meta fields');
    });

    it('validates field type', async () => {
      const handler = handlers.get('get-meta-fields')!;
      const result = await handler({ type: 'invalid_type' });
      expect(result.isError).toBe(true);
    });
  });

  describe('get-departments', () => {
    it('returns departments', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce([
        {
          name: 'Department',
          options: [
            { id: '1', name: 'Engineering', archived: 'no' },
            { id: '2', name: 'Sales', archived: 'yes' },
          ],
        },
      ]);

      const handler = handlers.get('get-departments')!;
      const result = await handler({});
      expect(result.content[0].text).toContain('Engineering');
      expect(result.content[0].text).not.toContain('Sales');
      expect(mockedClient.bambooGet).toHaveBeenCalledWith('/meta/lists', { format: 'json' });
    });
  });

  describe('get-team-info', () => {
    it('filters by supervisor ID', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({
        employees: [
          { id: '1', displayName: 'Alice', supervisorId: '100' },
          { id: '2', displayName: 'Bob', supervisorId: '200' },
        ],
      });

      const handler = handlers.get('get-team-info')!;
      const result = await handler({ supervisorId: '100' });
      expect(result.content[0].text).toContain('Alice');
      expect(result.content[0].text).not.toContain('Bob');
    });

    it('filters by department', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({
        employees: [
          { id: '1', displayName: 'Alice', department: 'Engineering' },
          { id: '2', displayName: 'Bob', department: 'Sales' },
        ],
      });

      const handler = handlers.get('get-team-info')!;
      const result = await handler({ department: 'engineering' });
      expect(result.content[0].text).toContain('Alice');
      expect(result.content[0].text).not.toContain('Bob');
    });

    it('returns empty message when no matches', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({
        employees: [{ id: '1', displayName: 'Alice', supervisorId: '100' }],
      });

      const handler = handlers.get('get-team-info')!;
      const result = await handler({ supervisorId: '999' });
      expect(result.content[0].text).toContain('No team members found');
    });
  });
});
