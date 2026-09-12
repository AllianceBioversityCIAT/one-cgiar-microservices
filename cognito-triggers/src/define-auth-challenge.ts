import type { DefineAuthChallengeTriggerEvent } from 'aws-lambda';

import { logTrigger } from './lib/logger';

/** `OTP-R-34` — at most three verification attempts per Cognito session. */
const MAX_ATTEMPTS = 3;

/**
 * Cognito **DefineAuthChallenge** trigger — the state machine of the
 * `CUSTOM_AUTH` flow (`design.md` §18.1 steps 3 and 8).
 *
 * | Session state | Response |
 * |---|---|
 * | empty | `CUSTOM_CHALLENGE` |
 * | last answer correct | `issueTokens` |
 * | 3 rounds, last answer wrong | `failAuthentication` (`NotAuthorizedException`) |
 * | otherwise | another `CUSTOM_CHALLENGE` (rotated `Session`, same code) |
 *
 * `userNotFound` is deliberately **not** a branch: an unknown user walks the
 * same path so the microservice response is indistinguishable from a real one
 * (`design.md` §18.3). The outcome logged is identical too — a different log
 * line would be an enumeration oracle for anyone reading CloudWatch.
 */
export const handler = async (
  event: DefineAuthChallengeTriggerEvent,
): Promise<DefineAuthChallengeTriggerEvent> => {
  const startedAt = Date.now();
  const session = event.request.session ?? [];
  // Assumes every `session[].challengeName` is a CUSTOM_CHALLENGE round — these
  // triggers only run for clients with ALLOW_CUSTOM_AUTH (`OTP-R-33`), so the
  // attempt counter below never sees another challenge type mixed in.
  const lastAttempt = session[session.length - 1];

  let outcome: string;

  if (session.length === 0) {
    event.response.challengeName = 'CUSTOM_CHALLENGE';
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
    outcome = 'challenge_issued';
  } else if (lastAttempt?.challengeResult === true) {
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
    outcome = 'tokens_issued';
  } else if (session.length >= MAX_ATTEMPTS) {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
    outcome = 'attempts_exceeded';
  } else {
    event.response.challengeName = 'CUSTOM_CHALLENGE';
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
    outcome = 'challenge_issued';
  }

  logTrigger({
    event: 'define_auth_challenge',
    outcome,
    durationMs: Date.now() - startedAt,
    hasSession: session.length > 0,
    attempt: session.length,
  });

  return event;
};
