jest.mock('./lib/rmq-publisher', () => {
  const actual =
    jest.requireActual<typeof import('./lib/rmq-publisher')>(
      './lib/rmq-publisher',
    );
  return { ...actual, publishEvent: jest.fn().mockResolvedValue(undefined) };
});

import type { CreateAuthChallengeTriggerEvent } from 'aws-lambda';

import { handler } from './create-auth-challenge';
import { renderOtpEmailHtml, renderOtpEmailText } from './lib/email-template';
import { publishEvent } from './lib/rmq-publisher';

const publishEventMock = publishEvent as jest.MockedFunction<
  typeof publishEvent
>;

type SessionEntry =
  CreateAuthChallengeTriggerEvent['request']['session'][number];

const EMAIL = 'someone@ibd.example.org';
const PREVIOUS_CODE = '482913';

function attempt(challengeMetadata?: string): SessionEntry {
  return {
    challengeName: 'CUSTOM_CHALLENGE',
    challengeResult: false,
    challengeMetadata,
  };
}

function buildEvent(
  session: SessionEntry[] = [],
  userNotFound = false,
  userName: string = EMAIL,
): CreateAuthChallengeTriggerEvent {
  return {
    version: '1',
    region: 'us-east-1',
    userPoolId: 'us-east-1_o9y9Yq5pO',
    userName,
    triggerSource: 'CreateAuthChallenge_Authentication',
    callerContext: { awsSdkVersion: '1', clientId: 'general-client' },
    request: {
      userAttributes: { email: userName },
      challengeName: 'CUSTOM_CHALLENGE',
      session,
      userNotFound,
    },
    response: {
      publicChallengeParameters: {},
      privateChallengeParameters: {},
      challengeMetadata: '',
    },
  } as CreateAuthChallengeTriggerEvent;
}

