import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

export function errorHandler(
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('API Error:', {
    message: error.message,
    status: error.status || 500,
    stack: error.stack,
    url: req.url,
    method: req.method,
  });

  const status = error.status || 500;
  const message = error.message || 'Internal Server Error';

  res.status(status).json({
    error: {
      message,
      status,
      timestamp: new Date().toISOString(),
      path: req.url,
    },
  });
}

// Helper to create API errors
export function createError(message: string, status: number = 500): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  return error;
}