import { maskEmail, randomMaskedDestination } from './mask';

describe('mask', () => {
  describe('maskEmail (Cognito-style first char + ***)', () => {
    it('masks a real address the way Cognito does', () => {
      expect(maskEmail('someone@ibd.example.org')).toBe('s***@i***');
    });

    it('keeps only the first character of each side', () => {
      expect(maskEmail('j.cadavid@cgiar.org')).toBe('j***@c***');
    });

    it.each([
      ['an address with no @', 'not-an-email'],
      ['an address starting with @', '@cgiar.org'],
      ['an address ending with @', 'someone@'],
      ['an empty string', ''],
      ['undefined', undefined],
      ['null', null],
    ])('falls back to a fully opaque mask for %s', (_label, value) => {
      expect(maskEmail(value as string | undefined)).toBe('****@****');
    });

    it('never leaks the local part beyond the first character', () => {
      expect(maskEmail('averylongmailbox@verylongdomain.org')).not.toContain(
        'verylong',
      );
    });
  });

  describe('randomMaskedDestination (design.md §18.3: unknown users get a decoy)', () => {
    it('has the same shape as a real masked destination', () => {
      for (let i = 0; i < 50; i += 1) {
        expect(randomMaskedDestination()).toMatch(/^[a-z]\*\*\*@[a-z]\*\*\*$/);
      }
    });

    it('varies across calls so it cannot be recognised as the unknown-user marker', () => {
      const seen = new Set<string>();
      for (let i = 0; i < 200; i += 1) seen.add(randomMaskedDestination());

      expect(seen.size).toBeGreaterThan(1);
    });

    it('never uses Math.random', () => {
      const mathRandom = jest.spyOn(Math, 'random');

      for (let i = 0; i < 50; i += 1) randomMaskedDestination();

      expect(mathRandom).not.toHaveBeenCalled();
    });
  });
});
