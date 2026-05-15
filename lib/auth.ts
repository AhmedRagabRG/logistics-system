import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;
const COMMON_PASSWORDS = new Set([
  'admin',
  'admin123',
  'password',
  'password123',
  'qwerty123',
  'letmein',
  'welcome',
  '12345678',
  '123456789',
  'changeme',
]);

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}

export function validatePasswordStrength(plainPassword: string, username?: string): string[] {
  const errors: string[] = [];
  const normalized = plainPassword.toLowerCase();
  const normalizedUsername = username?.toLowerCase();

  if (plainPassword.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  if (plainPassword.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`);
  }

  if (plainPassword.trim() !== plainPassword) {
    errors.push('Password cannot start or end with spaces.');
  }

  if (!/[a-z]/.test(plainPassword)) {
    errors.push('Password must include a lowercase letter.');
  }

  if (!/[A-Z]/.test(plainPassword)) {
    errors.push('Password must include an uppercase letter.');
  }

  if (!/[0-9]/.test(plainPassword)) {
    errors.push('Password must include a number.');
  }

  if (!/[^A-Za-z0-9]/.test(plainPassword)) {
    errors.push('Password must include a symbol.');
  }

  if (COMMON_PASSWORDS.has(normalized)) {
    errors.push('Password is too common.');
  }

  if (normalizedUsername && normalized.includes(normalizedUsername)) {
    errors.push('Password cannot contain the username.');
  }

  return errors;
}