describe('create-auth-challenge (design.md §18.1 step 4)', () => {
  const ORIGINAL_ENV = { ...process.env };
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.MS_NOTIFICATION_QUEUE = 'email-queue';
    process.env.MS_NOTIFICATION_USER = 'ms-user';
    process.env.MS_NOTIFICATION_PASSWORD = 'ms-pass';
    process.env.EMAIL_SENDER = 'PRMS-No-reply@cgiar.org';
    process.env.APP_URL = 'https://reporting.cgiar.org/';
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    publishEventMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  const record = () => JSON.parse(logSpy.mock.calls[0][0] as string);

  describe('a fresh challenge', () => {
    it('puts a 6-digit code in privateChallengeParameters.answer', async () => {
      const result = await handler(buildEvent());

      expect(result.response.privateChallengeParameters.answer).toMatch(
        /^\d{6}$/,
      );
    });

    it('publishes the masked destination, never the address (OTP-R-11)', async () => {
      const result = await handler(buildEvent());

      expect(result.response.publicChallengeParameters.destination).toBe(
        's***@i***',
      );
    });

    it('carries the code forward in challengeMetadata', async () => {
      const result = await handler(buildEvent());

      expect(result.response.challengeMetadata).toBe(
        `CODE-${result.response.privateChallengeParameters.answer}`,
      );
    });

    it('emits exactly the auth + ConfigMessageDto envelope on the notification queue (OTP-R-32)', async () => {
      const result = await handler(buildEvent());
      const code = result.response.privateChallengeParameters.answer;

      expect(publishEventMock).toHaveBeenCalledTimes(1);
      expect(publishEventMock).toHaveBeenCalledWith('email-queue', 'send', {
        auth: { username: 'ms-user', password: 'ms-pass' },
        data: {
          from: {
            email: 'PRMS-No-reply@cgiar.org',
            name: 'PRMS Reporting Tool',
          },
          emailBody: {
            subject: 'Your PRMS Reporting Tool sign-in code',
            to: EMAIL,
            cc: '',
            bcc: '',
            message: {
              text: renderOtpEmailText(code),
              socketFile: renderOtpEmailHtml(code),
            },
          },
        },
      });
    });

    it('sends the same code it stored as the answer', async () => {
      const result = await handler(buildEvent());
      const code = result.response.privateChallengeParameters.answer;

      const [, , payload] = publishEventMock.mock.calls[0] as [
        string,
        string,
        { data: { emailBody: { message: { socketFile: string } } } },
      ];
      expect(payload.data.emailBody.message.socketFile).toContain(code);
    });

    it('logs outcome code_sent', async () => {
      await handler(buildEvent());

      expect(record()).toMatchObject({
        event: 'create_auth_challenge',
        outcome: 'code_sent',
        hasSession: false,
        attempt: 0,
      });
    });
  });

  describe('a retry within the same session (OTP-R-32: one e-mail per session)', () => {
    it('reuses the code carried in the last challengeMetadata', async () => {
      const result = await handler(
        buildEvent([attempt(`CODE-${PREVIOUS_CODE}`)]),
      );

      expect(result.response.privateChallengeParameters.answer).toBe(
        PREVIOUS_CODE,
      );
      expect(result.response.challengeMetadata).toBe(`CODE-${PREVIOUS_CODE}`);
    });

    it('does not send a second e-mail', async () => {
      await handler(buildEvent([attempt(`CODE-${PREVIOUS_CODE}`)]));

      expect(publishEventMock).not.toHaveBeenCalled();
    });

    it('reuses the code across the second and third attempts too', async () => {
      const result = await handler(
        buildEvent([
          attempt(`CODE-${PREVIOUS_CODE}`),
          attempt(`CODE-${PREVIOUS_CODE}`),
        ]),
      );

      expect(result.response.privateChallengeParameters.answer).toBe(
        PREVIOUS_CODE,
      );
      expect(publishEventMock).not.toHaveBeenCalled();
    });

    it('logs outcome code_reused', async () => {
      await handler(buildEvent([attempt(`CODE-${PREVIOUS_CODE}`)]));

      expect(record()).toMatchObject({
        outcome: 'code_reused',
        hasSession: true,
        attempt: 1,
      });
    });

    it('mints a new code when the last entry carries no CODE- metadata', async () => {
      const result = await handler(buildEvent([attempt('SRP_A')]));

      expect(result.response.privateChallengeParameters.answer).not.toBe(
        PREVIOUS_CODE,
      );
      expect(result.response.privateChallengeParameters.answer).toMatch(
        /^\d{6}$/,
      );
      expect(publishEventMock).toHaveBeenCalledTimes(1);
    });

    it('mints a new code when the last entry has no metadata at all', async () => {
      const result = await handler(buildEvent([attempt(undefined)]));

      expect(result.response.privateChallengeParameters.answer).toMatch(
        /^\d{6}$/,
      );
      expect(publishEventMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('an unknown user (design.md §18.3: no enumeration signal)', () => {
    it('never publishes an e-mail', async () => {
      await handler(buildEvent([], true));

      expect(publishEventMock).not.toHaveBeenCalled();
    });

    it('still returns a usable challenge', async () => {
      const result = await handler(buildEvent([], true));

      expect(result.response.privateChallengeParameters.answer).toMatch(
        /^\d{6}$/,
      );
      expect(result.response.challengeMetadata).toMatch(/^CODE-\d{6}$/);
    });

    it('derives the destination from the submitted userName — byte-identical to what a real user with that email gets (no enumeration tell)', async () => {
      const unknown = await handler(
        buildEvent([], true, 'someone@icrisat.org'),
      );
      const known = await handler(
        buildEvent([], false, 'someone@icrisat.org'),
      );

      expect(unknown.response.publicChallengeParameters.destination).toBe(
        's***@i***',
      );
      expect(unknown.response.publicChallengeParameters.destination).toBe(
        known.response.publicChallengeParameters.destination,
      );
    });

    it('falls back to the opaque mask (never throws) when the submitted userName does not look like an email', async () => {
      const result = await handler(buildEvent([], true, 'not-an-email'));

      expect(result.response.publicChallengeParameters.destination).toBe(
        '****@****',
      );
    });

    it('logs the same record a real fresh challenge logs, so CloudWatch is not an enumeration oracle', async () => {
      await handler(buildEvent());
      const known = JSON.parse(logSpy.mock.calls[0][0] as string);
      logSpy.mockClear();

      await handler(buildEvent([], true));
      const unknown = JSON.parse(logSpy.mock.calls[0][0] as string);

      delete known.durationMs;
      delete unknown.durationMs;
      expect(unknown).toEqual(known);
      expect(unknown.outcome).toBe('code_sent');
    });

    it('logs code_reused on a retry, exactly like a real user', async () => {
      await handler(buildEvent([attempt(`CODE-${PREVIOUS_CODE}`)], true));

      expect(record()).toMatchObject({ outcome: 'code_reused' });
    });
  });

  describe('a broker failure (OTP-R-35)', () => {
    beforeEach(() => {
      publishEventMock.mockRejectedValue(new Error('ECONNREFUSED'));
    });

    it('still returns a usable challenge', async () => {
      const result = await handler(buildEvent());

      expect(result.response.privateChallengeParameters.answer).toMatch(
        /^\d{6}$/,
      );
      expect(result.response.publicChallengeParameters.destination).toBe(
        's***@i***',
      );
      expect(result.response.challengeMetadata).toMatch(/^CODE-\d{6}$/);
    });

    it('logs outcome email_failed', async () => {
      await handler(buildEvent());

      expect(record()).toMatchObject({ outcome: 'email_failed' });
    });

    it('does not let the broker error escape to Cognito', async () => {
      await expect(handler(buildEvent())).resolves.toBeDefined();
    });
  });

  describe('logging (OTP-R-11)', () => {
    it.each([
      ['a fresh challenge', () => buildEvent()],
      ['a retry', () => buildEvent([attempt(`CODE-${PREVIOUS_CODE}`)])],
      ['an unknown user', () => buildEvent([], true)],
    ])(
      'never writes the code, the e-mail or the session metadata for %s',
      async (_label, build) => {
        const result = await handler(build());
        const code = result.response.privateChallengeParameters.answer;

        expect(logSpy).toHaveBeenCalledTimes(1);
        const serialised = JSON.stringify(logSpy.mock.calls);

        expect(serialised).not.toContain(code);
        expect(serialised).not.toContain(EMAIL);
        expect(serialised).not.toContain('ibd.example.org');
        expect(serialised).not.toContain('CODE-');
        expect(Object.keys(record()).sort()).toEqual([
          'attempt',
          'durationMs',
          'event',
          'hasSession',
          'outcome',
        ]);
      },
    );

    it('never writes the broker credentials', async () => {
      await handler(buildEvent());

      const serialised = JSON.stringify(logSpy.mock.calls);
      expect(serialised).not.toContain('ms-user');
      expect(serialised).not.toContain('ms-pass');
    });
  });

  it('returns the event Cognito passed in', async () => {
    const event = buildEvent();

    await expect(handler(event)).resolves.toBe(event);
  });
});
