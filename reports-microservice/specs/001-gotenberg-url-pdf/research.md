# Research: Gotenberg URL-Based PDF Generation

**Feature**: 001-gotenberg-url-pdf
**Date**: 2025-02-13

## 1. Gotenberg Chromium Convert URL API

**Decision**: Use `POST /forms/chromium/convert/url` with multipart/form-data.

**Rationale**: Gotenberg 8.x exposes this route for URL-to-PDF conversion. The user's Lambda URL points to this endpoint. It accepts a `url` form field (required) and optional page properties (paperWidth, paperHeight, margins, printBackground).

**Alternatives considered**:
- Gotenberg 6.x `/convert/url` with `remoteURL` — deprecated; 8.x uses `url` and different path.
- Puppeteer directly — adds runtime dependency; Gotenberg is containerized and already deployed.

**API details**:
- Form fields: `url` (required), `paperWidth`, `paperHeight`, `marginTop`, `marginBottom`, `marginLeft`, `marginRight`, `printBackground`
- Units: px, pt, in, mm, cm (e.g., `600px`, `1000px`)
- Response: 200 OK with PDF binary; Content-Type: application/pdf
- Errors: 400 (invalid form, network errors loading URL), 403 (URL not authorized), 503 (timeout)

---

## 2. URL Construction Pattern

**Decision**: `{baseUrl}/{templateName}?{queryString}` where queryString is built from JSON data key-value pairs.

**Rationale**: User example: `https://pdf.yecksin.com/001?id=1&test=true` — template "001" maps to path `/001`; `{id: 1, test: true}` becomes `id=1&test=true`. Standard URL encoding for values.

**Alternatives considered**:
- JSON in fragment — not sent to server; unsuitable for template data.
- POST body to template page — would require template host to accept POST; out of scope.

**Validation rules**:
- Template name: non-empty, safe path segment (no `/`, `?`, `#`)
- URL length: enforce reasonable max (e.g., 2048 chars) to avoid abuse
- Query param encoding: `encodeURIComponent` for keys and values

---

## 3. HTTP Client for Gotenberg

**Decision**: Use `@nestjs/axios` (Axios) or Node `fetch` for multipart/form-data POST to Gotenberg.

**Rationale**: NestJS project already has `@nestjs/axios`. Axios supports `FormData`; form-data package can build multipart body. Alternatively, native `fetch` (Node 18+) supports FormData. Prefer existing dependency.

**Alternatives considered**:
- gotenberg NPM client — may not match exact Lambda endpoint or form field names; raw HTTP is more controllable.
- node-fetch — project uses NestJS; Axios is already present.

---

## 4. Paper Dimensions and Layout

**Decision**: Configurable defaults: paperWidth=600px, paperHeight=1000px, margins=0, printBackground=true. Store in ConfigService / env (e.g., GOTENBERG_PAPER_WIDTH, GOTENBERG_PAPER_HEIGHT, GOTENBERG_MARGINS, GOTENBERG_PRINT_BACKGROUND).

**Rationale**: User specified these values. Making them configurable satisfies constitution (no hardcoded env-specific logic) and allows per-environment tuning.

**Alternatives considered**:
- Client-provided layout — increases API surface; current spec does not require it.
- Fixed in code — violates configuration principle.

---

## 5. Non-PDF or Empty Response Handling

**Decision**: Check response Content-Type and body length. If not `application/pdf` or body empty/invalid, treat as conversion failure; return error to client and notify operators (per FR-004a).

**Rationale**: Gotenberg normally returns PDF with Content-Type set. Defensive check prevents uploading corrupt or non-PDF content to S3.
