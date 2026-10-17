import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'jctechzone_secret_key_2026_marikina';

/**
 * Sign a payload into a stateless HMAC-signed token
 */
export function signToken(payload) {
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    })
  ).toString('base64url');

  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/**
 * Verify HMAC signature and expiration
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [body, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig !== expectedSig) return null;

  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Express middleware to guard routes by role
 * @param {string|string[]} roles - Allowed role(s), e.g. 'admin' or ['admin', 'technician']
 */
export function requireAuth(roles = []) {
  const allowed = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const user = verifyToken(token);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: valid staff authentication required' });
    }

    if (allowed.length > 0 && !allowed.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role permissions' });
    }

    req.user = user;
    next();
  };
}
