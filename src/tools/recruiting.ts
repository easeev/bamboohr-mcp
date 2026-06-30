import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { bambooGet, bambooPost, bambooWebGet, resolveBambooFileUrl } from '../bambooClient.js';
import { categorizeError, ErrorCategory, formatErrorForUser } from '../errors.js';
import {
  Application,
  ApplicationDetails,
  JobSummary,
  ApplicantStatus,
} from '../types.js';

function result(text: string, isError?: boolean) {
  return { content: [{ type: 'text' as const, text }], ...(isError ? { isError } : {}) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reg(server: McpServer, name: string, description: string, params: any, handler: any) {
  server.tool(name, description, params, handler);
}

type UnknownRecord = Record<string, unknown>;

interface PrivateHiringNotesResponse {
  meta?: { totalCount?: number };
  result?: {
    entities?: {
      comments?: {
        allIds?: Array<number | string>;
        byId?: Record<string, PrivateHiringComment>;
      };
      users?: {
        byId?: Record<string, PrivateHiringUser>;
      };
    };
  };
}

interface PrivateHiringComment {
  id?: number | string;
  text?: string;
  createdDate?: string;
  userId?: number | string;
  author?: number | string;
}

interface PrivateHiringUser {
  id?: number | string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

interface PrivateCandidateApplicationsResponse {
  result?: Array<{ id?: number | string }>;
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function userDisplayName(value: unknown): string | undefined {
  const user = asRecord(value);
  if (!user) return undefined;

  const fullName = asString(user.name) || asString(user.displayName) || asString(user.preferredName);
  if (fullName) return fullName;

  const firstName = asString(user.firstName);
  const lastName = asString(user.lastName);
  return [firstName, lastName].filter(Boolean).join(' ') || undefined;
}

function applicationNotFoundMessage(id: number): string {
  return `Error [NOT_FOUND]: Application ${id} was not found.\n\n` +
    `Troubleshooting: get-application-comments uses BambooHR's hiring notes endpoint for comment bodies. BambooHR /hiring/candidates/{id} URLs commonly contain application IDs; pass that URL value as applicationId. Use applicantId only when you already have the applicant/candidate ID from application details/list results.`;
}

function applicantApplicationsNotFoundMessage(applicantId: number): string {
  return `Error [NOT_FOUND]: No applications found for applicant/candidate ${applicantId}.\n\n` +
    `Troubleshooting: BambooHR's private hiring applications endpoint did not return applications for applicant/candidate ${applicantId}. If you copied a BambooHR /hiring/candidates/{id} URL, pass that value as applicationId because BambooHR commonly uses application IDs in that URL.`;
}

function isNotFoundError(error: unknown): boolean {
  return categorizeError(error).category === ErrorCategory.NOT_FOUND;
}

async function resolveApplicationIdsFromCandidateId(candidateId: number): Promise<number[]> {
  const response = await bambooWebGet<PrivateCandidateApplicationsResponse>(
    `/hiring/api/candidates/${candidateId}/applications`
  );
  return (Array.isArray(response.result) ? response.result : [])
    .map((application) => String(application.id ?? '').trim())
    .filter((id) => /^\d+$/.test(id))
    .map((id) => parseInt(id, 10));
}

async function getPrivateApplicationComments(applicationId: number): Promise<PrivateHiringNotesResponse> {
  return bambooWebGet<PrivateHiringNotesResponse>(
    `/hiring/api/applications/${applicationId}/notes`,
    undefined,
    { skipCache: true }
  );
}

function formatPrivateApplicationComments(notes: PrivateHiringNotesResponse, applicationId: number): string {
  const comments = notes.result?.entities?.comments;
  const users = notes.result?.entities?.users?.byId || {};
  const byId = comments?.byId || {};
  const ids = Array.isArray(comments?.allIds) ? comments.allIds : Object.keys(byId);

  const output = ids
    .map((id) => {
      const comment = byId[String(id)];
      if (!comment || !asString(comment.text)) return null;

      const userId = String(comment.userId ?? comment.author ?? '');
      const author = userDisplayName(users[userId]) || 'Unknown';
      const commentId = comment.id ?? id;
      const date = asString(comment.createdDate);
      const dateSuffix = date ? ` - ${date}` : '';
      return `**[comment #${commentId}]** ${author}${dateSuffix}\n${stripHtml(comment.text!)}`;
    })
    .filter((entry): entry is string => Boolean(entry));

  if (output.length === 0) {
    return `No comments found for application ${applicationId}.`;
  }

  return `Comments for application ${applicationId} (${output.length}):\n\n${output.join('\n\n')}`;
}

function formatApplication(app: Application): string {
  const applicant = app.applicant;
  const job = app.job;
  let output = `**${applicant.firstName} ${applicant.lastName}** (ID: ${app.id})`;
  if (app.rating) output += ` - Rating: ${'★'.repeat(app.rating)}${'☆'.repeat(5 - app.rating)}`;
  output += `\n  Job: ${job.title?.label || 'Unknown'}`;
  output += `\n  Status: ${app.status?.label || 'Unknown'}`;
  output += `\n  Email: ${applicant.email}`;
  if (applicant.source) output += `\n  Source: ${applicant.source}`;
  output += `\n  Applied: ${new Date(app.appliedDate).toLocaleDateString()}`;
  return output;
}

function formatApplicationList(apps: Application[]): string {
  return apps.map(formatApplication).join('\n\n');
}

function formatJobSummary(job: JobSummary): string {
  let output = `**${job.title?.label || 'Untitled'}** (ID: ${job.id})`;
  output += `\n  Status: ${job.status?.label || 'Unknown'}`;
  if (job.location?.label) output += `\n  Location: ${job.location.label}`;
  if (job.department?.label) output += `\n  Department: ${job.department.label}`;
  if (job.hiringLead) output += `\n  Hiring Lead: ${job.hiringLead.firstName} ${job.hiringLead.lastName}`;
  output += `\n  Applicants: ${job.totalApplicantsCount} total (${job.newApplicantsCount} new, ${job.activeApplicantsCount} active)`;
  if (job.postingUrl) output += `\n  Posting URL: ${job.postingUrl}`;
  return output;
}

function formatApplicationDetails(details: ApplicationDetails): string {
  const app = details;
  const applicant = app.applicant;
  const job = app.job;

  let output = `# Application for ${applicant.firstName} ${applicant.lastName}\n\n`;

  output += `## Basic Info\n`;
  output += `- **Application ID:** ${app.id}\n`;
  output += `- **Applicant ID:** ${applicant.id}\n`;
  output += `- **Applied:** ${new Date(app.appliedDate).toLocaleDateString()}\n`;
  output += `- **Status:** ${app.status?.label || 'Unknown'}\n`;
  if (app.rating) output += `- **Rating:** ${'★'.repeat(app.rating)}${'☆'.repeat(5 - app.rating)}\n`;
  output += `- **Job:** ${job?.title?.label || 'Unknown'}\n`;
  if (job?.hiringLead) {
    output += `- **Hiring Lead:** ${job.hiringLead.firstName} ${job.hiringLead.lastName}\n`;
  }

  output += `\n## Contact\n`;
  output += `- **Email:** ${applicant.email}\n`;
  if (applicant.phoneNumber) output += `- **Phone:** ${applicant.phoneNumber}\n`;
  if (applicant.linkedinUrl) output += `- **LinkedIn:** ${applicant.linkedinUrl}\n`;
  if (applicant.websiteUrl) output += `- **Website:** ${applicant.websiteUrl}\n`;
  if (applicant.twitterUsername) output += `- **Twitter:** @${applicant.twitterUsername}\n`;

  if (applicant.address && (applicant.address.city || applicant.address.state)) {
    output += `\n## Location\n`;
    const addr = applicant.address;
    const parts = [addr.addressLine1, addr.city, addr.state, addr.zipcode, addr.country].filter(Boolean);
    if (parts.length > 0) output += parts.join(', ') + '\n';
  }

  if (applicant.education?.institution || applicant.education?.level?.label) {
    output += `\n## Education\n`;
    if (applicant.education.level?.label) output += `- **Level:** ${applicant.education.level.label}\n`;
    if (applicant.education.institution) output += `- **Institution:** ${applicant.education.institution}\n`;
  }

  if (app.desiredSalary) {
    output += `\n## Compensation\n`;
    output += `- **Desired Salary:** ${app.desiredSalary}\n`;
  }

  if (app.questionsAndAnswers && app.questionsAndAnswers.length > 0) {
    output += `\n## Questions & Answers\n`;
    for (const qa of app.questionsAndAnswers) {
      output += `- **Q:** ${qa.question.label}\n`;
      output += `  **A:** ${qa.answer?.label || 'N/A'}\n`;
    }
  }

  output += `\n## Attachments\n`;
  output += `- **Resume File ID:** ${app.resumeFileId ?? 'none'}\n`;
  output += `- **Cover Letter File ID:** ${app.coverLetterFileId ?? 'none'}\n`;
  output += `- **Attachment Count:** ${app.attachmentCount ?? 0}\n`;
  if (app.attachments && app.attachments.length > 0) {
    for (const att of app.attachments) {
      output += `- ${att.name} (ID: ${att.id})\n`;
      output += `  URL: ${att.fileUrl}\n`;
    }
  } else {
    output += `- No attachments[] returned by API\n`;
    if (app.resumeFileId) {
      output += `  → Use get-attachment-url with resumeFileId: ${app.resumeFileId}\n`;
    }
  }

  output += `\n## Stats\n`;
  output += `- Comments: ${app.commentCount}\n`;
  output += `- Emails: ${app.emailCount}\n`;
  output += `- Events: ${app.eventCount}\n`;
  if (app.alsoConsideredForCount > 0) output += `- Also considered for: ${app.alsoConsideredForCount} other jobs\n`;
  if (app.duplicateApplicationCount > 0) output += `- Duplicate applications: ${app.duplicateApplicationCount}\n`;

  return output;
}

export function registerRecruitingTools(server: McpServer): void {
  reg(server,
    'get-applications',
    'List job applications with filtering. Filter by jobId, status, search string, or date range.',
    {
      jobId: z.string().regex(/^\d+$/, 'Job ID must be numeric').optional().describe('Filter by specific job opening ID'),
      applicationStatusId: z.string().optional().describe('Filter by status ID(s), comma-separated (e.g., "1,2,3")'),
      applicationStatus: z.string().optional().describe('Filter by status group: ALL, ALL_ACTIVE, NEW, ACTIVE, INACTIVE, HIRED'),
      jobStatusGroups: z.string().optional().describe('Filter job status: ALL, DRAFT_AND_OPEN, Open, Filled, Draft, Deleted, On Hold, Canceled'),
      searchString: z.string().optional().describe('Search by applicant name or other criteria'),
      sortBy: z.string().optional().describe('Sort by: first_name, job_title, rating, phone, status, last_updated, created_date'),
      sortOrder: z.string().optional().describe('Sort order: ASC or DESC'),
      newSince: z.string().optional().describe('Only applications after this UTC timestamp (format: Y-m-d H:i:s)'),
      page: z.string().regex(/^\d+$/, 'Page must be numeric').optional().describe('Page number for pagination (default: 1)'),
    },
    async ({ jobId, applicationStatusId, applicationStatus, jobStatusGroups, searchString, sortBy, sortOrder, newSince, page }: {
      jobId?: string;
      applicationStatusId?: string;
      applicationStatus?: string;
      jobStatusGroups?: string;
      searchString?: string;
      sortBy?: string;
      sortOrder?: string;
      newSince?: string;
      page?: string;
    }) => {
      try {
        const params: Record<string, unknown> = {};
        if (jobId) params.jobId = parseInt(jobId, 10);
        if (applicationStatusId) params.applicationStatusId = applicationStatusId;
        if (applicationStatus) params.applicationStatus = applicationStatus;
        if (jobStatusGroups) params.jobStatusGroups = jobStatusGroups;
        if (searchString) params.searchString = searchString;
        if (sortBy) params.sortBy = sortBy;
        if (sortOrder) params.sortOrder = sortOrder;
        if (newSince) params.newSince = newSince;
        if (page) params.page = parseInt(page, 10);

        const response = await bambooGet<{ applications: Application[]; paginationComplete: boolean; nextPageUrl: string | null }>(
          '/applicant_tracking/applications',
          params
        );

        if (!response.applications || response.applications.length === 0) {
          return result('No applications found matching the criteria.');
        }

        const apps = response.applications;
        const moreInfo = response.paginationComplete ? '' : '\n\n*More results available. Use page parameter to see additional results.*';

        return result(`Found ${apps.length} application(s):\n\n${formatApplicationList(apps)}${moreInfo}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'get-application-details',
    'Get full details for a specific job application including questions, answers, attachments, and status history',
    {
      applicationId: z.string().regex(/^\d+$/, 'Application ID must be numeric').describe('The application ID (numeric)'),
    },
    async ({ applicationId }: { applicationId: string }) => {
      try {
        const id = parseInt(applicationId, 10);
        const details = await bambooGet<ApplicationDetails>(`/applicant_tracking/applications/${id}`);
        return result(formatApplicationDetails(details));
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'update-application-status',
    'Change the status of a job application (e.g., move to Interview, Rejected, Hired). Get valid status IDs from get-applicant-statuses.',
    {
      applicationId: z.string().regex(/^\d+$/, 'Application ID must be numeric').describe('The application ID (numeric)'),
      statusId: z.string().regex(/^\d+$/, 'Status ID must be numeric').describe('The new status ID (numeric). Use get-applicant-statuses to see valid IDs.'),
    },
    async ({ applicationId, statusId }: { applicationId: string; statusId: string }) => {
      try {
        const id = parseInt(applicationId, 10);
        const status = parseInt(statusId, 10);
        const response = await bambooPost<{ type: string; id: number }>(
          `/applicant_tracking/applications/${id}/status`,
          { status }
        );
        return result(`Successfully updated application ${id} to status ${status}. Status change record ID: ${response.id}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'add-application-comment',
    'Add a comment to a job application for documentation (e.g., screening notes, rejection reasons).',
    {
      applicationId: z.string().regex(/^\d+$/, 'Application ID must be numeric').describe('The application ID (numeric)'),
      comment: z.string().describe('The comment text'),
      type: z.string().optional().describe('Comment type: comment (default), note, or phone_call'),
    },
    async ({ applicationId, comment, type }: { applicationId: string; comment: string; type?: string }) => {
      try {
        const id = parseInt(applicationId, 10);
        const response = await bambooPost<{ type: string; id: number }>(
          `/applicant_tracking/applications/${id}/comments`,
          { comment, type: type || 'comment' }
        );
        return result(`Successfully added comment to application ${id}. Comment ID: ${response.id}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'get-application-comments',
    'Get existing comments/notes on a BambooHR hiring application. Uses BambooHR hiring web API notes endpoint for comment bodies. Use applicationId for BambooHR application IDs, or applicantId for explicit candidate/applicant IDs.',
    {
      applicationId: z.string().regex(/^\d+$/, 'Application ID must be numeric').optional().describe('The application ID (numeric). BambooHR /hiring/candidates/{id} URLs commonly use application IDs despite the URL label.'),
      applicantId: z.string().regex(/^\d+$/, 'Applicant ID must be numeric').optional().describe('Explicit applicant/candidate ID to resolve to application(s). Use this only for applicant.id values from application details/list results.'),
    },
    async ({ applicationId, applicantId }: { applicationId?: string; applicantId?: string }) => {
      if (!applicationId && !applicantId) {
        return result('Provide applicationId or applicantId.', true);
      }
      if (applicationId && applicantId) {
        return result('Provide either applicationId or applicantId, not both.', true);
      }

      const id = parseInt((applicationId || applicantId)!, 10);
      try {
        if (applicantId) {
          let applicationIds: number[];
          try {
            applicationIds = await resolveApplicationIdsFromCandidateId(id);
          } catch (error) {
            if (isNotFoundError(error)) {
              return result(applicantApplicationsNotFoundMessage(id), true);
            }
            throw error;
          }
          if (applicationIds.length === 0) {
            return result(applicantApplicationsNotFoundMessage(id), true);
          }

          const sections: Array<{ text: string; isError: boolean }> = [];
          for (const resolvedApplicationId of applicationIds) {
            try {
              sections.push({
                text: formatPrivateApplicationComments(
                  await getPrivateApplicationComments(resolvedApplicationId),
                  resolvedApplicationId
                ),
                isError: false,
              });
            } catch (error) {
              if (isNotFoundError(error)) {
                sections.push({
                  text: applicationNotFoundMessage(resolvedApplicationId),
                  isError: true,
                });
                continue;
              }
              throw error;
            }
          }
          return result(
            `Candidate/applicant ${id} application comments:\n\n${sections.map((section) => section.text).join('\n\n---\n\n')}`,
            sections.some((section) => section.isError)
          );
        }

        return result(formatPrivateApplicationComments(await getPrivateApplicationComments(id), id));
      } catch (error) {
        if (isNotFoundError(error)) {
          return result(applicationId ? applicationNotFoundMessage(id) : applicantApplicationsNotFoundMessage(id), true);
        }

        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'get-jobs',
    'List job openings/summaries with applicant counts. Filter by status and sort by various fields.',
    {
      statusGroups: z.string().optional().describe('Filter by status: ALL, DRAFT_AND_OPEN, Open, Filled, Draft, Deleted, On Hold, Canceled'),
      statusIds: z.string().optional().describe('Filter by specific status IDs, comma-separated'),
      sortBy: z.string().optional().describe('Sort by: count, title, lead, created, status'),
      sortOrder: z.string().optional().describe('Sort order: ASC or DESC'),
    },
    async ({ statusGroups, statusIds, sortBy, sortOrder }: {
      statusGroups?: string;
      statusIds?: string;
      sortBy?: string;
      sortOrder?: string;
    }) => {
      try {
        const params: Record<string, unknown> = {};
        if (statusGroups) params.statusGroups = statusGroups;
        if (statusIds) params.status_ids = statusIds;
        if (sortBy) params.sortBy = sortBy;
        if (sortOrder) params.sortOrder = sortOrder;

        const jobs = await bambooGet<JobSummary[]>('/applicant_tracking/jobs', params);

        if (!jobs || jobs.length === 0) {
          return result('No job openings found.');
        }

        return result(`${jobs.length} job opening(s):\n\n${jobs.map(formatJobSummary).join('\n\n')}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'get-applicant-statuses',
    'Get all available applicant statuses with IDs needed for update-application-status',
    {},
    async () => {
      try {
        const statuses = await bambooGet<ApplicantStatus[]>('/applicant_tracking/statuses');
        const output = statuses.map(s => {
          let line = `- **${s.name}** (ID: ${s.id})`;
          if (s.code) line += ` [${s.code}]`;
          if (s.enabled === false) line += ` - Disabled`;
          if (s.description) line += `\n  ${s.description}`;
          return line;
        }).join('\n');
        return result(`Available Applicant Statuses:\n\n${output}`);
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

  reg(server,
    'get-attachment-url',
    'Get the download URL and curl command for a CV/resume or cover letter. Use get-application-details first to get resumeFileId or fileUrl. Consumer downloads the file locally using curl or similar.',
    {
      fileUrl: z.string().optional().describe('The fileUrl from application attachments'),
      resumeFileId: z.string().regex(/^\d+$/, 'Must be numeric').optional().describe('resumeFileId from get-application-details'),
      coverLetterFileId: z.string().regex(/^\d+$/, 'Must be numeric').optional().describe('coverLetterFileId from get-application-details'),
    },
    async ({ fileUrl, resumeFileId, coverLetterFileId }: { fileUrl?: string; resumeFileId?: string; coverLetterFileId?: string }) => {
      try {
        let url: string;
        let label: string;
        if (fileUrl) {
          url = resolveBambooFileUrl(fileUrl);
          label = 'Attachment';
        } else if (resumeFileId) {
          url = resolveBambooFileUrl(`/files/${resumeFileId}`);
          label = 'Resume';
        } else if (coverLetterFileId) {
          url = resolveBambooFileUrl(`/files/${coverLetterFileId}`);
          label = 'Cover Letter';
        } else {
          return result('Provide fileUrl, resumeFileId, or coverLetterFileId.', true);
        }

        const outFile = label === 'Resume'
          ? 'resume.pdf'
          : label === 'Cover Letter'
            ? 'cover_letter.pdf'
            : 'attachment.pdf';
        const curlCmd = `curl -u "$BAMBOO_API_TOKEN:x" -L ${shellQuote(url)} -o ${outFile}`;
        return result(
          `${label} URL: ${url}\n\n` +
          `Download with curl:\n\`\`\`\n${curlCmd}\n\`\`\``
        );
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

}
