/**
 * Structured log record for a Cognito trigger invocation.
 *
 * `OTP-R-11` / `design.md` §18.3 — these are the *only* fields a trigger may
 * emit. Never the code, the e-mail, the Cognito session or broker credentials.
 */
export interface TriggerLogRecord {
  /** Trigger that ran, e.g. `create_auth_challenge`. */
  event: string;
  /** What happened, e.g. `code_sent`, `code_reused`, `email_failed`. */
  outcome: string;
  /** Wall-clock duration of the handler. */
  durationMs: number;
  /** Whether Cognito passed a non-empty challenge session. */
  hasSession: boolean;
  /** Number of previous challenge rounds, when the trigger knows it. */
  attempt?: number;
}

/**
 * Allow-list of loggable keys. Filtering structurally (rather than trusting
 * every call site) is what keeps a future refactor from leaking a code or an
 * address into CloudWatch.
 */
const LOGGABLE_KEYS = [
  'event',
  'outcome',
  'durationMs',
  'hasSession',
  'attempt',
] as const satisfies readonly (keyof TriggerLogRecord)[];

/** Emits one single-line JSON record on stdout (CloudWatch Logs). */
export function logTrigger(record: TriggerLogRecord): void {
  const safe: Record<string, unknown> = {};

  for (const key of LOGGABLE_KEYS) {
    const value = record[key];
    if (value !== undefined) safe[key] = value;
  }

  // eslint-disable-next-line no-console -- CloudWatch Logs is the only sink.
  console.log(JSON.stringify(safe));
}
