# hisaabकिताब

**Review exceptions. Not every invoice.**

hisaabकिताब is an explainable Accounts-Payable exception-management application. Its deterministic Finance engine ingests CSV/XLSX batches, evaluates policy rules, detects exact/probable/fuzzy duplicates, assigns review priority, and preserves human review history.

## Operating modes

- `LOCAL_DEMO` (default): browser Web Worker analysis with IndexedDB persistence. This keeps the existing offline hackathon flow intact.
- `SERVER`: authenticated, tenant-scoped APIs and collaboration screens backed by the server repository boundary. Production server mode deliberately refuses volatile in-memory persistence.

Both modes reuse the same normalization, rules, duplicate, decision, and summary modules. Server mode does not introduce a second Finance engine.

## Architecture

```text
CSV/XLSX -> ingestion/normalization -> rules -> duplicates -> decisions -> summary
                    | local mode                         | server mode
                    v                                    v
             Web Worker + IndexedDB          API/service/repository + Azure target
```

The server layer is divided into HTTP routes, authorization-aware services, and tenant-scoped repositories. React components do not contain Finance decisions or direct database access. `src/server/database/schema.sql` is the normalized Azure SQL reference schema.

Production target:

- Authentication: Microsoft Entra ID
- Database: Azure SQL
- Source files: Azure Blob Storage
- Jobs: Azure Service Bus and Azure Functions
- Monitoring: Azure Application Insights
- Secrets: environment-managed secrets / Azure Key Vault references

These Azure adapters and contracts are present, but they report `CONFIGURATION_REQUIRED` until an approved SDK/driver and real resources are configured. No cloud operation is faked.

## Local setup

Requirements: Node.js 20+ and npm.

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The default `LOCAL_DEMO` mode needs no external services.

## Server mode and authentication

Set both `APP_MODE=SERVER` and `NEXT_PUBLIC_APP_MODE=SERVER`. For local development only, set `AUTH_PROVIDER=demo`, provide a 32+ character `SESSION_SECRET`, and configure `DEMO_AUTH_USERS_JSON` with scrypt password hashes. Demo credentials are never built into the application.

`AUTH_PROVIDER=entra` is the production integration point and currently requires Entra tenant/application configuration. API authorization derives the organization from the verified session and never accepts a browser-supplied tenant as authority.

Roles:

- `ADMIN`: policy administration, user/team visibility, assignment, review, reporting.
- `FINANCE_MANAGER`: assignment, review, batch/report access.
- `REVIEWER`: reads Finance data and reviews work assigned to them.
- `AUDITOR`: read-only Finance and audit/report access.

Optimistic record versions prevent silent concurrent assignment or review overwrites.

## Server capabilities

- Tenant-isolated exception search, data-layer sorting, filters, URL state, and pagination.
- Saved per-user views, reviewer My Queue, assignment/reassignment, and guarded bulk actions with partial-failure reporting.
- Append-oriented central audit events that preserve machine evidence after human overrides.
- CSV/XLSX filtered exception export, audit CSV export, and XLSX batch reports.
- Batch history, review completion, real-data trends, exception aging, source file/sheet/row traceability, and in-app notifications.
- Draft/active/retired policy versions; each batch retains its original policy version.
- Extension, MIME/content signature, size, random storage name, SHA-256, duplicate-upload awareness, and quarantine state for uploads.

## Environment variables

Use `.env.example` as the complete name-only template. Important groups are:

- Mode/application: `APP_MODE`, `NEXT_PUBLIC_APP_MODE`, `APPLICATION_URL`
- Auth: `AUTH_PROVIDER`, `SESSION_SECRET`, `DEMO_AUTH_USERS_JSON`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
- Data/storage/jobs: `SERVER_REPOSITORY`, `AZURE_SQL_CONNECTION_STRING`, `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER`, `AZURE_SERVICE_BUS_CONNECTION_STRING`, `AZURE_SERVICE_BUS_QUEUE`
- Operations: `APPLICATIONINSIGHTS_CONNECTION_STRING`, backup/versioning flags, `RECOVERY_RUNBOOK_URL`, and retention-day settings

Never commit `.env.local`, credentials, connection strings, or session secrets.

## Database and storage setup

1. Provision Azure SQL and apply `src/server/database/schema.sql` through the deployment migration process.
2. Configure a least-privilege managed identity and the approved parameterized Azure SQL repository adapter.
3. Provision a private Blob container with encryption, versioning, soft delete, lifecycle retention, and malware scanning.
4. Configure Service Bus and the server processing worker/Function.
5. Only then enable `SERVER` in production.

The in-memory server repository and object store are development/test adapters. They are not cross-device or durable and are rejected as production server persistence.

## Upload and processing security

Accepted files are CSV/XLSX up to the configured limit. Uploads begin as `PENDING_SCAN`; only a real scanner may mark them `CLEAN`. Malware scanning is **CONFIGURATION REQUIRED**. Original names are metadata only; storage keys are generated. Source files should be private and served through authorized, short-lived access paths.

Server batch states are `UPLOADING`, `QUEUED`, `PROCESSING`, `COMPLETED`, `COMPLETED_WITH_ERRORS`, and `FAILED`. The local browser worker remains available for demo mode.

## Monitoring, backup, and retention

Structured logs use request/batch/transaction correlation IDs and avoid invoice payload logging. Application Insights export is **CONFIGURATION REQUIRED**. `/api/health` returns a safe aggregate status without secrets or stack traces.

Production recovery uses managed Azure SQL point-in-time restore plus Blob versioning/soft delete. Set the backup flags only after infrastructure validation and publish the `RECOVERY_RUNBOOK_URL`. Test restore procedures periodically; do not add a fake “Backup Now” application control.

Retention periods are configured independently for uploads, transactions, audit events, and exports. Cleanup selection is policy-driven; audit evidence uses the longest default retention and must not be casually hard-deleted.

## Testing

```bash
npm run lint
npm test
npm run build
```

Tests cover the Finance engine, 2,000/10,000-record storage and worker paths, IndexedDB pagination, tenant isolation, RBAC, concurrency, collaboration, search/filter/sort, reports, uploads, jobs, retention, and server infrastructure contracts.

## Deployment

Local/demo mode can deploy as the existing Next.js application. Production server mode additionally requires the configured Entra, Azure SQL, Blob, Service Bus/Functions, malware scanning, monitoring, and managed backup resources. TLS termination, database/storage encryption, secret rotation, private networking, and access policies belong to the deployment platform.

## Known limitations

- Azure SQL, Entra, Blob, Service Bus/Functions, malware scanning, Application Insights, email, and Teams are integration boundaries only until external resources and credentials are supplied.
- The included server repository is process-local and intended only for tests/development; it does not provide multi-instance durability.
- Server-side job execution and infrastructure provisioning are not performed by this repository.
- Exception next/previous navigation uses a bounded query rather than arbitrary-scale cursor navigation.
- The existing local IndexedDB data path is intentionally retained and is not migrated into a production tenant database automatically.
