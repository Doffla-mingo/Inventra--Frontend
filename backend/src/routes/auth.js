const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const transporter = require('../mailer');
const db = require('../db');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, store_name } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'name, email and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'password must be at least 6 characters'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        error: 'email_already_registered'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const notifications = JSON.stringify({
      lowStock: true,
      expiry: true,
      expired: true,
      daily: false
    });

    const [result] = await db.execute(
      `INSERT INTO users
       (name, email, password_hash, store_name, role, notifications, verification_token, verification_expires)
       VALUES (?, ?, ?, ?, 'manager', ?, ?, ?)`,
      [
        name.trim(),
        normalizedEmail,
        passwordHash,
        store_name?.trim() || null,
        notifications,
        verificationToken,
        verificationExpires
      ]
    );

    const verificationLink = `http://localhost:3000/verify-email?token=${verificationToken}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: normalizedEmail,
      subject: 'Verify your Inventra account',
      text: `Welcome to Inventra! Verify your email using this link: ${verificationLink}`
    });

    res.status(201).json({
      message: 'verification_sent',
      user: {
        id: result.insertId,
        name: name.trim(),
        email: normalizedEmail,
        store_name: store_name?.trim() || null,
        role: 'manager'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'email and password are required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const [users] = await db.execute(
      `SELECT id, name, email, password_hash, store_name,
              role, notifications, email_verified
       FROM users
       WHERE email = ?`,
      [normalizedEmail]
    );

    if (users.length === 0) {
      return res.status(401).json({
        error: 'invalid_credentials'
      });
    }

    const user = users[0];

    if (!user.email_verified) {
      return res.status(403).json({
        error: 'email_not_verified'
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: 'invalid_credentials'
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    delete user.password_hash;

    res.json({
      token,
      user
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
