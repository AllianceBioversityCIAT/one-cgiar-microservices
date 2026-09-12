import type { VerifyAuthChallengeResponseTriggerEvent } from 'aws-lambda';

import { codesMatch } from './lib/code';
import { logTrigger } from './lib/logger';

/**
 * Cognito **VerifyAuthChallengeResponse** trigger (`design.md` §18.1 step 7).
 *
 * `answerCorrect = timingSafeEqual(answer, privateChallengeParameters.answer)`
 * (`OTP-R-34`). An unknown user is rejected unconditionally: Cognito still runs
 * Create for it (so the flow looks real), but no answer may ever be accepted.
 *
 * The trigger owns only the single-answer decision — the attempt counting and
 * the `NotAuthorizedException` at three misses belong to DefineAuthChallenge.
 */
export const handler = async (
  event: VerifyAuthChallengeResponseTriggerEvent,
): Promise<VerifyAuthChallengeResponseTriggerEvent> => {
  const startedAt = Date.now();

  const expected = event.request.privateChallengeParameters?.answer;
  const answerCorrect =
    event.request.userNotFound !== true &&
    codesMatch(event.request.challengeAnswer, expected);

  event.response.answerCorrect = answerCorrect;

  logTrigger({
    event: 'verify_auth_challenge_response',
    outcome: answerCorrect ? 'answer_accepted' : 'answer_rejected',
    durationMs: Date.now() - startedAt,
    hasSession: false,
  });

  return event;
};
