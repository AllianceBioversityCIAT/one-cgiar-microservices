import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class PasswordGeneratorService {
  private readonly lowercase = 'abcdefghijkmnopqrstuvwxyz';
  private readonly uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  private readonly digits = '23456789';
  private readonly symbols = '!@#$%^&*(),.?":{}|<>';

  generateSecurePassword(
    length: number = 12,
    includeSymbols: boolean = true,
    excludeAmbiguous: boolean = true,
  ): string {
    if (length < 8) {
      length = 8;
    }

    const lowercase = excludeAmbiguous
      ? 'abcdefghijkmnopqrstuvwxyz'
      : this.lowercase;
    const uppercase = excludeAmbiguous
      ? 'ABCDEFGHJKLMNPQRSTUVWXYZ'
      : this.uppercase;
    const digits = excludeAmbiguous ? '23456789' : this.digits;
    const symbols = includeSymbols ? this.symbols : '';

    const passwordChars = [
      this.getRandomChar(lowercase),
      this.getRandomChar(uppercase),
      this.getRandomChar(digits),
    ];

    if (includeSymbols) {
      passwordChars.push(this.getRandomChar(symbols));
    }

    const allChars = lowercase + uppercase + digits + symbols;
    const remainingLength = length - passwordChars.length;

    for (let i = 0; i < remainingLength; i++) {
      passwordChars.push(this.getRandomChar(allChars));
    }

    this.shuffleArray(passwordChars);
    return passwordChars.join('');
  }

  validateCognitoPassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Debe tener al menos 8 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Debe contener al menos una mayúscula');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Debe contener al menos una minúscula');
    }
    if (!/\d/.test(password)) {
      errors.push('Debe contener al menos un número');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Debe contener al menos un símbolo especial');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private getRandomChar(chars: string): string {
    const randomIndex = crypto.randomInt(0, chars.length);
    return chars[randomIndex];
  }

  private shuffleArray(array: any[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
