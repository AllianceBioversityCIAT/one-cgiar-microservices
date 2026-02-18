# Feature Specification: Gotenberg URL-Based PDF Generation

**Feature Branch**: `001-gotenberg-url-pdf`
**Created**: 2025-02-13
**Status**: Draft
**Input**: User description: "Add new PDF generation pattern: receive JSON data and template name, build URL, send to Gotenberg, upload PDF to S3, return S3 URL"

## Clarifications

### Session 2025-02-13

- Q: S3 bucket and file name – who provides them? → A: Client must send fileName and bucketName in the request.
- Q: Entry point(s): HTTP, queue, or both? → A: Both HTTP and queue (same as existing PDF flow).
- Q: Invalid template or URL – what does the system do? → A: Return 400 Bad Request; do not call conversion service or storage.
- Q: Conversion service returns non-PDF or empty response – how to handle? → A: Return error to client; notify operators where configured.
- Q: Concurrent or duplicate requests (same template+data+bucket+fileName)? → A: No special handling; each request runs independently; last upload wins.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate PDF from URL-Based Template (Priority: P1)

A client needs to generate a PDF by providing JSON data and a template identifier. The system constructs a URL from these inputs, uses an external URL-to-PDF conversion service to produce the PDF, stores it in cloud storage, and returns the location where the PDF can be accessed.

**Why this priority**: This is the core flow; without it there is no feature.

**Independent Test**: Can be fully tested by sending a request with valid JSON data and template name, and verifying that a PDF is generated, stored, and a retrievable URL is returned.

**Acceptance Scenarios**:

1. **Given** a client with valid credentials, **When** the client sends JSON data and a template name, **Then** the system returns a URL where the generated PDF can be accessed.
2. **Given** valid inputs, **When** the PDF is generated, **Then** the PDF is stored in the configured cloud storage (S3) with a unique identifier.
3. **Given** a successful generation, **When** the client receives the response, **Then** the response contains the URL to retrieve the PDF.

---

### User Story 2 - Handle Generation Failures Gracefully (Priority: P2)

When URL construction, external conversion, or storage fails, the system must inform the client clearly and support operational visibility (logging, notifications).

**Why this priority**: Reliability and operability are essential for production use.

**Independent Test**: Can be tested by simulating failures (invalid template, unreachable conversion service, storage errors) and verifying appropriate error responses and notifications.

**Acceptance Scenarios**:

1. **Given** invalid or incomplete inputs, **When** the client submits a request, **Then** the system returns a clear validation error without attempting generation.
2. **Given** the external conversion service is unavailable or returns an error, **When** generation is attempted, **Then** the system returns a meaningful error and notifies operators where configured.
3. **Given** storage (S3) upload fails, **When** generation completes but storage fails, **Then** the system returns an error and notifies operators where configured.

---

### Edge Cases

- **Invalid template or URL**: When the template name does not map to a valid URL path, or when the JSON data produces an invalid or excessively long URL, the system returns 400 Bad Request and does not call the conversion service or storage.
- **Non-PDF or empty conversion response**: When the conversion service returns a non-PDF or empty response, the system returns an error to the client and notifies operators where configured.
- **Concurrent or duplicate requests**: No special handling; each request runs independently; if two requests use the same bucket and file name, the last upload wins.
- **Template base URL unreachable**: When the PDF base URL (e.g., pdf.yecksin.com) is unreachable by the conversion service, the conversion fails; the system returns an error to the client and notifies operators where configured (same as FR-004a).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST accept a request containing JSON data, a template name, a bucket name, and a file name.
- **FR-002**: The system MUST construct a URL by combining a base URL, the template path, and the JSON data as query parameters.
- **FR-002a**: The system MUST validate template name and constructed URL before calling the conversion service; invalid template or URL MUST result in 400 Bad Request without invoking conversion or storage.
- **FR-003**: The system MUST send the constructed URL to an external URL-to-PDF conversion service with configurable dimensions and layout (paper size, margins, background printing).
- **FR-004**: The system MUST receive the generated PDF binary from the conversion service.
- **FR-004a**: When the conversion service returns non-PDF or empty content, the system MUST return an error to the client and notify operators where configured.
- **FR-005**: The system MUST upload the PDF to cloud storage (S3) using the bucket name and file name provided by the client in the request.
- **FR-006**: The system MUST return the storage URL (or equivalent retrieval path) of the uploaded PDF in the response.
- **FR-007**: The system MUST expose this flow via both HTTP (POST) and RabbitMQ (message pattern), matching the existing PDF generation flow.
- **FR-008**: The system MUST protect both entry points with the same authentication and authorization as existing PDF generation endpoints.
- **FR-009**: The system MUST log all requests and responses for this flow.
- **FR-010**: The system MUST send operational notifications (e.g., Slack) for successes and failures where configured.
- **FR-011**: The system MUST NOT break or alter the existing Handlebars-based PDF generation flow.
- **FR-012**: The system MUST process each request independently; no idempotency guarantees for concurrent requests with identical inputs; last upload wins for same bucket and file name.

### Key Entities

- **PdfUrlRequest**: Represents the input; contains JSON data (key-value pairs for query params), template name, bucket name, and file name.
- **PdfUrlResponse**: Represents the output; contains the URL or path where the generated PDF can be retrieved.
- **Conversion Service Config**: Base URL, paper dimensions, margins, and print options used for the external conversion call.

## Assumptions

- The base URL for templates (e.g., pdf.yecksin.com) is configurable and reachable by the conversion service.
- The external conversion service (Gotenberg/Chromium) is deployed and accessible; its endpoint is configurable.
- Client provides bucket name and file name in each request; S3 bucket and naming strategy follow existing Handlebars flow patterns.
- The template name maps to a path segment (e.g., "001" → "/001") on the base URL.
- JSON data keys become URL query parameter names and values become parameter values.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can receive a retrievable PDF URL within 30 seconds for typical requests.
- **SC-002**: The system handles validation errors without calling the conversion service or storage.
- **SC-003**: Failed generations are logged and, where configured, notified to operators.
- **SC-004**: The new flow coexists with the existing PDF generation flow without regressions.
