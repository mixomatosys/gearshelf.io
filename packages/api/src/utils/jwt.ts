import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  type: 'access' | 'refresh';
  exp?: number; // JWT expiration timestamp
  iat?: number; // JWT issued at timestamp
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

/**
 * Generate access token for user
 */
export function generateAccessToken(userId: number, email: string, role: string): string {
  const payload: JWTPayload = {
    userId,
    email,
    role,
    type: 'access'
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'gearshelf.io',
    audience: 'gearshelf-users'
  } as jwt.SignOptions);
}

/**
 * Generate refresh token for user
 */
export function generateRefreshToken(userId: number, email: string, role: string): string {
  const payload: JWTPayload = {
    userId,
    email,
    role,
    type: 'refresh'
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'gearshelf.io',
    audience: 'gearshelf-users'
  } as jwt.SignOptions);
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(userId: number, email: string, role: string): TokenPair {
  const accessToken = generateAccessToken(userId, email, role);
  const refreshToken = generateRefreshToken(userId, email, role);

  return {
    accessToken,
    refreshToken,
    expiresIn: JWT_EXPIRES_IN
  };
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'gearshelf.io',
      audience: 'gearshelf-users'
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

/**
 * Decode token without verification (for inspection)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Generate secure hash for token storage
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate secure random token
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    
    return Date.now() >= decoded.exp * 1000;
  } catch (error) {
    return true;
  }
}