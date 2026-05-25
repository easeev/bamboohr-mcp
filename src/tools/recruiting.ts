import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { bambooGet, bambooPost, bambooDownloadFile } from '../bambooClient.js';
import { formatErrorForUser } from '../errors.js';
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
  output += `- **ID:** ${app.id}\n`;
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

  if (app.attachments && app.attachments.length > 0) {
    output += `\n## Attachments\n`;
    for (const att of app.attachments) {
      output += `- ${att.name} (ID: ${att.id})\n`;
      output += `  URL: ${att.fileUrl}\n`;
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
    'download-attachment',
    'Download a CV/resume or cover letter attachment from an application. Use get-application-details first to get the fileUrl.',
    {
      fileUrl: z.string().describe('The fileUrl from application attachments (e.g., https://company.bamboohr.com/... or relative path)'),
    },
    async ({ fileUrl }: { fileUrl: string }) => {
      try {
        const download = await bambooDownloadFile(fileUrl);

        // Convert ArrayBuffer to base64 for text output
        const base64 = Buffer.from(download.data).toString('base64');
        const sizeKB = Math.round(download.data.byteLength / 1024);

        // For text-based files, try to extract text
        let textContent = '';
        if (download.contentType.includes('text/') || download.contentType.includes('application/pdf')) {
          // Note: PDF text extraction would need a separate library
          textContent = '\n[File content available as base64 below. PDF parsing requires additional processing.]\n';
        }

        return result(
          `Downloaded: ${download.filename}\n` +
          `Size: ${sizeKB} KB\n` +
          `Type: ${download.contentType}\n` +
          `${textContent}\n` +
          `Base64 (truncated to first 2000 chars):\n${base64.slice(0, 2000)}...\n\n` +
          `Full base64 length: ${base64.length} characters`
        );
      } catch (error) {
        return result(formatErrorForUser(error), true);
      }
    }
  );

}
