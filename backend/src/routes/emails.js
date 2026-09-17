const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 20, 1),
      100
    );

    const [rows] = await db.query(
      `SELECT id, status, sent_at, subject, to_email
       FROM emails
       ORDER BY sent_at DESC
       LIMIT ${limit}`
    );

    res.json(rows);
  } catch (error) {
    console.error('Get emails error:', error);
    res.status(500).json({
      error: 'server_error'
    });
  }
});

module.exports = router;
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const userEmail = req.user.email;

    if (
      !process.env.EMAIL_USER ||
      !process.env.EMAIL_PASS ||
      process.env.EMAIL_USER === 'placeholder' ||
      process.env.EMAIL_PASS === 'placeholder'
    ) {
      await db.query(
        `INSERT INTO emails (status, subject, to_email)
         VALUES (?, ?, ?)`,
        ['failed', 'Inventra Test Email', userEmail]
      );

      return res.status(503).json({
        error: 'email_not_configured'
      });
    }

    const transporter = require('../mailer');

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: 'Inventra Test Email',
      text: 'This is a test email from Inventra.'
    });

    await db.query(
      `INSERT INTO emails (status, subject, to_email)
       VALUES (?, ?, ?)`,
      ['sent', 'Inventra Test Email', userEmail]
    );

    res.json({
      message: 'test_email_sent'
    });
  } catch (error) {
    console.error('Test email error:', error);

    try {
      await db.query(
        `INSERT INTO emails (status, subject, to_email)
         VALUES (?, ?, ?)`,
        ['failed', 'Inventra Test Email', req.user.email]
      );
    } catch (logError) {
      console.error('Email log error:', logError);
    }

    res.status(500).json({
      error: 'email_send_failed'
    });
  }
});
