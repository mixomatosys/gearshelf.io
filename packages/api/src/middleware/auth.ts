import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../utils/jwt';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Extract token from request headers or cookies
 */
function extractToken(req: Request): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookies (for web sessions)
  const cookieToken = req.cookies?.accessToken;
  if (cookieToken) {
    return cookieToken;
  }

  // Check query parameter (not recommended but sometimes needed)
  const queryToken = req.query.token as string;
  if (queryToken) {
    return queryToken;
  }

  return null;
}

/**
 * Middleware to authenticate JWT tokens
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'No token provided'
    });
    return;
  }

  try {
    const decoded: JWTPayload = verifyToken(token);

    // Verify it's an access token
    if (decoded.type !== 'access') {
      res.status(401).json({
        error: 'Invalid token type',
        message: 'Access token required'
      });
      return;
    }

    // Add user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    res.status(401).json({
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'Invalid token'
    });
    return;
  }
}

/**
 * Middleware to require specific role
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'No user information available'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        message: `Required role: ${roles.join(' or ')}, current role: ${req.user.role}`
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware to require admin or moderator role
 */
export const requireModerator = requireRole('admin', 'moderator');

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    // No token provided, continue without user info
    next();
    return;
  }

  try {
    const decoded: JWTPayload = verifyToken(token);

    if (decoded.type === 'access') {
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      };
    }
  } catch (error) {
    // Invalid token, continue without user info
    // (don't send error response for optional auth)
  }

  next();
}

/**
 * Middleware to ensure user can only access their own resources
 */
export function requireOwnership(userIdParam: string = 'userId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    const resourceUserId = parseInt(req.params[userIdParam]);
    
    if (isNaN(resourceUserId)) {
      res.status(400).json({
        error: 'Invalid user ID',
        message: 'User ID must be a number'
      });
      return;
    }

    // Admin can access any resource
    if (req.user.role === 'admin') {
      next();
      return;
    }

    // User can only access their own resources
    if (req.user.userId !== resourceUserId) {
      res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own resources'
      });
      return;
    }

    next();
  };
}