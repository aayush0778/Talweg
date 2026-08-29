import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async Express request handler and forwards any unhandled
 * rejections/exceptions to Express's next() error handling middleware.
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
