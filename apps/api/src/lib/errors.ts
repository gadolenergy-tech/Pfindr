/** Anything thrown as an AppError becomes a clean JSON error response. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, "BAD_REQUEST", message, details);

export const unauthorized = (message = "You are not signed in") =>
  new AppError(401, "UNAUTHORIZED", message);

export const forbidden = (message = "You do not have access to this") =>
  new AppError(403, "FORBIDDEN", message);

export const notFound = (message = "Not found") =>
  new AppError(404, "NOT_FOUND", message);

export const conflict = (message: string) =>
  new AppError(409, "CONFLICT", message);

export const tooManyRequests = (message = "Too many requests") =>
  new AppError(429, "TOO_MANY_REQUESTS", message);

export const notImplemented = (message: string) =>
  new AppError(501, "NOT_IMPLEMENTED", message);
