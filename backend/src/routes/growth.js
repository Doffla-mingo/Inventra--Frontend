const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/history', authenticateToken, async (req, res) => {
  try {
    const days = Math.min(
      Math.max(Number(req.query.days) || 30, 1),
      365
    );

    const [rows] = await db.query(
      `SELECT id, snapshot_date, total_products, total_units,
              total_value, expired_count, low_stock_count,
              health_score, new_products_added
       FROM growth_snapshots
       WHERE snapshot_date >= DATE_SUB(CURDATE(), INTERVAL ${days - 1} DAY)
       ORDER BY snapshot_date ASC`
    );

    res.json(rows);
  } catch (error) {
    console.error('Growth history error:', error);
    res.status(500).json({
      error: 'server_error'
    });
  }
});

router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         snapshot_date,
         total_products,
         total_value,
         health_score
       FROM growth_snapshots
       WHERE snapshot_date >= DATE_SUB(CURDATE(), INTERVAL 31 DAY)
       ORDER BY snapshot_date ASC`
    );

    const latest = rows.length ? rows[rows.length - 1] : null;

    if (!latest) {
      return res.json({
        products_vs_week: 0,
        value_vs_week: 0,
        health_vs_week: 0,
        products_vs_month: 0,
        value_vs_month: 0,
        health_vs_month: 0
      });
    }

    const [weekRows] = await db.query(
      `SELECT total_products, total_value, health_score
       FROM growth_snapshots
       WHERE snapshot_date <= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       ORDER BY snapshot_date DESC
       LIMIT 1`
    );

    const [monthRows] = await db.query(
      `SELECT total_products, total_value, health_score
       FROM growth_snapshots
       WHERE snapshot_date <= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       ORDER BY snapshot_date DESC
       LIMIT 1`
    );

    const week = weekRows[0] || latest;
    const month = monthRows[0] || latest;

    const percentageChange = (current, previous) => {
      if (Number(previous) === 0) {
        return Number(current) === 0 ? 0 : 100;
      }

      return Number(
        (
          ((Number(current) - Number(previous)) / Number(previous)) *
          100
        ).toFixed(2)
      );
    };

    res.json({
      products_vs_week: percentageChange(
        latest.total_products,
        week.total_products
      ),

      value_vs_week: percentageChange(
        latest.total_value,
        week.total_value
      ),

      health_vs_week: percentageChange(
        latest.health_score,
        week.health_score
      ),

      products_vs_month: percentageChange(
        latest.total_products,
        month.total_products
      ),

      value_vs_month: percentageChange(
        latest.total_value,
        month.total_value
      ),

      health_vs_month: percentageChange(
        latest.health_score,
        month.health_score
      )
    });
  } catch (error) {
    console.error('Growth summary error:', error);
    res.status(500).json({
      error: 'server_error'
    });
  }
});

router.post('/snapshot', authenticateToken, async (req, res) => {
  try {
    const [statsRows] = await db.query(
      `SELECT
         COUNT(*) AS total_products,
         COALESCE(SUM(quantity), 0) AS total_units,
         COALESCE(SUM(quantity * price), 0) AS total_value,
         COALESCE(SUM(expiry_date < CURDATE()), 0) AS expired_count,
         COALESCE(SUM(quantity <= 5), 0) AS low_stock_count
       FROM products
       WHERE user_id = ?`,
      [req.user.id]
    );

    const stats = statsRows[0];

    const totalProducts = Number(stats.total_products);
    const totalUnits = Number(stats.total_units);
    const totalValue = Number(stats.total_value);
    const expiredCount = Number(stats.expired_count);
    const lowStockCount = Number(stats.low_stock_count);

    let healthScore = 100;

    if (totalProducts > 0) {
      const expiredRatio = expiredCount / totalProducts;
      const lowStockRatio = lowStockCount / totalProducts;

      healthScore = Math.max(
        0,
        Math.min(
          100,
          100 -
            (expiredRatio * 50) -
            (lowStockRatio * 25)
        )
      );
    }

    const [previousRows] = await db.query(
      `SELECT total_products
       FROM growth_snapshots
       WHERE snapshot_date < CURDATE()
       ORDER BY snapshot_date DESC
       LIMIT 1`
    );

    const previousProducts = previousRows.length
      ? Number(previousRows[0].total_products)
      : 0;

    const newProductsAdded = Math.max(
      0,
      totalProducts - previousProducts
    );

    await db.query(
      `INSERT INTO growth_snapshots
       (snapshot_date, total_products, total_units, total_value,
        expired_count, low_stock_count, health_score, new_products_added)
       VALUES (CURDATE(), ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_products = VALUES(total_products),
         total_units = VALUES(total_units),
         total_value = VALUES(total_value),
         expired_count = VALUES(expired_count),
         low_stock_count = VALUES(low_stock_count),
         health_score = VALUES(health_score),
         new_products_added = VALUES(new_products_added)`,
      [
        totalProducts,
        totalUnits,
        totalValue,
        expiredCount,
        lowStockCount,
        healthScore,
        newProductsAdded
      ]
    );

    const [rows] = await db.query(
      `SELECT id, snapshot_date, total_products, total_units,
              total_value, expired_count, low_stock_count,
              health_score, new_products_added
       FROM growth_snapshots
       WHERE snapshot_date = CURDATE()
       ORDER BY id DESC
       LIMIT 1`
    );

    res.json({
      message: 'growth_snapshot_created',
      snapshot: rows[0]
    });
  } catch (error) {
    console.error('Growth snapshot error:', error);
    res.status(500).json({
      error: 'server_error'
    });
  }
});

module.exports = router;