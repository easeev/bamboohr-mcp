# cl-bamboohr-mcp

A comprehensive BambooHR MCP (Model Context Protocol) server providing read/write access to employee data, time-off, files, analytics, and reports.

## Features

- **21 tools** covering the full BambooHR API surface
- Read **and** write operations (employee updates, time-off requests)
- Built-in caching, retry with exponential backoff, and error categorization
- Security hardening: input validation, credential sanitization, field allowlists
- TypeScript with 100+ tests

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bamboohr": {
      "command": "node",
      "args": ["/path/to/cl-bamboohr-mcp/dist/index.js"],
      "env": {
        "BAMBOO_API_TOKEN": "your-api-key",
        "BAMBOO_COMPANY_DOMAIN": "your-company"
      }
    }
  }
}
```

### From Source

```bash
git clone https://github.com/iseletsk/cl-bamboohr-mcp.git
cd cl-bamboohr-mcp
npm install
npm run build
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BAMBOO_API_TOKEN` | Yes | — | BambooHR API key |
| `BAMBOO_COMPANY_DOMAIN` | Yes | — | Company subdomain |
| `DEBUG` | No | `false` | Enable debug logging |
| `BAMBOO_CACHE_TTL_MS` | No | `300000` | Cache TTL in ms (5 min) |
| `BAMBOO_MAX_RETRIES` | No | `3` | Max retry attempts |
| `BAMBOO_REQUEST_TIMEOUT_MS` | No | `30000` | Request timeout in ms |
| `BAMBOO_UPDATE_ALLOWED_FIELDS` | No | — | Comma-separated allowlist for update-employee |

## Tools

### Employee Management (6)
- **get-employee** — Get employee details by ID
- **find-employee** — Search directory by name/email/department
- **update-employee** — Update employee fields (WRITE)
- **get-employee-directory** — Full company directory
- **get-employee-photo** — Employee photo URL
- **get-employee-goals** — Performance goals

### Time Off (4)
- **get-whos-out** — Who's currently out
- **get-time-off-requests** — Filter requests by date/status
- **estimate-time-off-balance** — Future balance estimate
- **create-time-off-request** — Create a request (WRITE)

### Files (3)
- **list-company-files** — Company files by category
- **get-company-file** — File metadata
- **get-employee-files** — Employee files by category

### Organization (3)
- **get-meta-fields** — Field metadata (filterable by type)
- **get-departments** — All departments
- **get-team-info** — Team members by supervisor/department

### Analytics (3)
- **discover-datasets** — Available datasets
- **discover-fields** — Fields in a dataset
- **workforce-analytics** — Query datasets with filters

### Reports (2)
- **list-custom-reports** — Saved reports
- **run-custom-report** — Execute a report

## Security

- All IDs validated (numeric regex for employee/file/report IDs)
- Subdomain validated at startup
- No credential logging — auth stripped from error objects
- Optional field allowlist for write operations
- Dates and enums validated via Zod schemas

## Development

```bash
npm test              # Run tests
npm run test:coverage # Run with coverage
npm run build         # TypeScript compilation
npm run lint          # Type check only
```

## License

MIT
