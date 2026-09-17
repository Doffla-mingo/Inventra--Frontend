const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.put('/', authenticateToken, async (req, res) => {
  try {
    const { name, store_name, notifications } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        error: 'name_required'
      });
    }

    if (
      notifications !== undefined &&
      (typeof notifications !== 'object' || notifications === null)
    ) {
      return res.status(400).json({
        error: 'invalid_notifications'
      });
    }

    const notificationJson =
      notifications === undefined
        ? null
        : JSON.stringify(notifications);

    if (notifications === undefined) {
      await db.execute(
        `UPDATE users
         SET name = ?, store_name = ?
         WHERE id = ?`,
        [
          name.trim(),
          store_name?.trim() || null,
          req.user.id
        ]
      );
    } else {
      await db.execute(
        `UPDATE users
         SET name = ?, store_name = ?, notifications = ?
         WHERE id = ?`,
        [
          name.trim(),
          store_name?.trim() || null,
          notificationJson,
          req.user.id
        ]
      );
    }

    const [users] = await db.execute(
      `SELECT id, name, email, store_name, role,
              notifications, email_verified
       FROM users
       WHERE id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: 'user_not_found'
      });
    }

    res.json({
      message: 'profile_updated',
      user: users[0]
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      error: 'server_error'
    });
  }
});

module.exports = router;
