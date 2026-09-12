import type { CreateAuthChallengeTriggerEvent } from 'aws-lambda';

import {
  encodeChallengeMetadata,
  generateCode,
  readCodeFromMetadata,
} from './lib/code';
import { buildOtpEmailMessage } from './lib/email-template';
import { logTrigger } from './lib/logger';
import { maskEmail, randomMaskedDestination } from './lib/mask';
import { notificationAuth, publishEvent } from './lib/rmq-publisher';

/** Pattern the notification microservice listens on (`mailer.controller.ts`). */
const NOTIFICATION_PATTERN = 'send';

/**
 * Cognito **CreateAuthChallenge** trigger — mints (or reuses) the sign-in code
 * and hands it to PRMS's own e-mail pipeline (`design.md` §18.1 step 4).
 *
 * - **Reuse before mint.** `challengeMetadata` carries `CODE-<code>` from one
 *   round to the next, so retrying a wrong code keeps the same code and sends
 *   **no** second e-mail (`OTP-R-32`).
 * - **The code never leaves the private parameters** except inside the e-mail;
 *   the client only ever sees the masked destination (`OTP-R-11`).
 * - **An unknown user gets a challenge anyway**, with a random masked
 *   destination and no e-mail (`design.md` §18.3).
 * - **A broker failure never fails the challenge**: the trigger logs
 *   `email_failed` and returns normally (`OTP-R-35`) — failing here would both
 *   break the flow and leak that the address exists.
 */
export const handler = async (
  event: CreateAuthChallengeTriggerEvent,
): Promise<CreateAuthChallengeTriggerEvent> => {
  const startedAt = Date.now();
  const session = event.request.session ?? [];
  const userNotFound = event.request.userNotFound === true;
  const email = event.request.userAttributes?.email;

  const previousCode = readCodeFromMetadata(
    session[session.length - 1]?.challengeMetadata,
  );
  const code = previousCode ?? generateCode();

  event.response.privateChallengeParameters = { answer: code };
  event.response.publicChallengeParameters = {
    destination: userNotFound ? randomMaskedDestination() : maskEmail(email),
  };
  event.response.challengeMetadata = encodeChallengeMetadata(code);

  let outcome: string;

  if (previousCode !== null) {
    outcome = 'code_reused';
  } else if (userNotFound) {
    // A decoy logs exactly what a real fresh challenge logs. A distinct
    // outcome here would turn CloudWatch into an enumeration oracle, so the
    // absence of a publish is the only trace (`design.md` §18.3).
    outcome = 'code_sent';
  } else {
    try {
      await publishEvent(
        process.env.MS_NOTIFICATION_QUEUE ?? '',
        NOTIFICATION_PATTERN,
        {
          auth: notificationAuth(),
          data: buildOtpEmailMessage(email, code),
        },
      );
      outcome = 'code_sent';
    } catch {
      // The error object can carry the broker URL (credentials included), so it
      // is deliberately neither logged nor rethrown (`OTP-R-11`).
      outcome = 'email_failed';
    }
  }

  logTrigger({
    event: 'create_auth_challenge',
    outcome,
    durationMs: Date.now() - startedAt,
    hasSession: session.length > 0,
    attempt: session.length,
  });

  return event;
};
