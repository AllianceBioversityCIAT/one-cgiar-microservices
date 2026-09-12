# cognito-triggers

Three Cognito **`CUSTOM_AUTH`** Lambda triggers that let PRMS own the e-mail
sign-in code end to end: the code is generated here and delivered through PRMS's
existing RabbitMQ → `notification-microservice` → SMTP pipeline, so it arrives
from **"PRMS Reporting Tool" `<PRMS-No-reply@cgiar.org>`** instead of Cognito's
default `no-reply@verificationemail.com`.

Spec: `onecgiar_pr/docs/specs/changes/cognito-email-otp-login` — `design.md`
§18 (Option B pivot), `requirements.md` §13 (`OTP-R-32..35`), task `OTP-T-11`.

---

## The flow

| # | Trigger | What it does |
|---|---|---|
| 1 | **DefineAuthChallenge** | State machine. No session → `CUSTOM_CHALLENGE`. Last answer correct → `issueTokens`. Three rounds with the last answer wrong → `failAuthentication` (Cognito raises `NotAuthorizedException`). Otherwise another `CUSTOM_CHALLENGE`. |
| 2 | **CreateAuthChallenge** | Reuses the code carried in the previous round's `challengeMetadata` (`CODE-<code>`), or mints a fresh `crypto.randomInt` 6-digit one. Stores it in `privateChallengeParameters.answer`, exposes only a masked `destination`, and — **only for a fresh code** — publishes the e-mail to the notification queue. |
| 3 | **VerifyAuthChallengeResponse** | `answerCorrect = timingSafeEqual(answer, stored)`. |

Two properties fall out of that table and are worth stating explicitly:

- **One e-mail per Cognito session.** A wrong code rotates the session but keeps
  the code, so retries never generate a second mail (`OTP-R-32`).
- **An unknown user is indistinguishable from a real one.** It still gets a
  challenge, with a masked destination derived from the submitted `userName`
  (byte-identical to what a real user with that same input would get) and no
  e-mail — and Verify rejects it unconditionally (`design.md` §18.3). A random
  decoy mask would itself be the enumeration tell at the microservice
  boundary, since a real user's mask is a deterministic function of the
  email.

## Layout

```
src/
  define-auth-challenge.ts          # trigger 1
  create-auth-challenge.ts          # trigger 2
  verify-auth-challenge.ts          # trigger 3
  lib/
    code.ts                         # CSPRNG code, CODE- metadata, timingSafeEqual
    mask.ts                         # s***@i*** destination masking
    email-template.ts               # bundled {{var}} template + ConfigMessageDto
    rmq-publisher.ts                # raw amqplib, NestJS event envelope
    logger.ts                       # allow-listed single-line JSON records
template.yaml                       # AWS SAM: 3 functions + invoke permissions
```

`amqplib` is the only runtime dependency. Everything else — the AWS SDK, a
handlebars runtime, a logging framework — is deliberately absent: these are
synchronous triggers on the critical path of every sign-in, and Cognito kills
them at 5 s.

---

## The notification-queue contract (read before deploying)

`create-auth-challenge` speaks the wire format of the NestJS RabbitMQ transport
with raw `amqplib`, so `notification-microservice`'s `@MessagePattern('send')`
handler receives it exactly as it receives
`auth-microservice`'s `ClientProxy.emit('send', payload)`.

**Message written to the queue:**

```jsonc
{
  "pattern": "send",
  "data": {
    "auth": { "username": "<MS_NOTIFICATION_USER>", "password": "<MS_NOTIFICATION_PASSWORD>" },
    "data": {
      "from":      { "email": "<EMAIL_SENDER>", "name": "PRMS Reporting Tool" },
      "emailBody": {
        "subject": "Your PRMS Reporting Tool sign-in code",
        "to":      "user@example.org",
        "cc":      "",
        "bcc":     "",
        "message": { "text": "<plain text>", "socketFile": "<html string>" }
      }
    }
  }
}
```

Three assumptions are baked into that shape. **`OTP-T-14`'s first live
invocation is what verifies them** — until then they are reasoned, not observed:

1. **Envelope.** `@nestjs/microservices/client/client-rmq.js#dispatchEvent`
   serialises an *event* as `Buffer.from(JSON.stringify({ pattern, data }))` and
   calls `channel.sendToQueue(queue, content, options)`. Unlike `send()`, an
   event carries **no `id` / `correlationId`** — that absence is how `ServerRMQ`
   tells an event from a request. `publishEvent()` reproduces this, and
   `rmq-publisher.spec.ts` asserts the exact bytes.
