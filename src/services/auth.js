const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'roofing_dashboard_secure_key_2026';

/**
 * Hash a password with scrypt and a unique salt
 */
function hashPassword(password, salt = null) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const resolvedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, resolvedSalt, 64).toString('hex');
  return { hash, salt: resolvedSalt };
}

/**
 * Verify a password against a hash and salt
 */
function verifyPassword(password, hash, salt) {
  if (!password || !hash || !salt) return false;
  try {
    const checkHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(checkHash, 'hex'));
  } catch (err) {
    console.error('[AUTH ERROR] Password verification failed:', err);
    return false;
  }
}

/**
 * Create a stateless HMAC-signed token
 */
function createToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.full_name || user.username,
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours expiry
  };
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${signature}`;
}

/**
 * Verify and decode an HMAC-signed token
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [head, body, signature] = parts;

  try {
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Express middleware to require a valid token
 */
function requireAuth(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }
  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please log in to access this resource.' });
  }

  req.user = user;
  next();
}

/**
 * Express middleware to require Administrator role
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required to perform this action.' });
  }
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  requireAuth,
  requireAdmin
};
