const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'verification_token_required' });
    }

    const [users] = await db.execute(
      `SELECT id, name, email, store_name, role, notifications,
              email_verified, verification_expires
       FROM users
       WHERE verification_token = ?`,
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: 'invalid_token' });
    }

    const user = users[0];

    if (
      user.verification_expires &&
      new Date(user.verification_expires) < new Date()
    ) {
      return res.status(400).json({ error: 'expired' });
    }

    await db.execute(
      `UPDATE users
       SET email_verified = TRUE,
           verification_token = NULL,
           verification_expires = NULL
       WHERE id = ?`,
      [user.id]
    );

    const jwtToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token: jwtToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        store_name: user.store_name,
        role: user.role,
        notifications: user.notifications,
        email_verified: true
      }
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
