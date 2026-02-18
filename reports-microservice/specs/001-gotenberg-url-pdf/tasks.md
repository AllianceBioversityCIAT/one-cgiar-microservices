# Tasks: Gotenberg URL-Based PDF Generation

**Input**: Design documents from `specs/001-gotenberg-url-pdf/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in spec; omitted per task generation rules.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- Source: `src/domain/api/pdf/` (reports-microservice)
- Paths relative to reports-microservice root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add environment configuration for Gotenberg flow

- [x] T001 Add GOTENBERG_URL, PDF_TEMPLATE_BASE_URL, GOTENBERG_PAPER_WIDTH, GOTENBERG_PAPER_HEIGHT, GOTENBERG_MARGIN_* (default 0), GOTENBERG_PRINT_BACKGROUND to .env.example for documentation (user adds to .env manually)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure for Gotenberg HTTP client and config loading

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Load Gotenberg config (base URL, paper dims, margins, printBackground) from ConfigService in src/domain/api/pdf/gotenberg.service.ts
- [x] T003 Create GotenbergService in src/domain/api/pdf/gotenberg.service.ts with method to POST multipart/form-data to Gotenberg /forms/chromium/convert/url and return PDF buffer; use @nestjs/axios or fetch with FormData (per research.md)

**Checkpoint**: GotenbergService ready; URL construction and S3 upload can proceed

---

## Phase 3: User Story 1 - Generate PDF from URL-Based Template (Priority: P1) 🎯 MVP

**Goal**: Client sends JSON data + template name + bucket + fileName; system builds URL, calls Gotenberg, uploads PDF to S3, returns S3 URL.

**Independent Test**: POST valid CreatePdfUrlDto to /generate-url (or pdf.generateUrl via queue); verify PDF generated, stored in S3, and response contains retrievable URL.

### Implementation for User Story 1

- [x] T004 [P] [US1] Create CreatePdfUrlDto in src/domain/api/pdf/dto/create-pdf-url.dto.ts with data, templateName, bucketName, fileName; add @ApiProperty decorators per contracts/pdf-url-api.yaml
- [x] T005 [P] [US1] Create PdfUrlResponseDto in src/domain/api/pdf/dto/pdf-url-response.dto.ts with url field; add @ApiProperty per contracts
- [x] T006 [US1] Implement buildPdfUrl(templateBaseUrl, templateName, data) helper in src/domain/api/pdf/pdf.service.ts that returns full URL with query string from data; validate max URL length 2048
- [x] T007 [US1] Implement generatePdfFromUrl(dto: CreatePdfUrlDto) in src/domain/api/pdf/pdf.service.ts: validate template name (safe path segment, no /, ?, #) and constructed URL (length ≤ 2048) before calling Gotenberg; throw BadRequestException (400) if invalid; build URL, call GotenbergService, upload PDF buffer to S3 via PutObjectCommand (reuse existing S3 client), return S3 URL; integrate NotificationsService for success
- [x] T008 [US1] Add POST generate-url handler in src/domain/api/pdf/pdf.controller.ts that accepts CreatePdfUrlDto and returns PdfUrlResponseDto (or { url }); wire to PdfService.generatePdfFromUrl
- [x] T009 [US1] Add MessagePattern pdf.generateUrl handler in src/domain/api/pdf/pdf.controller.ts with AuthInterceptor; wire to PdfService.generatePdfFromUrl
- [x] T010 [US1] Register GotenbergService in PdfModule providers; ensure HttpModule (AxiosHttpService) is available if using @nestjs/axios

**Checkpoint**: User Story 1 complete; happy path works via HTTP and queue

---

## Phase 4: User Story 2 - Handle Generation Failures Gracefully (Priority: P2)

**Goal**: Invalid input → 400 without calling Gotenberg; conversion/S3 failures → error response + Slack notification.

**Independent Test**: Send invalid template or URL → 400; simulate Gotenberg/S3 failure → 500 and Slack notification (where configured).

### Implementation for User Story 2

- [x] T011 [US2] Add Content-Type and body check in GotenbergService: if response not application/pdf or body empty → throw; ensure PdfService catches and notifies operators via NotificationsService (per FR-004a)
- [x] T012 [US2] Ensure S3 PutObjectCommand failure in generatePdfFromUrl is caught, NotificationsService.sendSlackNotification called, and error rethrown (or returned via GlobalExceptions)
- [x] T013 [US2] Ensure Gotenberg HTTP errors (4xx, 5xx, timeout) and non-PDF response are caught in PdfService, NotificationsService.sendSlackNotification called, error rethrown

**Checkpoint**: User Stories 1 and 2 both work; errors handled consistently

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Swagger, logging, documentation

- [x] T014 [P] Add @ApiTags, @ApiOperation, @ApiResponse decorators to POST generate-url and pdf.generateUrl in src/domain/api/pdf/pdf.controller.ts; ensure CreatePdfUrlDto and PdfUrlResponseDto are documented in Swagger
- [x] T015 Add logging for generatePdfFromUrl: log request (templateName, bucketName, fileName) and response (url or error) via existing Logger in PdfService
- [x] T016 Validate quickstart.md: run service, POST to /api/reports/pdf/generate-url with valid payload, verify PDF URL returned; update quickstart if base path differs

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies
- **Phase 2 (Foundational)**: Depends on Phase 1
- **Phase 3 (US1)**: Depends on Phase 2
- **Phase 4 (US2)**: Depends on Phase 3 (extends generatePdfFromUrl)
- **Phase 5 (Polish)**: Depends on Phase 4

### User Story Dependencies

- **US1 (P1)**: After Foundational; no dependency on US2
- **US2 (P2)**: Extends US1 implementation (validation and error handling in same flow)

### Within Each User Story

- US1: T004, T005 parallel → T006, T007, T008, T009, T010 sequential (T007 depends on T006; T008/T009 depend on T007)
- US2: T011–T013 can be done in sequence (all modify generatePdfFromUrl/GotenbergService)

### Parallel Opportunities

- T004, T005: Different DTO files
- T014: Swagger decorators (parallel with others in Polish)

---

## Parallel Example: User Story 1

```bash
# Launch DTOs in parallel:
T004: Create CreatePdfUrlDto in src/domain/api/pdf/dto/create-pdf-url.dto.ts
T005: Create PdfUrlResponseDto in src/domain/api/pdf/dto/pdf-url-response.dto.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: POST valid request, verify PDF URL returned
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → GotenbergService ready
2. Add User Story 1 → Test happy path → Deploy (MVP)
3. Add User Story 2 → Test error paths → Deploy
4. Add Polish → Swagger, logging, quickstart validation

### Parallel Team Strategy

- Phase 3: One developer can do T004+T005 in parallel, then T006→T007→T008+T009+T010
- Phase 4: Same developer extends generatePdfFromUrl with error handling (validation already in US1)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to user story for traceability
- Each user story independently testable
- Commit after each task or logical group
- Do not alter existing Handlebars flow (generate, pdf.generate)
