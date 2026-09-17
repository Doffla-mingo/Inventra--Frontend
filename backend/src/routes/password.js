const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.put('/', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        error: 'current_password_and_new_password_required'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        error: 'password_must_be_at_least_6_characters'
      });
    }

    if (current_password === new_password) {
      return res.status(400).json({
        error: 'new_password_must_be_different'
      });
    }

    const [users] = await db.execute(
      `SELECT password_hash
       FROM users
       WHERE id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: 'user_not_found'
      });
    }

    const passwordMatches = await bcrypt.compare(
      current_password,
      users[0].password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: 'current_password_incorrect'
      });
    }

    const newPasswordHash = await bcrypt.hash(new_password, 12);

    await db.execute(
      `UPDATE users
       SET password_hash = ?
       WHERE id = ?`,
      [newPasswordHash, req.user.id]
    );

    res.json({
      message: 'password_updated'
    });
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({
      error: 'server_error'
    });
  }
});

module.exports = router;
