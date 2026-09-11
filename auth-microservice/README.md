<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Environment Variables

| Variable | Description | TEST value |
|---|---|---|
| `PASSWORDLESS_DOMAINS` | Comma-separated, case-insensitive list of email domains provisioned **without** a temporary password (`AdminCreateUser` with `MessageAction: SUPPRESS`, `email_verified: 'true'`) so the user lands `CONFIRMED` and is eligible for `EMAIL_OTP` directly (`/auth/register` → `CognitoService.createUser`, OTP-T-10, `docs/specs/changes/cognito-email-otp-login`: `OTP-R-13`, `OTP-AC-12`). Domains not in the list keep today's temporary-password flow unchanged. Empty/undefined disables the feature entirely. | `cifor-icraf.org,icrisat.org` |

## Endpoints

EMAIL_OTP sign-in (OTP-T-3, `docs/specs/changes/cognito-email-otp-login`: `OTP-R-7`, design.md §4.2/§5.2). Same CLARISA `auth` header, Cognito app client and secret hash as `login/custom`.

| Route | Request | Success (201) | Errors |
|---|---|---|---|
| `POST /auth/login/otp/start` | `{ username }` | `{ challengeName: 'EMAIL_OTP', session, codeDeliveryDestination? }` | `401 { statusCode: 401, code: NOT_AUTHORIZED \| CHALLENGE_NOT_SUPPORTED, message, path, timestamp }` · `502 { statusCode: 502, code: UPSTREAM_ERROR, message, path, timestamp }` |
| `POST /auth/login/otp/verify` | `{ username, code, session }` | `{ tokens: { accessToken, idToken, refreshToken, expiresIn, tokenType } }` — identical shape to `login/custom` | `401 { statusCode: 401, code: CODE_MISMATCH \| CODE_EXPIRED \| ATTEMPTS_EXCEEDED \| NOT_AUTHORIZED \| CHALLENGE_NOT_SUPPORTED, message, path, timestamp }` · `502 { statusCode: 502, code: UPSTREAM_ERROR, message, path, timestamp }` |

Both routes answer **201 Created** on success (NestJS `@Post` default, the same status `login/custom` returns; no `@HttpCode` override — the Swagger `@ApiResponse` on both handlers documents 201). Error bodies are `{ statusCode, code, message, path, timestamp }`: the two OTP handlers carry a route-local `@UseFilters(OtpHttpExceptionFilter)` (`src/api/auth/filters/otp-http-exception.filter.ts`) that serialises the `HttpException` object response verbatim, because the global `HttpExceptionFilter` rebuilds the body from `exception.message` only and would drop `code`. `message` is the stable, user-safe copy from `CognitoService.OTP_ERROR_COPY` — never a raw Cognito message. Existing routes keep the global filter unchanged (OTP-R-10).

**Telemetry** — `CognitoService` logs `{ event: 'otp.start' | 'otp.verify', outcome }`, outcome only (never username/code/session/tokens, OTP-R-11/OTP-R-12). The global `LoggingInterceptor` (`src/shared/interceptors/logging.interceptor.ts`) still logs a 1,000-char preview of every successful response body, so it now passes the body through `redactSensitive()` first: the values of `session`, `tokens`, `accessToken`, `idToken`, `refreshToken`, `password`, `temporaryPassword`, `secretHash` and `code` (any casing, any depth) are replaced by `"[REDACTED]"` in the log line only — the response sent to the client is untouched.

| Event | Outcome vocabulary |
|---|---|
| `otp.start` | `sent \| CODE_MISMATCH \| CODE_EXPIRED \| ATTEMPTS_EXCEEDED \| NOT_AUTHORIZED \| CHALLENGE_NOT_SUPPORTED \| UPSTREAM_ERROR` (the lowercase `upstream_error` variant is what `CognitoService` emits on the fetch/network-failure path, i.e. when Cognito returned no `code`; treat both spellings as the same outcome when filtering logs) |
| `otp.verify` | `ok \| CODE_MISMATCH \| CODE_EXPIRED \| ATTEMPTS_EXCEEDED \| NOT_AUTHORIZED \| CHALLENGE_NOT_SUPPORTED \| UPSTREAM_ERROR` (same `upstream_error` note as above) |

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
