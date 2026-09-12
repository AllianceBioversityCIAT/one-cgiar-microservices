// Node 22 exports `node:crypto` members as non-configurable properties, so
// `jest.spyOn` cannot wrap them; a module factory that delegates to the real
// implementation is the only way to observe which primitive was used.
jest.mock('node:crypto', () => {
  const actual = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return {
    ...actual,
    randomInt: jest.fn(actual.randomInt),
    timingSafeEqual: jest.fn(actual.timingSafeEqual),
  };
});

import { randomInt, timingSafeEqual } from 'node:crypto';

import {
  CODE_METADATA_PREFIX,
  codesMatch,
  encodeChallengeMetadata,
  generateCode,
  readCodeFromMetadata,
} from './code';

const randomIntMock = randomInt as unknown as jest.Mock;
const timingSafeEqualMock = timingSafeEqual as unknown as jest.Mock;

describe('code', () => {
  describe('generateCode (OTP-R-34: 6 numeric digits from a CSPRNG)', () => {
    it('draws from crypto.randomInt over the full 6-digit space', () => {
      generateCode();

      expect(randomIntMock).toHaveBeenCalledWith(0, 1_000_000);
    });

    it('never uses Math.random', () => {
      const mathRandom = jest.spyOn(Math, 'random');

      for (let i = 0; i < 50; i += 1) generateCode();

      expect(mathRandom).not.toHaveBeenCalled();
    });

    it('zero-pads small draws to exactly 6 digits', () => {
      randomIntMock.mockReturnValueOnce(42);

      expect(generateCode()).toBe('000042');
    });

    it('returns 6 numeric digits for real draws', () => {
      for (let i = 0; i < 200; i += 1) {
        expect(generateCode()).toMatch(/^\d{6}$/);
      }
    });
  });

  describe('challengeMetadata (design.md §18.1 step 4: "CODE-<code>")', () => {
    it('encodes the code behind the CODE- prefix', () => {
      expect(encodeChallengeMetadata('123456')).toBe('CODE-123456');
      expect(CODE_METADATA_PREFIX).toBe('CODE-');
    });

    it('reads back a code written by encodeChallengeMetadata', () => {
      expect(readCodeFromMetadata(encodeChallengeMetadata('098765'))).toBe(
        '098765',
      );
    });

    it.each([
      ['metadata without the prefix', 'ATTEMPT-1'],
      ['an empty payload after the prefix', 'CODE-'],
      ['an empty string', ''],
      ['undefined', undefined],
      ['null', null],
    ])('returns null for %s', (_label, metadata) => {
      expect(readCodeFromMetadata(metadata as string | undefined)).toBeNull();
    });
  });

  describe('codesMatch (OTP-R-34: constant-time comparison)', () => {
    it('compares equal-length candidates with crypto.timingSafeEqual', () => {
      expect(codesMatch('123456', '123456')).toBe(true);

      expect(timingSafeEqualMock).toHaveBeenCalledTimes(1);
    });

    it('rejects a wrong code of the same length', () => {
      expect(codesMatch('123457', '123456')).toBe(false);
    });

    it('rejects a candidate of a different length without calling timingSafeEqual', () => {
      expect(codesMatch('12345', '123456')).toBe(false);

      expect(timingSafeEqualMock).not.toHaveBeenCalled();
    });

    it.each([
      ['a missing answer', undefined],
      ['a null answer', null],
      ['an empty answer', ''],
      ['a non-string answer', 123456],
    ])('rejects %s', (_label, answer) => {
      expect(codesMatch(answer, '123456')).toBe(false);
    });

    it('rejects when no expected code was stored', () => {
      expect(codesMatch('123456', undefined)).toBe(false);
    });
  });
});
