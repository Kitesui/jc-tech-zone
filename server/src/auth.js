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
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

const COOKIE = 'jc_session';
const DAY_S = 24 * 60 * 60;

export function readCookie(req, name = COOKIE) {
  const m = (req.headers.cookie || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}

// HttpOnly keeps the token out of reach of page scripts (XSS); SameSite=Strict stops cross-site sends (CSRF).
export function setSessionCookie(req, res, token) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.append('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${DAY_S}${secure ? '; Secure' : ''}`);
}

export function clearSessionCookie(res) {
  res.append('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}

/**
 * Express middleware to guard routes by role
 * @param {string|string[]} roles - Allowed role(s), e.g. 'admin' or ['admin', 'technician']
 */
export function requireAuth(roles = []) {
  const allowed = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    const cookieToken = readCookie(req);
    const authHeader = req.headers.authorization;
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const user = verifyToken(cookieToken || bearer);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: valid staff authentication required' });
    }

    // Cookie-authenticated writes must come from our own JS (custom header can't be sent cross-site without CORS preflight)
    if (cookieToken && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers['x-requested-with'] !== 'XMLHttpRequest') {
      return res.status(403).json({ error: 'Forbidden: missing request header' });
    }

    if (allowed.length > 0 && !allowed.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role permissions' });
    }

    req.user = user;
    next();
  };
}
