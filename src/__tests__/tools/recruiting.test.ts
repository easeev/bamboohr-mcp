import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AxiosError, AxiosHeaders } from 'axios';
import * as bambooClient from '../../bambooClient';
import { registerRecruitingTools } from '../../tools/recruiting';

jest.mock('../../bambooClient');

const mockedClient = bambooClient as jest.Mocked<typeof bambooClient>;

function makeAxiosError(status: number): AxiosError {
  const headers = new AxiosHeaders();
  return new AxiosError(
    'test error',
    'ERR_BAD_RESPONSE',
    undefined,
    undefined,
    {
      status,
      statusText: 'Error',
      headers: {},
      config: { headers },
      data: 'error',
    }
  );
}

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
    jest.resetAllMocks();
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
    const privateNotesResponse = {
      meta: { totalCount: 2 },
      result: {
        entities: {
          comments: {
            allIds: [11042, 11043],
            byId: {
              11042: {
                id: 11042,
                text: '<p>Strong technical fit.</p>',
                createdDate: '2026-06-16T12:18:44',
                userId: 2753,
              },
              11043: {
                id: 11043,
                text: 'Move to next step.<br>Good platform background.',
                createdDate: '2026-06-17T12:51:58',
                userId: 2385,
              },
            },
          },
          users: {
            byId: {
              2753: { id: 2753, name: 'Ilias Farkhutdinov' },
              2385: { id: 2385, name: 'Eugene Aseev' },
            },
          },
        },
      },
    };

    it('returns comment bodies from the private hiring notes endpoint', async () => {
      mockedClient.bambooWebGet.mockResolvedValueOnce(privateNotesResponse);

      const handler = handlers.get('get-application-comments')!;
      const result = await handler({ applicationId: '41271' });

      expect(mockedClient.bambooWebGet).toHaveBeenCalledWith(
        '/hiring/api/applications/41271/notes',
        undefined,
        { skipCache: true }
      );
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Comments for application 41271 (2)');
      expect(result.content[0].text).toContain('**[comment #11042]** Ilias Farkhutdinov - 2026-06-16T12:18:44');
      expect(result.content[0].text).toContain('Strong technical fit.');
      expect(result.content[0].text).toContain('Move to next step.\nGood platform background.');
    });

    it('returns no comments when private notes response has no comments', async () => {
      mockedClient.bambooWebGet.mockResolvedValueOnce({
        result: { entities: { comments: { allIds: [], byId: {} }, users: { byId: {} } } },
      });

      const handler = handlers.get('get-application-comments')!;
      const result = await handler({ applicationId: '41271' });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('No comments found for application 41271.');
    });

    it('falls back to comment IDs from byId when allIds is missing', async () => {
      mockedClient.bambooWebGet.mockResolvedValueOnce({
        result: {
          entities: {
            comments: {
              byId: {
                11042: {
                  id: 11042,
                  text: 'Present without allIds.',
                  userId: 2753,
                },
              },
            },
            users: {
              byId: {
                2753: { id: 2753, name: 'Ilias Farkhutdinov' },
              },
            },
          },
        },
      });

      const handler = handlers.get('get-application-comments')!;
      const result = await handler({ applicationId: '41271' });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Comments for application 41271 (1)');
      expect(result.content[0].text).toContain('Present without allIds.');
    });

    it('resolves an explicit applicant ID through the private hiring API', async () => {
      mockedClient.bambooWebGet
        .mockResolvedValueOnce({
          result: [{ id: '41087' }, { id: '41271' }],
        })
        .mockResolvedValueOnce({
          result: { entities: { comments: { allIds: [], byId: {} }, users: { byId: {} } } },
        })
        .mockResolvedValueOnce(privateNotesResponse);

      const handler = handlers.get('get-application-comments')!;
      const result = await handler({ applicantId: '40599' });

      expect(mockedClient.bambooWebGet).toHaveBeenNthCalledWith(
        1,
        '/hiring/api/candidates/40599/applications'
      );
      expect(mockedClient.bambooWebGet).toHaveBeenNthCalledWith(
        2,
        '/hiring/api/applications/41087/notes',
        undefined,
        { skipCache: true }
      );
      expect(mockedClient.bambooWebGet).toHaveBeenNthCalledWith(
        3,
        '/hiring/api/applications/41271/notes',
        undefined,
        { skipCache: true }
      );
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Candidate/applicant 40599 application comments');
      expect(result.content[0].text).toContain('No comments found for application 41087.');
      expect(result.content[0].text).toContain('Comments for application 41271 (2)');
    });

    it('ignores non-numeric application IDs returned by private applicant resolution', async () => {
      mockedClient.bambooWebGet
        .mockResolvedValueOnce({
          result: [{ id: '41087abc' }, { id: '41271' }, { id: null }],
        })
        .mockResolvedValueOnce(privateNotesResponse);

      const handler = handlers.get('get-application-comments')!;
      const result = await handler({ applicantId: '40599' });

      expect(mockedClient.bambooWebGet).toHaveBeenCalledTimes(2);
      expect(mockedClient.bambooWebGet).toHaveBeenNthCalledWith(
        2,
        '/hiring/api/applications/41271/notes',
        undefined,
        { skipCache: true }
      );
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Comments for application 41271 (2)');
    });

    it('does not fall back to public API if private notes endpoint fails', async () => {
      mockedClient.bambooWebGet.mockRejectedValueOnce(makeAxiosError(404));

      const handler = handlers.get('get-application-comments')!;
      const result = await handler({ applicationId: '41271' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Application 41271 was not found');
      expect(result.content[0].text).toContain('/hiring/candidates/{id} URLs commonly contain application IDs');
      expect(mockedClient.bambooGet).not.toHaveBeenCalled();
    });

    it('does not fall back to public applicant scan when private candidate applications endpoint fails', async () => {
      mockedClient.bambooWebGet.mockRejectedValueOnce(makeAxiosError(404));

      const handler = handlers.get('get-application-comments')!;
      const result = await handler({ applicantId: '40599' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No applications found for applicant/candidate 40599');
      expect(mockedClient.bambooGet).not.toHaveBeenCalled();
    });

    it('does not hide non-404 private applicant resolution errors behind public scan', async () => {
      mockedClient.bambooWebGet.mockRejectedValueOnce(makeAxiosError(500));

      const handler = handlers.get('get-application-comments')!;
      const result = await handler({ applicantId: '40599' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('API_ERROR');
      expect(mockedClient.bambooGet).not.toHaveBeenCalled();
    });

    it('returns the private notes error when applicant comment fetch fails', async () => {
      mockedClient.bambooWebGet
        .mockResolvedValueOnce({ result: [{ id: '41271' }] })
        .mockRejectedValueOnce(makeAxiosError(500));

      const handler = handlers.get('get-application-comments')!;
      const result = await handler({ applicantId: '40599' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('API_ERROR');
      expect(mockedClient.bambooGet).not.toHaveBeenCalled();
    });

    it('preserves fetched comments when a later resolved application returns not found', async () => {
      mockedClient.bambooWebGet
        .mockResolvedValueOnce({ result: [{ id: '41087' }, { id: '41271' }] })
        .mockResolvedValueOnce(privateNotesResponse)
        .mockRejectedValueOnce(makeAxiosError(404));

      const handler = handlers.get('get-application-comments')!;
      const result = await handler({ applicantId: '40599' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Comments for application 41087 (2)');
      expect(result.content[0].text).toContain('Application 41271 was not found');
      expect(result.content[0].text).not.toContain('No applications found for applicant/candidate 40599');
      expect(mockedClient.bambooGet).not.toHaveBeenCalled();
    });

    it('requires exactly one application or applicant ID', async () => {
      const handler = handlers.get('get-application-comments')!;

      const missing = await handler({});
      expect(missing.isError).toBe(true);
      expect(missing.content[0].text).toContain('Provide applicationId or applicantId');

      const both = await handler({ applicationId: '41271', applicantId: '40599' });
      expect(both.isError).toBe(true);
      expect(both.content[0].text).toContain('Provide either applicationId or applicantId');
    });

    it('returns applicant-specific guidance when applicant resolution finds no applications', async () => {
      mockedClient.bambooWebGet.mockResolvedValueOnce({ result: [] });

      const handler = handlers.get('get-application-comments')!;
      const result = await handler({ applicantId: '40599' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No applications found for applicant/candidate 40599');
      expect(result.content[0].text).toContain('pass that value as applicationId');
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
