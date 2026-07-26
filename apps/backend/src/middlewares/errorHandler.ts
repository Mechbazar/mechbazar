import { NextFunction, Request, Response } from 'express';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const status = err?.status || err?.statusCode || 500;
  const isServerError = status >= 500;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isServerError) {
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  }

  // A 5xx `err.message` is whatever the underlying library produced, and for
  // Prisma that routinely includes the failing SQL, table and column names,
  // constraint names, and sometimes the offending values. Returning it to the
  // caller hands an attacker a free schema map. 4xx messages are ours and are
  // written to be shown to users, so those still pass through.
  const message = isServerError
    ? isProduction
      ? 'Internal server error'
      : err?.message || 'Internal server error'
    : err?.message || 'Request failed';

  res.status(status).json({
    error: message,
    ...(!isProduction && err?.stack ? { stack: err.stack } : {}),
  });
}
