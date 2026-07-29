export class UnauthenticatedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

export function isUnauthenticatedError(error: unknown): boolean {
  return error instanceof UnauthenticatedError;
}
