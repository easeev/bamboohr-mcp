import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as bambooClient from '../../bambooClient';
import { registerFileTools } from '../../tools/files';

jest.mock('../../bambooClient');

const mockedClient = bambooClient as jest.Mocked<typeof bambooClient>;

describe('file tools', () => {
  let handlers: Map<string, Function>;

  beforeAll(() => {
    handlers = new Map();
    const server = {
      tool: (name: string, _desc: string, _params: any, handler: Function) => {
        handlers.set(name, handler);
      },
    } as unknown as McpServer;
    registerFileTools(server);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list-company-files', () => {
    it('lists company files by category', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({
        categories: [
          {
            id: '1',
            name: 'Policies',
            files: [
              { id: '10', name: 'Handbook.pdf', size: 1024, dateCreated: '2026-01-01' },
            ],
          },
        ],
      });

      const handler = handlers.get('list-company-files')!;
      const result = await handler({});
      expect(result.content[0].text).toContain('Policies');
      expect(result.content[0].text).toContain('Handbook.pdf');
    });

    it('returns empty message', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({ categories: [] });

      const handler = handlers.get('list-company-files')!;
      const result = await handler({});
      expect(result.content[0].text).toContain('No company files');
    });

    it('supports legacy bare array category responses', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce([
        {
          id: '1',
          name: 'Legacy Policies',
          files: [],
        },
      ]);

      const handler = handlers.get('list-company-files')!;
      const result = await handler({});
      expect(result.content[0].text).toContain('Legacy Policies');
    });
  });

  describe('get-company-file', () => {
    it('returns file details', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({
        id: '10',
        name: 'Handbook.pdf',
        size: 1024,
      });

      const handler = handlers.get('get-company-file')!;
      const result = await handler({ fileId: '10' });
      expect(result.content[0].text).toContain('Handbook.pdf');
    });

    it('validates file ID', async () => {
      const handler = handlers.get('get-company-file')!;
      const result = await handler({ fileId: 'abc' });
      expect(result.isError).toBe(true);
    });
  });

  describe('get-employee-files', () => {
    it('lists employee files', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({
        employee: { id: '123' },
        categories: [
          {
            id: '1',
            name: 'Documents',
            files: [
              { id: '20', name: 'Resume.pdf', size: 2048, dateCreated: '2026-01-15' },
            ],
          },
        ],
      });

      const handler = handlers.get('get-employee-files')!;
      const result = await handler({ employeeId: '123' });
      expect(result.content[0].text).toContain('Documents');
      expect(result.content[0].text).toContain('Resume.pdf');
    });

    it('validates employee ID', async () => {
      const handler = handlers.get('get-employee-files')!;
      const result = await handler({ employeeId: 'bad' });
      expect(result.isError).toBe(true);
    });
  });
});
