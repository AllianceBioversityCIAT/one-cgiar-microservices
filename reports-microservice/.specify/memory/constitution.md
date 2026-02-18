<!--
Sync Impact Report
==================
Version change: (none) → 1.0.0
Modified principles: N/A (initial creation)
Added sections: Full constitution from template; validated against package.json and src/domain
Removed sections: None
Templates:
  - .specify/templates/plan-template.md ✅ (Constitution Check gate references constitution file)
  - .specify/templates/spec-template.md ✅ (scope/requirements alignment unchanged)
  - .specify/templates/tasks-template.md ✅ (task categorization compatible)
  - .specify/templates/commands/*.md ⚠ N/A (no commands directory)
Follow-up TODOs: None
-->

# Reports Microservice Constitution

## Purpose

This constitution defines the foundational principles, constraints, and governance for the **Reports Microservice** within the One CGIAR microservices ecosystem. The service is responsible for generating and managing PDF reports using RabbitMQ for messaging, AWS S3 for storage, CLARISA for authentication, and Slack for operational notifications.

---

## Core Principles

### I. Single Responsibility

The microservice has one primary responsibility: **generate PDFs from HTML templates and store them**. All features (templates, S3 upload, notifications, queue consumption) must directly support this goal. New capabilities that dilute this focus (e.g., generic file conversion, unrelated reporting) require explicit justification and alignment with this constitution.

### II. Contract-First API

All external interfaces are defined by **DTOs and Swagger**. Request/response shapes are documented and versioned. Changes to `CreatePdfDto`, queue message payloads, or HTTP endpoints are breaking changes and must follow the versioning and migration rules defined in Governance.

### III. Observability and Traceability

- **Logging**: All PDF generation requests and responses are logged. Use the existing `LoggingInterceptor` and service-level `Logger`; no silent failures.
- **Notifications**: Successful and failed PDF generation must be reported via Slack where configured. The `NotificationsService` is the single channel for operational alerts.
- **Errors**: Exceptions flow through `GlobalExceptions`; responses use `ServerResponseDto` for consistent structure. Stack traces are logged; user-facing messages must not expose internals.

### IV. Authentication and Authorization

- All PDF generation endpoints are protected by **JWT middleware** backed by CLARISA. The `auth` header (JSON with `username` and `password`) is required for protected routes.
- Authorization is determined by CLARISA_MIS; the microservice does not define its own user store. New routes that handle sensitive data must go through the same guard/middleware chain.

### V. Async-First Design

- **Primary entry**: PDF generation is consumed via **RabbitMQ** (queue name: `{QUEUE_NAME}reports_queue`). The HTTP endpoint is secondary; queue contract is the source of truth for async clients.
- **Durability**: Queues are declared with `durable: true`. No fire-and-forget semantics for report generation; failures must be visible (logs + Slack).

### VI. External Dependencies as Contracts

- **AWS S3**: PDFs are stored with explicit `bucketName` and `fileName`; no default bucket for production. Credentials and region come from configuration only.
- **CLARISA**: Used for authentication only. No business logic must depend on CLARISA data beyond auth outcome.
- **Slack**: Optional; absence of webhook must not break PDF generation. Notifications are best-effort.

---

## Technical Constraints

- **Runtime**: Node.js (recommended 14.x+). NestJS 10.x.
- **PDF generation**: `pdf-creator-node` (and underlying tooling) is the standard. Template engine: Handlebars. No ad-hoc HTML generation without templates.
- **Configuration**: All secrets and environment-specific values (RabbitMQ URL, AWS keys, CLARISA_*, SLACK_WEBHOOK_URL, QUEUE_NAME) come from environment variables or `ConfigService`. No hardcoded credentials or environment-specific logic in code.
- **API documentation**: Swagger is exposed at `/api` and must be kept in sync with DTOs and controllers.

---

## Development and Quality

- **Structure**: Domain logic lives under `src/domain` (api, notifications, routes, shared, tools, utils). New features follow the same layering (controller → service → DTOs; shared guards/interceptors/errors).
- **Testing**: Jest is configured; coverage thresholds exist. New features should include unit tests for services and, where applicable, tests for guards and interceptors. E2E tests for critical PDF generation paths are encouraged.
- **Linting and format**: ESLint and Prettier are used; run `npm run lint` and `npm run format` before committing. No disabling of rules without documented justification.

---

## Governance

- This constitution supersedes ad-hoc practices for this repository. When in doubt, principles and constraints here take precedence.
- **Amendments**: Changes to this document must be versioned and dated. Rationale and impact (e.g., breaking changes to clients) must be documented.
- **Compliance**: Code reviews should verify that new code adheres to Single Responsibility, Contract-First API, Observability, Auth, Async-First design, and Technical Constraints. Complexity (new dependencies, new queues, new external systems) must be justified.
- **Guidance**: For day-to-day development and AI-assisted work, refer to this constitution and the project README for scope, structure, and integration points.

**Version**: 1.0.0 | **Ratified**: 2025-02-13 | **Last Amended**: 2025-02-13
