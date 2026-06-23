#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerEmployeeTools } from './tools/employees.js';
import { registerTimeOffTools } from './tools/timeOff.js';
import { registerFileTools } from './tools/files.js';
import { registerMetaTools } from './tools/meta.js';
import { registerAnalyticsTools } from './tools/analytics.js';
import { registerReportTools } from './tools/reports.js';
import { registerRecruitingTools } from './tools/recruiting.js';

const server = new McpServer({
  name: 'bamboohr-mcp',
  version: '1.0.0',
  description:
    'BambooHR MCP Server — comprehensive read/write access to employee data, time-off, files, analytics, reports, and recruiting',
});

// Register all tool groups (29 tools total)
registerEmployeeTools(server);   // 6: get-employee, find-employee, update-employee, get-employee-directory, get-employee-photo, get-employee-goals
registerTimeOffTools(server);    // 4: get-whos-out, get-time-off-requests, estimate-time-off-balance, create-time-off-request
registerFileTools(server);       // 3: list-company-files, get-company-file, get-employee-files
registerMetaTools(server);       // 3: get-meta-fields, get-departments, get-team-info
registerAnalyticsTools(server);  // 3: discover-datasets, discover-fields, workforce-analytics
registerReportTools(server);     // 2: list-custom-reports, run-custom-report
registerRecruitingTools(server); // 8: get-jobs, get-applications, get-application-details, get-application-comments, update-application-status, add-application-comment, get-applicant-statuses, get-attachment-url

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('bamboohr-mcp server started');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
