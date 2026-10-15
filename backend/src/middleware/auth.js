const jwt = require('jsonwebtoken');
const db = require('../db');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;

  if (!token) {
    return res.status(401).json({ error: 'authentication_required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [users] = await db.execute(
      'SELECT email_verified FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0 || !users[0].email_verified) {
      return res.status(403).json({ error: 'email_not_verified' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'invalid_or_expired_token' });
    }
    console.error('Authentication check error:', error);
    return res.status(500).json({ error: 'authentication_check_failed' });
  }
}

module.exports = authenticateToken;
