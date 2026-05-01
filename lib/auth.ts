export const SESSION_COOKIE_NAME = 'session';
export const SESSION_JWT_EXPIRATION = '1y';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function getUserId(request: Request): number {
  const raw = request.headers.get('x-user-id');
  if (!raw) {
    throw new Error('x-user-id header missing — middleware did not run');
  }
  const userId = Number(raw);
  if (!Number.isInteger(userId)) {
    throw new Error(`x-user-id header is not an integer: ${raw}`);
  }
  return userId;
}
