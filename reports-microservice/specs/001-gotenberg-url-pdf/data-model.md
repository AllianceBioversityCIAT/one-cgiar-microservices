# Data Model: Gotenberg URL-Based PDF Generation

**Feature**: 001-gotenberg-url-pdf
**Date**: 2025-02-13

## Entities

### CreatePdfUrlDto (Request)

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| data | Record<string, string \| number \| boolean> | Yes | Object; keys and values used for URL query params | JSON data to serialize as query parameters |
| templateName | string | Yes | Non-empty; safe path segment (no /, ?, #) | Template identifier; maps to path segment (e.g., "001" → "/001") |
| bucketName | string | Yes | Non-empty | S3 bucket for PDF storage |
| fileName | string | Yes | Non-empty | S3 object key (file name) |

**Relationships**: None (input-only)

**Example**:
```json
{
  "data": { "id": 1, "test": true },
  "templateName": "001",
  "bucketName": "my-reports-bucket",
  "fileName": "report-001.pdf"
}
```

---

### PdfUrlResponse

| Field | Type | Description |
|-------|------|-------------|
| url | string | S3 URL or equivalent retrieval path for the generated PDF |

**Relationships**: None (output-only)

**Example**:
```json
{
  "url": "https://my-reports-bucket.s3.amazonaws.com/report-001.pdf"
}
```

---

### Conversion Service Config (Internal)

| Field | Source | Description |
|-------|--------|-------------|
| gotenbergBaseUrl | Env: GOTENBERG_URL | Base URL for Gotenberg (e.g., Lambda URL) |
| templateBaseUrl | Env: PDF_TEMPLATE_BASE_URL | Base URL for templates (e.g., https://pdf.yecksin.com) |
| paperWidth | Env: GOTENBERG_PAPER_WIDTH (default: 600px) | Paper width for conversion |
| paperHeight | Env: GOTENBERG_PAPER_HEIGHT (default: 1000px) | Paper height |
| marginTop, marginBottom, marginLeft, marginRight | Env: GOTENBERG_MARGIN_* (default: 0) | Page margins |
| printBackground | Env: GOTENBERG_PRINT_BACKGROUND (default: true) | Print background graphics |

---

## URL Construction Rules

- **Full URL**: `{templateBaseUrl}/{templateName}?{queryString}`
- **Query string**: `key1=encode(value1)&key2=encode(value2)` from `data` object
- **Max URL length**: 2048 characters (validation before calling Gotenberg)

---

## State Transitions

None (stateless; each request is independent per FR-012).
