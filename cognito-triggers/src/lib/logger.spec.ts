import { logTrigger } from './logger';

describe('logger (OTP-R-11 / design.md §18.3)', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  const parseSingleLine = (): Record<string, unknown> => {
    expect(logSpy).toHaveBeenCalledTimes(1);
    const [line] = logSpy.mock.calls[0] as [string];
    expect(logSpy.mock.calls[0]).toHaveLength(1);
    expect(line).not.toContain('\n');
    return JSON.parse(line) as Record<string, unknown>;
  };

  it('writes one single-line JSON record with the agreed fields', () => {
    logTrigger({
      event: 'create_auth_challenge',
      outcome: 'code_sent',
      durationMs: 12,
      hasSession: false,
      attempt: 0,
    });

    expect(parseSingleLine()).toEqual({
      event: 'create_auth_challenge',
      outcome: 'code_sent',
      durationMs: 12,
      hasSession: false,
      attempt: 0,
    });
  });

  it('omits attempt when the trigger does not know it', () => {
    logTrigger({
      event: 'verify_auth_challenge_response',
      outcome: 'answer_rejected',
      durationMs: 3,
      hasSession: false,
    });

    expect(parseSingleLine()).toEqual({
      event: 'verify_auth_challenge_response',
      outcome: 'answer_rejected',
      durationMs: 3,
      hasSession: false,
    });
  });

  it('drops any field outside the allow-list, so a code or an e-mail cannot be logged by accident', () => {
    logTrigger({
      event: 'create_auth_challenge',
      outcome: 'code_sent',
      durationMs: 5,
      hasSession: true,
      code: '123456',
      email: 'someone@cgiar.org',
      session: 'AYABe...',
    } as never);

    const record = parseSingleLine();

    expect(Object.keys(record).sort()).toEqual([
      'durationMs',
      'event',
      'hasSession',
      'outcome',
    ]);
    expect(JSON.stringify(record)).not.toContain('123456');
    expect(JSON.stringify(record)).not.toContain('someone@cgiar.org');
    expect(JSON.stringify(record)).not.toContain('AYABe');
  });
});
