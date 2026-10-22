import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

/**
 * Health check endpoint for container orchestration and uptime monitoring.
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * API status and version information endpoint.
 */
router.get('/status', (_req: Request, res: Response) => {
  res.status(200).json({
    service: 'PortfolioHub API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * Global route-level error handler wrapper for asynchronous route controllers.
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

export default router;
