import { SignJWT, jwtVerify } from 'jose';

const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'fallback-secret-change-me'
);

const SESSION_DURATION_SECONDS = 30 * 60; // 30 minutes

export async function createSessionToken(sessionId: string): Promise<string> {
  return new SignJWT({ sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS)
    .sign(SESSION_SECRET);
}

export async function verifySessionToken(token: string): Promise<{ sessionId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET, {
      clockTolerance: 60,
    });
    if (typeof payload.sessionId === 'string') {
      return { sessionId: payload.sessionId };
    }
    return null;
  } catch {
    return null;
  }
}
