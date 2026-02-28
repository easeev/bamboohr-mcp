import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as bambooClient from '../../bambooClient';
import { registerEmployeeTools } from '../../tools/employees';

jest.mock('../../bambooClient');

const mockedClient = bambooClient as jest.Mocked<typeof bambooClient>;

describe('employee tools', () => {
  let handlers: Map<string, Function>;

  beforeAll(() => {
    handlers = new Map();
    const server = {
      tool: (name: string, _desc: string, _params: any, handler: Function) => {
        handlers.set(name, handler);
      },
    } as unknown as McpServer;
    registerEmployeeTools(server);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get-employee', () => {
    it('returns formatted employee data', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        jobTitle: 'Engineer',
        department: 'Engineering',
      });

      const handler = handlers.get('get-employee')!;
      const result = await handler({ employeeId: '123' });
      expect(result.content[0].text).toContain('John Doe');
      expect(result.content[0].text).toContain('Engineer');
      expect(result.isError).toBeUndefined();
    });

    it('returns error for invalid employee ID', async () => {
      const handler = handlers.get('get-employee')!;
      const result = await handler({ employeeId: 'abc' });
      expect(result.isError).toBe(true);
    });
  });

  describe('find-employee', () => {
    it('finds matching employees', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({
        employees: [
          { id: '1', displayName: 'John Doe', workEmail: 'john@test.com' },
          { id: '2', displayName: 'Jane Smith', workEmail: 'jane@test.com' },
        ],
      });

      const handler = handlers.get('find-employee')!;
      const result = await handler({ query: 'John' });
      expect(result.content[0].text).toContain('John Doe');
      expect(result.content[0].text).not.toContain('Jane Smith');
      expect(result.content[0].text).toContain('1 employee(s)');
    });

    it('returns no results message when no match', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({
        employees: [{ id: '1', displayName: 'John Doe' }],
      });

      const handler = handlers.get('find-employee')!;
      const result = await handler({ query: 'Nobody' });
      expect(result.content[0].text).toContain('No employees found');
    });
  });

  describe('update-employee', () => {
    it('updates employee successfully', async () => {
      mockedClient.bambooPost.mockResolvedValueOnce(undefined);

      const handler = handlers.get('update-employee')!;
      const result = await handler({
        employeeId: '123',
        fieldsJson: '{"mobilePhone": "555-1234"}',
      });
      expect(result.content[0].text).toContain('Successfully updated');
      expect(result.content[0].text).toContain('mobilePhone');
    });

    it('returns error for invalid JSON', async () => {
      const handler = handlers.get('update-employee')!;
      const result = await handler({
        employeeId: '123',
        fieldsJson: 'not json',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('valid JSON');
    });

    it('enforces field allowlist', async () => {
      const origEnv = process.env.BAMBOO_UPDATE_ALLOWED_FIELDS;
      process.env.BAMBOO_UPDATE_ALLOWED_FIELDS = 'firstName,lastName';

      const handler = handlers.get('update-employee')!;
      const result = await handler({
        employeeId: '123',
        fieldsJson: '{"salary": "100000"}',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not in the allowed update list');

      process.env.BAMBOO_UPDATE_ALLOWED_FIELDS = origEnv || '';
    });
  });

  describe('get-employee-directory', () => {
    it('returns full directory', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({
        employees: [
          { id: '1', displayName: 'John Doe' },
          { id: '2', displayName: 'Jane Smith' },
        ],
      });

      const handler = handlers.get('get-employee-directory')!;
      const result = await handler({});
      expect(result.content[0].text).toContain('2 employees');
      expect(result.content[0].text).toContain('John Doe');
    });
  });

  describe('get-employee-photo', () => {
    it('returns photo URL', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({
        photoUrl: 'https://example.com/photo.jpg',
      });

      const handler = handlers.get('get-employee-photo')!;
      const result = await handler({ employeeId: '123' });
      expect(result.content[0].text).toContain('https://example.com/photo.jpg');
    });

    it('returns no photo message', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({ photoUrl: null });

      const handler = handlers.get('get-employee-photo')!;
      const result = await handler({ employeeId: '123' });
      expect(result.content[0].text).toContain('No photo available');
    });
  });

  describe('get-employee-goals', () => {
    it('returns goals', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce([
        { id: '1', title: 'Learn TypeScript', status: 'in_progress', percentComplete: 50 },
      ]);

      const handler = handlers.get('get-employee-goals')!;
      const result = await handler({ employeeId: '123' });
      expect(result.content[0].text).toContain('Learn TypeScript');
      expect(result.content[0].text).toContain('50%');
    });

    it('returns no goals message', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce([]);

      const handler = handlers.get('get-employee-goals')!;
      const result = await handler({ employeeId: '123' });
      expect(result.content[0].text).toContain('No goals found');
    });
  });
});
