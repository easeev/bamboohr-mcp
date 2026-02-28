import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as bambooClient from '../../bambooClient';
import { registerTimeOffTools } from '../../tools/timeOff';

jest.mock('../../bambooClient');

const mockedClient = bambooClient as jest.Mocked<typeof bambooClient>;

describe('time-off tools', () => {
  let handlers: Map<string, Function>;

  beforeAll(() => {
    handlers = new Map();
    const server = {
      tool: (name: string, _desc: string, _params: any, handler: Function) => {
        handlers.set(name, handler);
      },
    } as unknown as McpServer;
    registerTimeOffTools(server);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get-whos-out', () => {
    it('returns who is out', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce([
        { name: 'John Doe', start: '2026-03-01', end: '2026-03-05', type: 'vacation' },
      ]);

      const handler = handlers.get('get-whos-out')!;
      const result = await handler({});
      expect(result.content[0].text).toContain('John Doe');
      expect(result.content[0].text).toContain('vacation');
    });

    it('returns empty message when nobody is out', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce([]);

      const handler = handlers.get('get-whos-out')!;
      const result = await handler({});
      expect(result.content[0].text).toContain('No one is currently out');
    });

    it('validates date format', async () => {
      const handler = handlers.get('get-whos-out')!;
      const result = await handler({ start: 'invalid' });
      expect(result.isError).toBe(true);
    });
  });

  describe('get-time-off-requests', () => {
    it('returns time-off requests', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce([
        {
          id: '1',
          name: 'John Doe',
          status: { status: 'approved' },
          start: '2026-03-01',
          end: '2026-03-05',
          created: '2026-02-15',
          type: { id: '1', name: 'Vacation' },
          amount: { amount: '5', unit: 'days' },
        },
      ]);

      const handler = handlers.get('get-time-off-requests')!;
      const result = await handler({ start: '2026-03-01', end: '2026-03-31' });
      expect(result.content[0].text).toContain('John Doe');
      expect(result.content[0].text).toContain('approved');
    });

    it('validates start and end dates', async () => {
      const handler = handlers.get('get-time-off-requests')!;
      const result = await handler({ start: 'bad', end: '2026-03-31' });
      expect(result.isError).toBe(true);
    });

    it('validates status enum', async () => {
      const handler = handlers.get('get-time-off-requests')!;
      const result = await handler({ start: '2026-03-01', end: '2026-03-31', status: 'invalid' });
      expect(result.isError).toBe(true);
    });
  });

  describe('estimate-time-off-balance', () => {
    it('returns balance estimate', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({
        end: '2026-12-31',
        estimate: 80,
      });

      const handler = handlers.get('estimate-time-off-balance')!;
      const result = await handler({ employeeId: '123', end: '2026-12-31' });
      expect(result.content[0].text).toContain('80 hours');
    });

    it('validates employee ID', async () => {
      const handler = handlers.get('estimate-time-off-balance')!;
      const result = await handler({ employeeId: 'abc', end: '2026-12-31' });
      expect(result.isError).toBe(true);
    });
  });

  describe('create-time-off-request', () => {
    it('creates a request successfully', async () => {
      mockedClient.bambooPut.mockResolvedValueOnce(undefined);

      const handler = handlers.get('create-time-off-request')!;
      const result = await handler({
        employeeId: '123',
        start: '2026-03-01',
        end: '2026-03-05',
        timeOffTypeId: '1',
        amount: '5',
      });
      expect(result.content[0].text).toContain('created successfully');
    });

    it('validates amount is numeric', async () => {
      const handler = handlers.get('create-time-off-request')!;
      const result = await handler({
        employeeId: '123',
        start: '2026-03-01',
        end: '2026-03-05',
        timeOffTypeId: '1',
        amount: 'not-a-number',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('valid number');
    });
  });
});
