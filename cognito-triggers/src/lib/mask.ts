import { randomInt } from 'node:crypto';

const OPAQUE_MASK = '****@****';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';

/**
 * Masks an address the way Cognito masks `CodeDeliveryDetails.Destination`:
 * the first character of each side, everything else replaced by `***`
 * (`s***@i***`). The full address never leaves the trigger (`OTP-R-11`).
 */
export function maskEmail(email: string | undefined | null): string {
  if (typeof email !== 'string') return OPAQUE_MASK;

  const at = email.indexOf('@');
  if (at < 1 || at === email.length - 1) return OPAQUE_MASK;

  return `${email[0]}***@${email[at + 1]}***`;
}

/**
 * `design.md` §18.3 — an unknown user still gets a challenge with a masked
 * destination, so the response is indistinguishable from a real one. The mask
 * is drawn from the CSPRNG so it does not become the "unknown user" tell.
 */
export function randomMaskedDestination(): string {
  const pick = (): string => LOWERCASE[randomInt(0, LOWERCASE.length)];
  return `${pick()}***@${pick()}***`;
}
