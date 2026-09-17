const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, product_name, trigger_type, threshold, enabled, created_at FROM triggers ORDER BY id DESC'
    );

    res.json(rows);
  } catch (error) {
    console.error('Get triggers error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { product_name, trigger_type, threshold } = req.body;

    if (!product_name || !['quantity', 'expiry'].includes(trigger_type)) {
      return res.status(400).json({
        error: 'invalid_trigger'
      });
    }

    const parsedThreshold = Number(threshold);

    if (!Number.isInteger(parsedThreshold) || parsedThreshold < 0) {
      return res.status(400).json({
        error: 'invalid_threshold'
      });
    }

    const [result] = await db.query(
      `INSERT INTO triggers (product_name, trigger_type, threshold, enabled)
       VALUES (?, ?, ?, TRUE)`,
      [product_name.trim(), trigger_type, parsedThreshold]
    );

    const [rows] = await db.query(
      `SELECT id, product_name, trigger_type, threshold, enabled, created_at
       FROM triggers
       WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: 'trigger_created',
      trigger: rows[0]
    });
  } catch (error) {
    console.error('Create trigger error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'invalid_trigger_id'
      });
    }

    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'invalid_enabled_value'
      });
    }

    const [result] = await db.query(
      'UPDATE triggers SET enabled = ? WHERE id = ?',
      [enabled, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'trigger_not_found'
      });
    }

    const [rows] = await db.query(
      `SELECT id, product_name, trigger_type, threshold, enabled, created_at
       FROM triggers
       WHERE id = ?`,
      [id]
    );

    res.json({
      message: 'trigger_updated',
      trigger: rows[0]
    });
  } catch (error) {
    console.error('Update trigger error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'invalid_trigger_id'
      });
    }

    const [result] = await db.query(
      'DELETE FROM triggers WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'trigger_not_found'
      });
    }

    res.json({
      message: 'trigger_deleted',
      id
    });
  } catch (error) {
    console.error('Delete trigger error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});
router.post('/check', authenticateToken, async (req, res) => {
  try {
    const [triggerRows] = await db.query(
      `SELECT id, product_name, trigger_type, threshold, enabled
       FROM triggers
       WHERE enabled = TRUE`
    );

    const alerts = [];

    for (const trigger of triggerRows) {
      let query;
      let params;

      if (trigger.trigger_type === 'quantity') {
        query = `
          SELECT id, qr_code, name, quantity, expiry_date
          FROM products
          WHERE user_id = ?
            AND name = ?
            AND quantity <= ?
        `;
        params = [req.user.id, trigger.product_name, trigger.threshold];
      } else {
        query = `
          SELECT id, qr_code, name, quantity, expiry_date,
                 DATEDIFF(expiry_date, CURDATE()) AS days_until_expiry
          FROM products
          WHERE user_id = ?
            AND name = ?
            AND expiry_date >= CURDATE()
            AND DATEDIFF(expiry_date, CURDATE()) <= ?
        `;
        params = [req.user.id, trigger.product_name, trigger.threshold];
      }

      const [products] = await db.query(query, params);

      for (const product of products) {
        alerts.push({
          trigger_id: trigger.id,
          trigger_type: trigger.trigger_type,
          threshold: trigger.threshold,
          product
        });
      }
    }

    res.json({
      checked: triggerRows.length,
      alerts
    });
  } catch (error) {
    console.error('Trigger check error:', error);
    res.status(500).json({
      error: 'server_error'
    });
  }
});
