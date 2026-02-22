import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { Pool } from 'pg';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/password';
import { generateTokenPair, verifyToken, hashToken } from '../utils/jwt';
import { authenticateToken } from '../middleware/auth';
import { 
  RegisterRequest, 
  LoginRequest, 
  RefreshTokenRequest,
  AuthResponse,
  User 
} from '../types/auth';

const router = Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).max(255).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

/**
 * POST /auth/register
 * Register a new user account
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    const { email, password, name }: RegisterRequest = value;

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'Password too weak',
        message: 'Password does not meet security requirements',
        feedback: passwordValidation.feedback
      });
    }

    const pool: Pool = req.app.get('db');

    // Check if user already exists
    const existingUserQuery = 'SELECT id FROM users WHERE email = $1';
    const existingUser = await pool.query(existingUserQuery, [email.toLowerCase()]);

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Email already exists',
        message: 'An account with this email already exists'
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const insertUserQuery = `
      INSERT INTO users (email, password_hash, name, role, is_verified, is_active)
      VALUES ($1, $2, $3, 'user', false, true)
      RETURNING id, email, name, role, is_verified, is_active, avatar_url, bio, created_at, updated_at
    `;

    const newUser = await pool.query(insertUserQuery, [
      email.toLowerCase(),
      passwordHash,
      name
    ]);

    const user: User = newUser.rows[0];

    // Generate tokens
    const tokens = generateTokenPair(user.id, user.email, user.role);

    // Store refresh token in database
    const sessionQuery = `
      INSERT INTO user_sessions (user_id, token_hash, device_info, ip_address, expires_at)
      VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')
    `;

    await pool.query(sessionQuery, [
      user.id,
      hashToken(tokens.refreshToken),
      JSON.stringify({ userAgent: req.headers['user-agent'] }),
      req.ip
    ]);

    // Create default "Favorites" collection
    const defaultCollectionQuery = `
      INSERT INTO user_plugin_collections (user_id, name, description, is_public, color)
      VALUES ($1, 'Favorites', 'My favorite plugins', false, '#ff6b6b')
    `;
    await pool.query(defaultCollectionQuery, [user.id]);

    const response: AuthResponse = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_verified: user.is_verified,
        is_active: user.is_active,
        avatar_url: user.avatar_url,
        bio: user.bio,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn
      }
    };

    res.status(201).json({
      message: 'Account created successfully',
      ...response
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create account'
    });
  }
});

/**
 * POST /auth/login
 * Authenticate user and return tokens
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    const { email, password }: LoginRequest = value;
    const pool: Pool = req.app.get('db');

    // Find user by email
    const userQuery = `
      SELECT id, email, password_hash, name, role, is_verified, is_active, avatar_url, bio, created_at, updated_at
      FROM users 
      WHERE email = $1 AND is_active = true
    `;
    const userResult = await pool.query(userQuery, [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    // Generate tokens
    const tokens = generateTokenPair(user.id, user.email, user.role);

    // Store refresh token in database
    const sessionQuery = `
      INSERT INTO user_sessions (user_id, token_hash, device_info, ip_address, expires_at)
      VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')
    `;

    await pool.query(sessionQuery, [
      user.id,
      hashToken(tokens.refreshToken),
      JSON.stringify({ userAgent: req.headers['user-agent'] }),
      req.ip
    ]);

    const response: AuthResponse = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_verified: user.is_verified,
        is_active: user.is_active,
        avatar_url: user.avatar_url,
        bio: user.bio,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn
      }
    };

    res.json({
      message: 'Login successful',
      ...response
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to authenticate user'
    });
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = refreshTokenSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    const { refreshToken }: RefreshTokenRequest = value;

    // Verify refresh token
    const decoded = verifyToken(refreshToken);
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        error: 'Invalid token type',
        message: 'Refresh token required'
      });
    }

    const pool: Pool = req.app.get('db');

    // Check if refresh token exists in database
    const sessionQuery = `
      SELECT us.*, u.email, u.role, u.is_active
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.token_hash = $1 AND us.expires_at > NOW()
    `;
    const sessionResult = await pool.query(sessionQuery, [hashToken(refreshToken)]);

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        message: 'Token not found or expired'
      });
    }

    const session = sessionResult.rows[0];

    if (!session.is_active) {
      return res.status(401).json({
        error: 'Account disabled',
        message: 'User account is not active'
      });
    }

    // Generate new access token
    const newTokens = generateTokenPair(decoded.userId, session.email, session.role);

    // Update session with new refresh token
    const updateSessionQuery = `
      UPDATE user_sessions 
      SET token_hash = $1, last_used = NOW(), expires_at = NOW() + INTERVAL '7 days'
      WHERE id = $2
    `;
    await pool.query(updateSessionQuery, [hashToken(newTokens.refreshToken), session.id]);

    res.json({
      message: 'Token refreshed successfully',
      tokens: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresIn: newTokens.expiresIn
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Token refresh failed',
      message: 'Invalid or expired refresh token'
    });
  }
});

/**
 * POST /auth/logout
 * Logout user and invalidate tokens
 */
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const pool: Pool = req.app.get('db');

    // Get refresh token from request (could be in body or header)
    const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'];

    if (refreshToken) {
      // Delete specific session
      const deleteSessionQuery = 'DELETE FROM user_sessions WHERE token_hash = $1 AND user_id = $2';
      await pool.query(deleteSessionQuery, [hashToken(refreshToken), req.user!.userId]);
    } else {
      // Delete all sessions for user (logout from all devices)
      const deleteAllSessionsQuery = 'DELETE FROM user_sessions WHERE user_id = $1';
      await pool.query(deleteAllSessionsQuery, [req.user!.userId]);
    }

    res.json({
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to logout'
    });
  }
});

/**
 * GET /auth/me
 * Get current user info
 */
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const pool: Pool = req.app.get('db');

    const userQuery = `
      SELECT id, email, name, role, is_verified, is_active, avatar_url, bio, created_at, updated_at,
             (SELECT COUNT(*) FROM user_plugin_collections WHERE user_id = users.id) as collection_count,
             (SELECT COUNT(*) FROM user_plugin_reviews WHERE user_id = users.id) as review_count
      FROM users 
      WHERE id = $1 AND is_active = true
    `;
    const userResult = await pool.query(userQuery, [req.user!.userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User account does not exist or is inactive'
      });
    }

    const user = userResult.rows[0];

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_verified: user.is_verified,
        is_active: user.is_active,
        avatar_url: user.avatar_url,
        bio: user.bio,
        created_at: user.created_at,
        updated_at: user.updated_at,
        stats: {
          collection_count: parseInt(user.collection_count),
          review_count: parseInt(user.review_count)
        }
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get user information'
    });
  }
});

export default router;