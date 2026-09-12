import type { DefineAuthChallengeTriggerEvent } from 'aws-lambda';

import { handler } from './define-auth-challenge';

/** `@types/aws-lambda` does not re-export `CustomChallengeResult` publicly. */
type SessionEntry =
  DefineAuthChallengeTriggerEvent['request']['session'][number];

const EMAIL = 'someone@cgiar.org';

function miss(): SessionEntry {
  return {
    challengeName: 'CUSTOM_CHALLENGE',
    challengeResult: false,
    challengeMetadata: 'CODE-482913',
  };
}

function hit(): SessionEntry {
  return {
    challengeName: 'CUSTOM_CHALLENGE',
    challengeResult: true,
    challengeMetadata: 'CODE-482913',
  };
}

function buildEvent(
  session: SessionEntry[],
  userNotFound = false,
): DefineAuthChallengeTriggerEvent {
  return {
    version: '1',
    region: 'us-east-1',
    userPoolId: 'us-east-1_o9y9Yq5pO',
    userName: EMAIL,
    triggerSource: 'DefineAuthChallenge_Authentication',
    callerContext: { awsSdkVersion: '1', clientId: 'general-client' },
    request: {
      userAttributes: { email: EMAIL },
      session,
      userNotFound,
    },
    response: {
      challengeName: '',
      issueTokens: false,
      failAuthentication: false,
    },
  } as DefineAuthChallengeTriggerEvent;
}

describe('define-auth-challenge (design.md §18.1 steps 3 and 8)', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('issues a CUSTOM_CHALLENGE on the first call', async () => {
    const result = await handler(buildEvent([]));

    expect(result.response).toEqual({
      challengeName: 'CUSTOM_CHALLENGE',
      issueTokens: false,
      failAuthentication: false,
    });
  });

  it('issues tokens when the last challenge was answered correctly', async () => {
    const result = await handler(buildEvent([hit()]));

    expect(result.response.issueTokens).toBe(true);
    expect(result.response.failAuthentication).toBe(false);
  });

  it('issues another CUSTOM_CHALLENGE after the first wrong code', async () => {
    const result = await handler(buildEvent([miss()]));

    expect(result.response).toEqual({
      challengeName: 'CUSTOM_CHALLENGE',
      issueTokens: false,
      failAuthentication: false,
    });
  });

  it('issues another CUSTOM_CHALLENGE after the second wrong code', async () => {
    const result = await handler(buildEvent([miss(), miss()]));

    expect(result.response.challengeName).toBe('CUSTOM_CHALLENGE');
    expect(result.response.failAuthentication).toBe(false);
  });

  it('fails authentication after the third wrong code (OTP-R-34: 3 attempts)', async () => {
    const result = await handler(buildEvent([miss(), miss(), miss()]));

    expect(result.response.failAuthentication).toBe(true);
    expect(result.response.issueTokens).toBe(false);
  });

  it('still issues tokens when the third attempt is the correct one', async () => {
    const result = await handler(buildEvent([miss(), miss(), hit()]));

    expect(result.response.issueTokens).toBe(true);
    expect(result.response.failAuthentication).toBe(false);
  });

  it('issues a challenge for an unknown user, byte-identical to a known one (design.md §18.3)', async () => {
    const known = await handler(buildEvent([]));
    const knownResponse = { ...known.response };
    const knownLog = JSON.parse(logSpy.mock.calls[0][0] as string);
    logSpy.mockClear();

    const unknown = await handler(buildEvent([], true));

    expect(unknown.response).toEqual(knownResponse);
    const unknownLog = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(unknownLog.outcome).toBe(knownLog.outcome);
  });

  it('fails an unknown user after three attempts, exactly like a known one', async () => {
    const result = await handler(buildEvent([miss(), miss(), miss()], true));

    expect(result.response.failAuthentication).toBe(true);
  });

  it('returns the event Cognito passed in', async () => {
    const event = buildEvent([]);

    await expect(handler(event)).resolves.toBe(event);
  });

  it('logs one record with the agreed fields and no secrets (OTP-R-11)', async () => {
    await handler(buildEvent([miss()]));

    expect(logSpy).toHaveBeenCalledTimes(1);
    const record = JSON.parse(logSpy.mock.calls[0][0] as string);

    expect(Object.keys(record).sort()).toEqual([
      'attempt',
      'durationMs',
      'event',
      'hasSession',
      'outcome',
    ]);
    expect(record.event).toBe('define_auth_challenge');
    expect(record.hasSession).toBe(true);
    expect(record.attempt).toBe(1);

    const serialised = JSON.stringify(logSpy.mock.calls);
    expect(serialised).not.toContain('482913');
    expect(serialised).not.toContain(EMAIL);
    expect(serialised).not.toContain('CODE-');
  });
});
