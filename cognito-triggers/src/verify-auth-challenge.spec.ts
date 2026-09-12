import type { VerifyAuthChallengeResponseTriggerEvent } from 'aws-lambda';

import { handler } from './verify-auth-challenge';

const EMAIL = 'someone@ibd.example.org';
const CODE = '482913';

function buildEvent(options: {
  answer?: unknown;
  expected?: unknown;
  userNotFound?: boolean;
}): VerifyAuthChallengeResponseTriggerEvent {
  return {
    version: '1',
    region: 'us-east-1',
    userPoolId: 'us-east-1_o9y9Yq5pO',
    userName: EMAIL,
    triggerSource: 'VerifyAuthChallengeResponse_Authentication',
    callerContext: { awsSdkVersion: '1', clientId: 'general-client' },
    request: {
      userAttributes: { email: EMAIL },
      privateChallengeParameters:
        options.expected === undefined ? {} : { answer: options.expected },
      challengeAnswer: options.answer,
      userNotFound: options.userNotFound ?? false,
    },
    response: { answerCorrect: false },
  } as unknown as VerifyAuthChallengeResponseTriggerEvent;
}

describe('verify-auth-challenge (design.md §18.1 step 7)', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('accepts the code that was e-mailed', async () => {
    const result = await handler(buildEvent({ answer: CODE, expected: CODE }));

    expect(result.response.answerCorrect).toBe(true);
  });

  it('rejects a wrong code of the same length', async () => {
    const result = await handler(
      buildEvent({ answer: '482914', expected: CODE }),
    );

    expect(result.response.answerCorrect).toBe(false);
  });

  it('rejects a code of a different length', async () => {
    const result = await handler(
      buildEvent({ answer: '4829130', expected: CODE }),
    );

    expect(result.response.answerCorrect).toBe(false);
  });

  it.each([
    ['a missing answer', undefined],
    ['an empty answer', ''],
    ['a non-string answer', 482913],
  ])('rejects %s', async (_label, answer) => {
    const result = await handler(buildEvent({ answer, expected: CODE }));

    expect(result.response.answerCorrect).toBe(false);
  });

  it('rejects when Cognito carries no stored answer', async () => {
    const result = await handler(buildEvent({ answer: CODE }));

    expect(result.response.answerCorrect).toBe(false);
  });

  it('never accepts an unknown user, even when the answers match (design.md §18.3)', async () => {
    const result = await handler(
      buildEvent({ answer: CODE, expected: CODE, userNotFound: true }),
    );

    expect(result.response.answerCorrect).toBe(false);
  });

  it('returns the event Cognito passed in', async () => {
    const event = buildEvent({ answer: CODE, expected: CODE });

    await expect(handler(event)).resolves.toBe(event);
  });

  it.each([
    ['a correct answer', { answer: CODE, expected: CODE }],
    ['a wrong answer', { answer: '000000', expected: CODE }],
  ])('logs one record with no code or e-mail for %s (OTP-R-11)', async (
    _label,
    options,
  ) => {
    await handler(buildEvent(options));

    expect(logSpy).toHaveBeenCalledTimes(1);
    const serialised = JSON.stringify(logSpy.mock.calls);

    expect(serialised).not.toContain(CODE);
    expect(serialised).not.toContain('000000');
    expect(serialised).not.toContain(EMAIL);

    const record = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(record.event).toBe('verify_auth_challenge_response');
    expect(Object.keys(record).sort()).toEqual([
      'durationMs',
      'event',
      'hasSession',
      'outcome',
    ]);
  });

  it('distinguishes the two outcomes for operators', async () => {
    await handler(buildEvent({ answer: CODE, expected: CODE }));
    const accepted = JSON.parse(logSpy.mock.calls[0][0] as string).outcome;
    logSpy.mockClear();

    await handler(buildEvent({ answer: '000000', expected: CODE }));
    const rejected = JSON.parse(logSpy.mock.calls[0][0] as string).outcome;

    expect(accepted).toBe('answer_accepted');
    expect(rejected).toBe('answer_rejected');
  });
});
