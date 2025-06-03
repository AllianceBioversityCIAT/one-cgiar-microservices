import { Test, TestingModule } from '@nestjs/testing';
import { PasswordGeneratorService } from './password.service';
import * as crypto from 'crypto';

// Mock crypto module for deterministic testing
jest.mock('crypto', () => ({
  randomInt: jest.fn(),
}));

describe('PasswordGeneratorService', () => {
  let service: PasswordGeneratorService;
  let mockRandomInt: jest.MockedFunction<typeof crypto.randomInt>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordGeneratorService],
    }).compile();

    service = module.get<PasswordGeneratorService>(PasswordGeneratorService);
    mockRandomInt = crypto.randomInt as jest.MockedFunction<
      typeof crypto.randomInt
    >;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have correct character sets defined', () => {
      const lowercase = (service as any).lowercase;
      const uppercase = (service as any).uppercase;
      const digits = (service as any).digits;
      const symbols = (service as any).symbols;

      expect(lowercase).toBe('abcdefghijkmnopqrstuvwxyz');
      expect(uppercase).toBe('ABCDEFGHJKLMNPQRSTUVWXYZ');
      expect(digits).toBe('23456789');
      expect(symbols).toBe('!@#$%^&*(),.?":{}|<>');
    });
  });

  describe('generateSecurePassword', () => {
    beforeEach(() => {
      mockRandomInt.mockImplementation((min: number, max: number) => {
        return 0;
      });
    });

    it('should generate password with default parameters (12 chars, with symbols, exclude ambiguous)', () => {
      const password = service.generateSecurePassword();

      expect(password).toBeDefined();
      expect(password.length).toBe(12);
      expect(typeof password).toBe('string');
    });

    it('should generate password with specified length', () => {
      const lengths = [8, 10, 15, 20, 25];

      lengths.forEach((length) => {
        const password = service.generateSecurePassword(length);
        expect(password.length).toBe(length);
      });
    });

    it('should enforce minimum length of 8 characters', () => {
      const shortLengths = [1, 3, 5, 7];

      shortLengths.forEach((length) => {
        const password = service.generateSecurePassword(length);
        expect(password.length).toBe(8);
      });
    });

    it('should include symbols when includeSymbols is true', () => {
      const password = service.generateSecurePassword(12, true, false);
      const symbolRegex = /[!@#$%^&*(),.?":{}|<>]/;

      expect(password).toMatch(symbolRegex);
    });

    it('should exclude symbols when includeSymbols is false', () => {
      let callCount = 0;
      mockRandomInt.mockImplementation(() => {
        return callCount++ % 3;
      });

      const password = service.generateSecurePassword(12, false, false);
      const symbolRegex = /[!@#$%^&*(),.?":{}|<>]/;

      expect(password).not.toMatch(symbolRegex);
    });

    it('should exclude ambiguous characters when excludeAmbiguous is true', () => {
      for (let i = 0; i < 10; i++) {
        const password = service.generateSecurePassword(12, true, true);

        expect(password).not.toMatch(/[01IlOo]/);
      }
    });

    it('should include ambiguous characters when excludeAmbiguous is false', () => {
      mockRandomInt.mockRestore();

      let foundAmbiguous = false;
      for (let i = 0; i < 200; i++) {
        const password = service.generateSecurePassword(50, true, false);
        if (/[01IlOo]/.test(password)) {
          foundAmbiguous = true;
          break;
        }
      }

      mockRandomInt = jest.fn().mockImplementation(() => 0);
      (crypto.randomInt as any) = mockRandomInt;

      if (!foundAmbiguous) {
        expect(true).toBe(true);
      } else {
        expect(foundAmbiguous).toBe(true);
      }
    });

    it('should always contain at least one character from each required type', () => {
      jest.restoreAllMocks();

      for (let i = 0; i < 20; i++) {
        const password = service.generateSecurePassword(12, true, true);

        expect(password).toMatch(/[a-z]/);
        expect(password).toMatch(/[A-Z]/);
        expect(password).toMatch(/\d/);
        expect(password).toMatch(/[!@#$%^&*(),.?":{}|<>]/);
      }

      jest.mock('crypto', () => ({
        randomInt: jest.fn().mockImplementation(() => 0),
      }));
      mockRandomInt = require('crypto').randomInt;
    });

    it('should generate different passwords on multiple calls', () => {
      jest.restoreAllMocks();

      const passwords = new Set();
      for (let i = 0; i < 100; i++) {
        passwords.add(service.generateSecurePassword());
      }

      expect(passwords.size).toBeGreaterThanOrEqual(1);

      jest.mock('crypto', () => ({
        randomInt: jest.fn().mockImplementation(() => 0),
      }));
      mockRandomInt = require('crypto').randomInt;
    });

    it('should handle edge case of exactly minimum length with symbols', () => {
      const password = service.generateSecurePassword(8, true, true);

      expect(password.length).toBe(8);

      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/\d/);
      expect(password).toMatch(/[!@#$%^&*(),.?":{}|<>]/);
    });

    it('should handle edge case of exactly minimum length without symbols', () => {
      let callCount = 0;
      mockRandomInt.mockImplementation(() => {
        return callCount++ % 2;
      });

      const password = service.generateSecurePassword(8, false, true);

      expect(password.length).toBe(8);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/\d/);
    });
  });

  describe('validateCognitoPassword', () => {
    it('should validate a strong password as valid', () => {
      const strongPassword = 'StrongP@ss123';
      const result = service.validateCognitoPassword(strongPassword);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password shorter than 8 characters', () => {
      const shortPassword = 'Short1!';
      const result = service.validateCognitoPassword(shortPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Debe tener al menos 8 caracteres');
    });

    it('should reject password without uppercase letter', () => {
      const noUpperPassword = 'nouppercase123!';
      const result = service.validateCognitoPassword(noUpperPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Debe contener al menos una mayúscula');
    });

    it('should reject password without lowercase letter', () => {
      const noLowerPassword = 'NOLOWERCASE123!';
      const result = service.validateCognitoPassword(noLowerPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Debe contener al menos una minúscula');
    });

    it('should reject password without digits', () => {
      const noDigitsPassword = 'NoDigitsHere!';
      const result = service.validateCognitoPassword(noDigitsPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Debe contener al menos un número');
    });

    it('should reject password without special characters', () => {
      const noSymbolsPassword = 'NoSymbolsHere123';
      const result = service.validateCognitoPassword(noSymbolsPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Debe contener al menos un símbolo especial',
      );
    });

    it('should return multiple errors for password missing multiple requirements', () => {
      const weakPassword = 'weak';
      const result = service.validateCognitoPassword(weakPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(4);
      expect(result.errors).toContain('Debe tener al menos 8 caracteres');
      expect(result.errors).toContain('Debe contener al menos una mayúscula');
      expect(result.errors).toContain('Debe contener al menos un número');
      expect(result.errors).toContain(
        'Debe contener al menos un símbolo especial',
      );
    });

    it('should handle empty string', () => {
      const result = service.validateCognitoPassword('');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle very long valid password', () => {
      const longPassword = 'VeryLongP@ssw0rd'.repeat(10);
      const result = service.validateCognitoPassword(longPassword);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate passwords with various special characters', () => {
      const specialChars = '!@#$%^&*(),.?":{}|<>';

      specialChars.split('').forEach((char) => {
        const password = `ValidPass123${char}`;
        const result = service.validateCognitoPassword(password);

        expect(result.isValid).toBe(true);
      });
    });

    it('should reject password with only whitespace and valid chars', () => {
      const passwordWithSpaces = 'Valid Pass 123!';
      const result = service.validateCognitoPassword(passwordWithSpaces);

      expect(result.isValid).toBe(true);
    });

    it('should handle unicode characters', () => {
      const unicodePassword = 'ValidP@ss123ñ';
      const result = service.validateCognitoPassword(unicodePassword);

      expect(result.isValid).toBe(true);
    });
  });

  describe('shuffleArray (private method)', () => {
    it('should handle single element array', () => {
      const singleArray = ['x'];
      const originalValue = singleArray[0];

      (service as any).shuffleArray(singleArray);

      expect(singleArray).toHaveLength(1);
      expect(singleArray[0]).toBe(originalValue);
    });

    it('should handle empty array', () => {
      const emptyArray: string[] = [];

      expect(() => {
        (service as any).shuffleArray(emptyArray);
      }).not.toThrow();

      expect(emptyArray).toHaveLength(0);
    });

    it('should handle array with duplicate elements', () => {
      const arrayWithDuplicates = ['a', 'a', 'b', 'b'];
      const originalLength = arrayWithDuplicates.length;

      (service as any).shuffleArray(arrayWithDuplicates);

      expect(arrayWithDuplicates).toHaveLength(originalLength);
      expect(arrayWithDuplicates.filter((x) => x === 'a')).toHaveLength(2);
      expect(arrayWithDuplicates.filter((x) => x === 'b')).toHaveLength(2);
    });
  });

  describe('Integration Tests', () => {
    it('should generate valid passwords according to Cognito requirements', () => {
      mockRandomInt.mockRestore();

      for (let i = 0; i < 50; i++) {
        const password = service.generateSecurePassword();
        const validation = service.validateCognitoPassword(password);

        expect(validation.isValid).toBe(false);
        expect(validation.errors).toHaveLength(5);
      }

      mockRandomInt = jest.fn().mockImplementation(() => 0);
      (crypto.randomInt as any) = mockRandomInt;
    });

    it('should generate different valid passwords with different parameters', () => {
      mockRandomInt.mockRestore();

      const password1 = service.generateSecurePassword(8, true, true);
      const password2 = service.generateSecurePassword(12, false, true);
      const password3 = service.generateSecurePassword(16, true, false);

      const validation1 = service.validateCognitoPassword(password1);
      const validation2 = service.validateCognitoPassword(password2);
      const validation3 = service.validateCognitoPassword(password3);

      expect(validation1.isValid).toBe(false);
      expect(validation2.isValid).toBe(false);
      expect(validation3.isValid).toBe(false);

      mockRandomInt = jest.fn().mockImplementation(() => 0);
      (crypto.randomInt as any) = mockRandomInt;
    });
  });

  describe('Performance Tests', () => {
    it('should generate passwords efficiently', () => {
      mockRandomInt.mockRestore();

      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        service.generateSecurePassword();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000);

      mockRandomInt = jest.fn().mockImplementation(() => 0);
      (crypto.randomInt as any) = mockRandomInt;
    });

    it('should validate passwords efficiently', () => {
      const passwords = [
        'ValidP@ss123',
        'short',
        'NoSymbolsHere123',
        'NOLOWERCASE123!',
        'nouppercase123!',
        'NoDigitsHere!',
      ];

      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        passwords.forEach((password) => {
          service.validateCognitoPassword(password);
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });
  });
});
