import { randomInt, timingSafeEqual } from 'node:crypto';

/** Number of digits in a sign-in code (`OTP-R-34`). */
export const CODE_LENGTH = 6;

/**
 * Prefix used to carry the active code inside Cognito's `challengeMetadata`.
 * `challengeMetadata` stays inside the Cognito session: it is never returned to
 * the client (`design.md` §18.3).
 */
export const CODE_METADATA_PREFIX = 'CODE-';

/**
 * `OTP-R-34` — a 6-digit code drawn from the CSPRNG. `Math.random` is not an
 * acceptable source: `crypto.randomInt` is rejection-sampled and unbiased over
 * the whole `[0, 1_000_000)` range.
 */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(CODE_LENGTH, '0');
}

/** Builds the `challengeMetadata` value that carries `code` to the next attempt. */
export function encodeChallengeMetadata(code: string): string {
  return `${CODE_METADATA_PREFIX}${code}`;
}

/**
 * Reads back a code stored by {@link encodeChallengeMetadata}. Returns `null`
 * when the metadata does not carry one, which is the signal to mint a fresh
 * code and send a new e-mail.
 */
export function readCodeFromMetadata(
  metadata: string | undefined | null,
): string | null {
  if (typeof metadata !== 'string') return null;
  if (!metadata.startsWith(CODE_METADATA_PREFIX)) return null;

  const code = metadata.slice(CODE_METADATA_PREFIX.length);
  return code.length > 0 ? code : null;
}

/**
 * `OTP-R-34` — constant-time comparison of the submitted answer against the
 * code held in `privateChallengeParameters`. `timingSafeEqual` throws on
 * mismatched lengths, so a length difference short-circuits to `false`; the
 * length of a 6-digit code is not a secret.
 */
export function codesMatch(answer: unknown, expected: unknown): boolean {
  if (typeof answer !== 'string' || typeof expected !== 'string') return false;
  if (answer.length === 0 || expected.length === 0) return false;

  const candidate = Buffer.from(answer, 'utf8');
  const reference = Buffer.from(expected, 'utf8');
  if (candidate.length !== reference.length) return false;

  return timingSafeEqual(candidate, reference);
}
