import { jwtVerify } from 'jose';

const AUTH_TOKEN_SECRET = new TextEncoder().encode(
  process.env.AUTH_TOKEN_SECRET || 'fallback-secret-change-me'
);

const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

export async function verifyAuthToken(token: string): Promise<{ valid: boolean; clientId?: string }> {
  // Plain text shared secret mode (default for n8n/webhooks)
  if (AUTH_TOKEN && token === AUTH_TOKEN) {
    return { valid: true, clientId: 'n8n' };
  }

  // JWT verification mode (backward compatibility)
  try {
    const { payload } = await jwtVerify(token, AUTH_TOKEN_SECRET, {
      clockTolerance: 60,
    });
    if (typeof payload.clientId === 'string') {
      return { valid: true, clientId: payload.clientId };
    }
    if (typeof payload.sub === 'string') {
      return { valid: true, clientId: payload.sub };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
