import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as bambooClient from '../../bambooClient';
import { registerRecruitingTools } from '../../tools/recruiting';

jest.mock('../../bambooClient');

const mockedClient = bambooClient as jest.Mocked<typeof bambooClient>;

describe('recruiting tools', () => {
  let handlers: Map<string, Function>;

  beforeAll(() => {
    handlers = new Map();
    const server = {
      tool: (name: string, _desc: string, _params: any, handler: Function) => {
        handlers.set(name, handler);
      },
    } as unknown as McpServer;
    registerRecruitingTools(server);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get-applications', () => {
    it('returns formatted application list', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({
        applications: [
          {
            id: 101,
            appliedDate: '2024-01-15T10:30:00Z',
            status: { id: 1, label: 'New' },
            rating: 4,
            applicant: {
              id: 501,
              firstName: 'Alice',
              lastName: 'Johnson',
              email: 'alice@test.com',
              source: 'LinkedIn',
            },
            job: { id: 10, title: { id: 1, label: 'Software Engineer' } },
          },
        ],
        paginationComplete: true,
        nextPageUrl: null,
      });

      const handler = handlers.get('get-applications')!;
      const result = await handler({});
      expect(result.content[0].text).toContain('Alice Johnson');
      expect(result.content[0].text).toContain('Software Engineer');
      expect(result.content[0].text).toContain('LinkedIn');
      expect(result.isError).toBeUndefined();
    });

    it('filters by jobId', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({
        applications: [],
        paginationComplete: true,
        nextPageUrl: null,
      });

      const handler = handlers.get('get-applications')!;
      await handler({ jobId: '10' });
      expect(mockedClient.bambooGet).toHaveBeenCalledWith(
        '/applicant_tracking/applications',
        expect.objectContaining({ jobId: 10 })
      );
    });
  });

  describe('get-application-details', () => {
    it('returns detailed application info', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({
        id: 101,
        appliedDate: '2024-01-15T10:30:00Z',
        status: { id: 1, label: 'New' },
        rating: 5,
        applicant: {
          id: 501,
          firstName: 'Bob',
          lastName: 'Smith',
          email: 'bob@test.com',
          phoneNumber: '555-1234',
          avatar: null,
          source: 'Referral',
          twitterUsername: null,
          address: null,
          linkedinUrl: 'https://linkedin.com/in/bobsmith',
          websiteUrl: 'https://bobsmith.dev',
          availableStartDate: '2024-02-01',
          education: { institution: 'MIT', level: { id: 1, label: 'Bachelor' } },
        },
        job: {
          id: 10,
          title: { id: 1, label: 'Software Engineer' },
          hiringLead: { employeeId: 100, firstName: 'Jane', lastName: 'Doe', avatar: null, jobTitle: null },
        },
        questionsAndAnswers: [],
        attachments: [],
        resumeFileId: null,
        coverLetterFileId: null,
        attachmentCount: 0,
        alsoConsideredForCount: 0,
        duplicateApplicationCount: 0,
        referredBy: null,
        desiredSalary: '$100,000',
        commentCount: 2,
        emailCount: 5,
        eventCount: 3,
        applicationReferences: null,
      });

      const handler = handlers.get('get-application-details')!;
      const result = await handler({ applicationId: '101' });
      expect(result.content[0].text).toContain('Bob Smith');
      expect(result.content[0].text).toContain('Software Engineer');
      expect(result.content[0].text).toContain('$100,000');
      expect(result.isError).toBeUndefined();
    });
  });

  describe('update-application-status', () => {
    it('updates status successfully', async () => {
      mockedClient.bambooPost.mockResolvedValueOnce({ type: 'positionApplicantStatus', id: 200 });

      const handler = handlers.get('update-application-status')!;
      const result = await handler({ applicationId: '101', statusId: '5' });
      expect(result.content[0].text).toContain('Successfully updated');
      expect(mockedClient.bambooPost).toHaveBeenCalledWith(
        '/applicant_tracking/applications/101/status',
        { status: 5 }
      );
    });
  });

  describe('get-jobs', () => {
    it('returns job list with counts', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce([
        {
          id: 10,
          title: { id: 1, label: 'Software Engineer' },
          postedDate: '2024-01-01T00:00:00Z',
          location: { id: 1, label: 'New York', address: {} },
          department: { id: 1, label: 'Engineering' },
          status: { id: 2, label: 'Open' },
          hiringLead: { employeeId: 100, firstName: 'Jane', lastName: 'Doe', avatar: null, jobTitle: null },
          newApplicantsCount: 5,
          activeApplicantsCount: 12,
          totalApplicantsCount: 20,
          postingUrl: 'https://company.bamboohr.com/careers/10',
        },
      ]);

      const handler = handlers.get('get-jobs')!;
      const result = await handler({});
      expect(result.content[0].text).toContain('Software Engineer');
      expect(result.content[0].text).toContain('20 total');
      expect(result.content[0].text).toContain('5 new');
    });
  });

  describe('get-applicant-statuses', () => {
    it('returns status list with IDs', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce([
        { id: '1', code: 'NEW', name: 'New', translatedName: 'New', description: null, enabled: true, manageable: false },
        { id: '5', code: 'REJECTED', name: 'Rejected', translatedName: 'Rejected', description: 'Not suitable location', enabled: true, manageable: true },
        { id: '10', code: null, name: 'Interview', translatedName: 'Interview', description: null, enabled: true, manageable: true },
      ]);

      const handler = handlers.get('get-applicant-statuses')!;
      const result = await handler({});
      expect(result.content[0].text).toContain('**New** (ID: 1)');
      expect(result.content[0].text).toContain('**Rejected** (ID: 5)');
      expect(result.content[0].text).toContain('[REJECTED]');
      expect(result.content[0].text).toContain('**Interview** (ID: 10)');
      expect(result.content[0].text).toContain('Not suitable location');
    });
  });

  describe('add-application-comment', () => {
    it('adds comment successfully', async () => {
      mockedClient.bambooPost.mockResolvedValueOnce({ type: 'comment', id: 300 });

      const handler = handlers.get('add-application-comment')!;
      const result = await handler({ applicationId: '101', comment: 'Wrong location - US based' });
      expect(result.content[0].text).toContain('Successfully added comment');
      expect(mockedClient.bambooPost).toHaveBeenCalledWith(
        '/applicant_tracking/applications/101/comments',
        { comment: 'Wrong location - US based', type: 'comment' }
      );
    });

    it('supports custom comment types', async () => {
      mockedClient.bambooPost.mockResolvedValueOnce({ type: 'note', id: 301 });

      const handler = handlers.get('add-application-comment')!;
      const result = await handler({ applicationId: '102', comment: 'Phone screen notes', type: 'note' });
      expect(result.content[0].text).toContain('Successfully added comment');
      expect(mockedClient.bambooPost).toHaveBeenCalledWith(
        '/applicant_tracking/applications/102/comments',
        { comment: 'Phone screen notes', type: 'note' }
      );
    });
  });

  describe('get-application-comments', () => {
    it('returns only comment timeline entries from BambooHR topLevel response', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce([
        {
          topLevel: {
            type: {
              type: 'comment',
              id: 11053,
              authorUser: { id: 2385, preferredName: 'Eugene Aseev' },
              createdDatetime: '2026-06-23T06:20:28+00:00',
            },
            comment: 'Strong technical fit.',
            ymdt: '2026-06-23T06:20:28+00:00',
          },
        },
        {
          topLevel: {
            type: {
              type: 'status',
              id: 86741,
              user: { id: 2753, preferredName: 'Ilias Farkhutdinov' },
              ymdt: '2026-06-18T15:41:26+00:00',
            },
            author: '<span data-comment-employee-name="Ilias Farkhutdinov">Ilias</span>',
            ymdt: '2026-06-18T15:41:26+00:00',
          },
        },
        {
          topLevel: {
            type: {
              type: 'comment',
              id: 11022,
              authorUser: { id: 2750, preferredName: 'Tanya Chenushkina' },
              createdDatetime: '2026-06-15T11:25:42+00:00',
            },
            comment: 'Move to technical interview.',
            ymdt: '2026-06-15T11:25:42+00:00',
          },
        },
      ]);

      const handler = handlers.get('get-application-comments')!;
      const result = await handler({ applicationId: '41021' });

      expect(result.content[0].text).toContain('Comments for application 41021 (2)');
      expect(result.content[0].text).toContain('**[comment #11053]** Eugene Aseev - 2026-06-23T06:20:28.000Z');
      expect(result.content[0].text).toContain('Strong technical fit.');
      expect(result.content[0].text).toContain('Tanya Chenushkina');
      expect(result.content[0].text).not.toContain('86741');
      expect(result.content[0].text).not.toContain('DEBUG raw response');
    });

    it('supports flat comment responses', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce([
        {
          id: 300,
          type: 'comment',
          author: { firstName: 'Jane', lastName: 'Doe' },
          createdAt: '2026-06-01T00:00:00Z',
          body: 'Flat response comment.',
        },
      ]);

      const handler = handlers.get('get-application-comments')!;
      const result = await handler({ applicationId: '101' });

      expect(result.content[0].text).toContain('**[comment #300]** Jane Doe - 2026-06-01T00:00:00.000Z');
      expect(result.content[0].text).toContain('Flat response comment.');
    });

    it('handles unexpected non-array comment responses as empty', async () => {
      mockedClient.bambooGet.mockResolvedValueOnce({ comments: [] });

      const handler = handlers.get('get-application-comments')!;
      const result = await handler({ applicationId: '101' });

      expect(result.content[0].text).toContain('No comments found');
      expect(result.isError).toBeUndefined();
    });
  });

  describe('get-attachment-url', () => {
    beforeEach(() => {
      mockedClient.resolveBambooFileUrl.mockImplementation((path: string) => {
        if (path.startsWith('http')) return path;
        return `https://api.bamboohr.com/api/gateway.php/testcompany/v1${path}`;
      });
    });

    it('returns URL for fileUrl input', async () => {
      const handler = handlers.get('get-attachment-url')!;
      const result = await handler({ fileUrl: 'https://company.bamboohr.com/attachments/123' });
      expect(result.content[0].text).toContain('https://company.bamboohr.com/attachments/123');
      expect(result.content[0].text).toContain('curl');
      expect(mockedClient.resolveBambooFileUrl).toHaveBeenCalledWith('https://company.bamboohr.com/attachments/123');
    });

    it('constructs URL from resumeFileId', async () => {
      const handler = handlers.get('get-attachment-url')!;
      const result = await handler({ resumeFileId: '456' });
      expect(result.content[0].text).toContain('/files/456');
      expect(result.content[0].text).toContain('curl');
      expect(result.content[0].text).toContain('-o resume.pdf');
      expect(mockedClient.resolveBambooFileUrl).toHaveBeenCalledWith('/files/456');
    });

    it('uses cover letter filename for coverLetterFileId', async () => {
      const handler = handlers.get('get-attachment-url')!;
      const result = await handler({ coverLetterFileId: '789' });
      expect(result.content[0].text).toContain('/files/789');
      expect(result.content[0].text).toContain('-o cover_letter.pdf');
      expect(mockedClient.resolveBambooFileUrl).toHaveBeenCalledWith('/files/789');
    });

    it('returns error when no input provided', async () => {
      const handler = handlers.get('get-attachment-url')!;
      const result = await handler({});
      expect(result.isError).toBe(true);
    });

    it('returns validation errors from invalid attachment URLs', async () => {
      mockedClient.resolveBambooFileUrl.mockImplementationOnce(() => {
        throw new Error('Invalid URL: hostname evil.example is not allowed');
      });

      const handler = handlers.get('get-attachment-url')!;
      const result = await handler({ fileUrl: 'https://evil.example/attachments/123' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid URL');
    });
  });

});