2. **`to` and `cc` are strings, not arrays.** This follows the emitter already
   proven against the deployed TEST consumer from this repo —
   `auth-microservice/.../bulk-registration.service.ts:173` sends
   `to: user.email` with the same `auth` envelope — and matches
   `notification-microservice`'s DTO, whose `mailer.service.ts` runs
   `String.split(',')` over both fields. PRMS's own
   `email-notification-management` DTO types them `string[]`; that array shape
   belongs to a different consumer version. So: **if the deployed consumer
   rejects a string, use `to: [email]` / `cc: []`** — a one-line change in
   `lib/email-template.ts` (`buildOtpEmailMessage`). Check this first if the
   smoke test queues a message that never turns into an e-mail.
3. **`socketFile` is an HTML string, not a Buffer.** The consumer does
   `typeof file === 'string' ? Buffer.from(file) : file`, so a string is the
   lossless path over JSON (a serialised Buffer arrives as
   `{ type: 'Buffer', data: [...] }`).

Two deliberate departures from what NestJS does, neither of which changes the
bytes the consumer sees:

- **The queue is not asserted.** It is declared and owned by
  `notification-microservice`; re-asserting it with different arguments would
  kill the channel with `PRECONDITION_FAILED`.
- **A confirm channel is used** (`waitForConfirms()` before returning). A Lambda
  is frozen the instant its handler resolves, so an unconfirmed publish can be
  lost. Messages are published `persistent: true`.

If the broker turns out to be unreachable from a non-VPC Lambda (`OTP-OQ-9`),
the recorded fallback is an HTTP `POST /send` on the notification microservice's
API Gateway with the `auth` header — same `ConfigMessageDto`, different
transport.

---

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `MS_NOTIFICATION_QUEUE` | yes | Queue the notification microservice consumes. |
| `MS_NOTIFICATION_USER` / `MS_NOTIFICATION_PASSWORD` | yes | CLARISA application credentials the consumer's `AuthInterceptor` validates. |
| `EMAIL_SENDER` | yes | `From` address (`PRMS-No-reply@cgiar.org`). |
| `APP_URL` | no | Link in the e-mail footer. Defaults to `https://reporting.cgiar.org/`. |
| `MS_NOTIFICATION_HOST` | either this… | Complete broker URL — the shape `auth-microservice` passes to `ClientsModule.register`. Takes precedence when set, and is used verbatim. |
| `MS_RMQ_HOST`, `MS_RMQ_USER`, `MS_RMQ_PASSWORD` | …or these | Assembled into `amqps://<user>:<pass>@<host>`, byte for byte the shape `notification-microservice/server/src/main.ts:44` builds. Credentials are percent-encoded; a scheme already present on `MS_RMQ_HOST` is preserved. **No path segment is ever appended** — the queue is addressed by name (`MS_NOTIFICATION_QUEUE`), never through the connection URL. |

Broker credentials live in Lambda environment variables, as they do for the
microservices today. Moving them to Secrets Manager is a recorded follow-up
(`design.md` §18.3), not part of this task.

---

## Develop

```bash
npm ci
npm test            # jest
npm run typecheck   # tsc --noEmit
npm run build       # tsc -> dist/
```

## Deploy

`sam build` packages `dist/`, so **build before you package**:

```bash
npm ci && npm run build
sam build
sam deploy --guided --profile IBD-DEV --region us-east-1
```

`--guided` writes `samconfig.toml`, which is git-ignored — it would otherwise
hold the broker password in the repo. Parameters are `NoEcho`, so they do not
appear in stack events, but they are still readable from the Lambda
configuration by anyone with `lambda:GetFunctionConfiguration`.

The artifact is ~1 MB because `sam build` runs a plain `npm install` in the
staging directory and keeps devDependencies. Only `dist/**` and `amqplib` are
loaded at runtime; to slim the upload:

```bash
for fn in Define Create Verify; do
  (cd ".aws-sam/build/${fn}AuthChallengeFunction" && npm prune --omit=dev)
done
```

The stack outputs the three function ARNs — that is what the next step needs.

## Wire the pool (HITL, `OTP-T-14`)

The triggers are inert until the pool's `LambdaConfig` points at them, and they
only ever run for clients with `ALLOW_CUSTOM_AUTH` — today only
`general-client`. Sibling apps (`PRMS-Reporting`, `MARLO`, …) see no change
(`OTP-R-33`), which the runbook's sibling smoke verifies.

> **Never run a bare `aws cognito-idp update-user-pool`.** The API is a full
> replace: every attribute you omit is reset to its default. `design.md` §5.4
> allows exactly two paths — the console, or `--cli-input-json` built from a
> fresh export.

**Path A — console.** User pool → *Authentication* → *Extensions* → *Add Lambda
trigger* → *Custom authentication* → select all three. Lowest risk; the console
preserves everything else.

**Path B — CLI, from a before-export.**

