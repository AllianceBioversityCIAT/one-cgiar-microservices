# Quickstart: Gotenberg URL-Based PDF Generation

**Feature**: 001-gotenberg-url-pdf
**Date**: 2025-02-13

## Prerequisites

- Node.js 14.x+
- RabbitMQ running
- AWS credentials configured
- Gotenberg accessible (e.g., Lambda URL or Docker)
- Template base URL reachable by Gotenberg (e.g., pdf.yecksin.com)

## Environment Variables

Add to `.env`:

```env
# Gotenberg
GOTENBERG_URL=https://your-gotenberg-endpoint/forms/chromium/convert/url
PDF_TEMPLATE_BASE_URL=https://pdf.yecksin.com

# Optional (defaults shown)
GOTENBERG_PAPER_WIDTH=600px
GOTENBERG_PAPER_HEIGHT=1000px
GOTENBERG_MARGIN_TOP=0
GOTENBERG_MARGIN_BOTTOM=0
GOTENBERG_MARGIN_LEFT=0
GOTENBERG_MARGIN_RIGHT=0
GOTENBERG_PRINT_BACKGROUND=true
```

## Run the Service

```bash
npm run start:dev
```

## HTTP Request Example

```bash
curl -X POST http://localhost:4200/api/reports/pdf/generate-url \
  -H "Content-Type: application/json" \
  -H 'auth: {"username":"your_user","password":"your_password"}' \
  -d '{
    "data": {"id": 1, "test": true},
    "templateName": "001",
    "bucketName": "my-bucket",
    "fileName": "report-001.pdf"
  }'
```

**Expected response** (200):

```json
{
  "url": "https://my-bucket.s3.amazonaws.com/report-001.pdf"
}
```

## RabbitMQ Message Example

Send to queue with pattern `pdf.generateUrl`:

```json
{
  "data": {"id": 1, "test": true},
  "templateName": "001",
  "bucketName": "my-bucket",
  "fileName": "report-001.pdf"
}
```

## URL Construction

For the example above:

- **Constructed URL**: `https://pdf.yecksin.com/001?id=1&test=true`
- Gotenberg fetches this URL and converts it to PDF
- PDF is uploaded to S3 at `my-bucket/report-001.pdf`

## Validation

- Invalid template name or URL → 400 Bad Request
- Gotenberg unreachable or returns error → 500; Slack notification if configured
- S3 upload failure → 500; Slack notification if configured
