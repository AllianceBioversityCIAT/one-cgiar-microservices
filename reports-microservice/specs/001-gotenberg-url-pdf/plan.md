# Implementation Plan: Gotenberg URL-Based PDF Generation

**Branch**: `001-gotenberg-url-pdf` | **Date**: 2025-02-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-gotenberg-url-pdf/spec.md`

## Summary

Add a new PDF generation flow that receives JSON data and a template name, constructs a URL (base URL + template path + query params from data), sends the URL to Gotenberg's Chromium convert/url endpoint, uploads the resulting PDF to S3, and returns the S3 URL. Expose via both HTTP POST and RabbitMQ message pattern, matching the existing Handlebars-based flow. This extends the microservice's PDF generation capability for URL-rendered templates (e.g., hosted at pdf.yecksin.com) while preserving the existing Handlebars flow.

## Technical Context

**Language/Version**: Node.js 14.x+, TypeScript 5.x
**Primary Dependencies**: NestJS 10.x, @nestjs/axios (HTTP client), @aws-sdk/client-s3, Gotenberg (external API)
**Storage**: AWS S3 (existing); no new storage
**Testing**: Jest (unit, E2E per constitution)
**Target Platform**: Linux server (Docker, Lambda-compatible)
**Project Type**: Single NestJS microservice
**Performance Goals**: PDF URL return within 30 seconds for typical requests (SC-001)
**Constraints**: Config-driven (Gotenberg URL, template base URL, paper dimensions); no hardcoded credentials
**Scale/Scope**: Same as existing PDF flow; no new queues

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Single Responsibility | ✅ Pass | New flow still generates PDFs and stores them; URL-based is alternate generation method |
| II. Contract-First API | ✅ Pass | New DTOs (CreatePdfUrlDto, PdfUrlResponseDto); Swagger; queue payload documented |
| III. Observability | ✅ Pass | LoggingInterceptor, Logger, NotificationsService for success/failure |
| IV. Auth | ✅ Pass | Same JWT/CLARISA guard for HTTP; AuthInterceptor for queue |
| V. Async-First | ✅ Pass | Both HTTP and queue; queue durable; no fire-and-forget |
| VI. External Dependencies | ✅ Pass | Gotenberg URL, template base URL, S3 from config; no hardcoded values |
| Technical Constraints | ⚠ Note | Constitution specifies pdf-creator-node as standard; this adds Gotenberg as alternate path—justified in Complexity Tracking |

## Project Structure

### Documentation (this feature)

```text
specs/001-gotenberg-url-pdf/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (reports-microservice)

```text
reports-microservice/src/
├── domain/
│   ├── api/
│   │   └── pdf/
│   │       ├── dto/
│   │       │   ├── create-pdf.dto.ts          # existing
│   │       │   ├── create-pdf-url.dto.ts      # NEW
│   │       │   └── pdf-url-response.dto.ts    # NEW (or reuse ServiceResponseDto shape)
│   │       ├── pdf.controller.ts              # add routes
│   │       ├── pdf.service.ts                 # add generatePdfFromUrl
│   │       └── gotenberg.service.ts           # NEW (optional: encapsulate Gotenberg HTTP)
│   ├── shared/                                # unchanged
│   └── ...
└── ...
```

**Structure Decision**: Add new DTOs and service method under existing `src/domain/api/pdf`. Optionally extract Gotenberg HTTP logic into a dedicated service for testability and reuse. Reuse existing S3 upload, NotificationsService, and guards.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Additional PDF generation path (Gotenberg vs pdf-creator-node) | Templates hosted at external URLs (e.g., pdf.yecksin.com) must be rendered by Chromium; Handlebars flow cannot fetch remote HTML | pdf-creator-node only works with in-memory HTML; no built-in URL fetching |