```bash
POOL=us-east-1_o9y9Yq5pO
AWS="aws --profile IBD-DEV --region us-east-1"

# 1. Export the current pool (keep this file — it is the rollback source).
$AWS cognito-idp describe-user-pool --user-pool-id "$POOL" > pool-before.json

# 2. Build a complete update input from that export, adding only LambdaConfig.
jq --arg define "$DEFINE_ARN" --arg create "$CREATE_ARN" --arg verify "$VERIFY_ARN" '
  .UserPool
  | { UserPoolId: .Id, Policies, DeletionProtection, LambdaConfig,
      AutoVerifiedAttributes, SmsVerificationMessage, EmailVerificationMessage,
      EmailVerificationSubject, SmsAuthenticationMessage, VerificationMessageTemplate,
      UserAttributeUpdateSettings, MfaConfiguration, DeviceConfiguration,
      EmailConfiguration, SmsConfiguration, UserPoolTags, AdminCreateUserConfig,
      UserPoolAddOns, AccountRecoverySetting, UserPoolTier }
  | with_entries(select(.value != null))
  | .LambdaConfig += { DefineAuthChallenge: $define,
                       CreateAuthChallenge: $create,
                       VerifyAuthChallengeResponse: $verify }
' pool-before.json > pool-update.json

# 3. Read the diff before applying it.
diff <(jq -S .UserPool pool-before.json) <(jq -S . pool-update.json)

# 4. Apply, then export again and diff before/after.
$AWS cognito-idp update-user-pool --cli-input-json file://pool-update.json
$AWS cognito-idp describe-user-pool --user-pool-id "$POOL" > pool-after.json
```

Keep `pool-before.json` / `pool-after.json` in the spec's `runbook/`.

`sam deploy` already grants `lambda:InvokeFunction` to
`cognito-idp.amazonaws.com`, scoped to this pool ARN — the console would
otherwise add an unscoped permission of its own.

Two settings belong to the same change window:

- Raise `general-client`'s `AuthSessionValidity` from 3 to **5 minutes**, so a
  slow inbox does not expire the code. Client-level, isolated.
- Once Option B is live, roll the `EMAIL_OTP` first-auth factor added by
  `OTP-T-1` back to `[PASSWORD]` (`OTP-R-33`).

**Rollback:** remove the three `LambdaConfig` entries the same way (Path A or B
from a fresh export). With the triggers unwired the pool behaves exactly as it
did before, and nothing in the deployed stack affects it.

---

## Observability

Every invocation emits one single-line JSON record on stdout. The fields are an
**allow-list in `lib/logger.ts`**: anything else handed to `logTrigger` is
dropped before serialisation, so a future edit cannot leak a code or an address
by accident (`OTP-R-11`).

```json
{"event":"create_auth_challenge","outcome":"code_sent","durationMs":84,"hasSession":false,"attempt":0}
```

| `outcome` | Meaning |
|---|---|
| `challenge_issued` | Define asked for another `CUSTOM_CHALLENGE`. |
| `tokens_issued` | Define accepted the last answer. |
| `attempts_exceeded` | Define failed the flow after three rounds. |
| `code_sent` | Create minted a code and queued the e-mail — **and also what a decoy challenge for an unknown user logs**, so CloudWatch cannot be used to enumerate addresses either. |
| `code_reused` | Create reused the session's code; **no e-mail** (a retry). |
| `email_failed` | The broker publish failed. The challenge was still returned (`OTP-R-35`) — the user sees a normal "check your inbox" screen and never receives the mail. Support runbook: "code not received". |
| `answer_accepted` / `answer_rejected` | Verify's decision on one answer. |

**Never logged:** the code, the address, the Cognito session, `challengeMetadata`,
or broker credentials. The broker error object is not logged either — it can
carry the connection URL, credentials included. `create-auth-challenge.spec.ts`
scans every logger call for all of these.

## Test

`npm test` — 111 tests across 8 suites, no AWS and no broker required.
The ones that encode a requirement rather than an implementation detail:

- `code.spec.ts` — `crypto.randomInt(0, 1_000_000)`, zero-padding, `Math.random`
  is never called, `timingSafeEqual` is (and is skipped on unequal lengths).
- `rmq-publisher.spec.ts` — the exact `{ pattern, data }` bytes, no `id` field,
  confirm-before-close, connection closed on failure, URL precedence and
  credential encoding.
- `create-auth-challenge.spec.ts` — the emit payload deep-equals the
  `auth` + `ConfigMessageDto` shape; reuse-on-retry sends no second mail; a
  broker failure still returns a challenge and logs `email_failed`; an unknown
  user's log record equals a real user's; no code, address or session in any
  logger call.
- `define-auth-challenge.spec.ts` — the full state machine, including that an
  unknown user's response *and log line* are identical to a real user's.
