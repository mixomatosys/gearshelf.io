import bcrypt from 'bcryptjs';

// Password configuration
const SALT_ROUNDS = 12; // Higher is more secure but slower

export interface PasswordStrengthResult {
  isValid: boolean;
  score: number; // 0-4 (4 is strongest)
  feedback: string[];
}

/**
 * Hash a plain text password
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    throw new Error('Failed to hash password');
  }
}

/**
 * Compare plain text password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    throw new Error('Failed to compare password');
  }
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const feedback: string[] = [];
  let score = 0;

  // Check minimum length
  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters long');
  } else {
    score += 1;
  }

  // Check for lowercase letters
  if (!/[a-z]/.test(password)) {
    feedback.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }

  // Check for uppercase letters
  if (!/[A-Z]/.test(password)) {
    feedback.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }

  // Check for numbers
  if (!/\d/.test(password)) {
    feedback.push('Password must contain at least one number');
  } else {
    score += 1;
  }

  // Check for special characters
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    feedback.push('Password must contain at least one special character');
  } else {
    score += 1;
  }

  // Check for common patterns
  const commonPasswords = [
    'password', '123456', 'qwerty', 'admin', 'letmein', 
    'welcome', 'monkey', '1234567890', 'password123'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    feedback.push('Password is too common');
    score = Math.max(0, score - 2);
  }

  // Check for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    feedback.push('Avoid repeating characters');
    score = Math.max(0, score - 1);
  }

  // Bonus points for longer passwords
  if (password.length >= 12) {
    score = Math.min(5, score + 1);
  }

  const isValid = score >= 4 && feedback.length === 0;

  return {
    isValid,
    score: Math.min(4, score),
    feedback
  };
}

/**
 * Generate a secure random password
 */
export function generateSecurePassword(length: number = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one character from each required set
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}