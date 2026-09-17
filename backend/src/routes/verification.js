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
router.post('/resend-verification', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        error: 'email_required'
      });
    }

    const [users] = await db.query(
      `SELECT id, name, email, email_verified
       FROM users
       WHERE email = ?`,
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: 'user_not_found'
      });
    }

    const user = users[0];

    if (user.email_verified) {
      return res.status(400).json({
        error: 'email_already_verified'
      });
    }

    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.query(
      `UPDATE users
       SET verification_token = ?, verification_expires = ?
       WHERE id = ?`,
      [token, expires, user.id]
    );

    try {
      const transporter = require('../mailer');

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Verify your Inventra account',
        text: `Hello ${user.name}, your verification token is: ${token}`
      });
    } catch (emailError) {
      console.error('Resend verification email error:', emailError.message);

      return res.status(503).json({
        error: 'email_send_failed'
      });
    }

    res.json({
      message: 'verification_sent'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      error: 'server_error'
    });
  }
});
