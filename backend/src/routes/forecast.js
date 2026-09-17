const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/latest', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, forecast, season, generated_at
       FROM forecast_snapshots
       ORDER BY generated_at DESC
       LIMIT 1`
    );

    if (!rows.length) {
      return res.json({
        forecast: null,
        season: null,
        generated_at: null
      });
    }

    let forecast = rows[0].forecast;

    if (typeof forecast === 'string') {
      try {
        forecast = JSON.parse(forecast);
      } catch (parseError) {
        console.error('Forecast JSON parse error:', parseError);
        forecast = {};
      }
    }

    res.json({
      forecast,
      season: rows[0].season,
      generated_at: rows[0].generated_at
    });
  } catch (error) {
    console.error('Get latest forecast error:', error);
    res.status(500).json({
      error: 'server_error'
    });
  }
});

router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const [products] = await db.query(
      `SELECT
         id,
         name,
         category,
         quantity,
         expiry_date,
         price
       FROM products
       WHERE user_id = ?
       ORDER BY quantity DESC, name ASC`,
      [req.user.id]
    );

    const totalValue = products.reduce(
      (sum, product) =>
        sum + Number(product.quantity) * Number(product.price),
      0
    );

    const totalUnits = products.reduce(
      (sum, product) => sum + Number(product.quantity),
      0
    );

    const bestSellers = products
      .slice(0, 5)
      .map(product => ({
        name: product.name,
        category: product.category,
        current_quantity: Number(product.quantity),
        forecast_quantity: Math.max(
          0,
          Math.round(Number(product.quantity) * 1.1)
        )
      }));

    const demandForecast = products.slice(0, 10).map(product => ({
      product: product.name,
      category: product.category,
      current_quantity: Number(product.quantity),
      predicted_demand: Math.max(
        0,
        Math.round(Number(product.quantity) * 1.1)
      )
    }));

    const restockAlerts = products
      .filter(product => Number(product.quantity) <= 5)
      .map(product => ({
        product: product.name,
        current_quantity: Number(product.quantity),
        recommended_quantity: 10
      }));

    const riskAlerts = products
      .filter(product => {
        const expiry = new Date(product.expiry_date);
        const today = new Date();

        const days =
          Math.ceil(
            (expiry - today) / (1000 * 60 * 60 * 24)
          );

        return days <= 14;
      })
      .map(product => ({
        product: product.name,
        expiry_date: product.expiry_date,
        risk: 'expiry_risk'
      }));

    const forecast = {
      summary: {
        total_products: products.length,
        total_units: totalUnits,
        current_inventory_value: Number(totalValue.toFixed(2)),
        projected_inventory_value: Number(
          (totalValue * 1.1).toFixed(2)
        )
      },

      season_insight: {
        season: 'General',
        insight:
          'Forecast generated from current inventory data. Seasonal intelligence can be added when historical sales data is available.'
      },

      '30_day_value_forecast': {
        current_value: Number(totalValue.toFixed(2)),
        projected_value: Number(
          (totalValue * 1.1).toFixed(2)
        )
      },

      best_sellers_forecast: bestSellers,

      demand_forecast: demandForecast,

      festival_opportunities: [],

      restock_alerts: restockAlerts,

      risk_alerts: riskAlerts,

      global_trends: [],

      price_recommendations: []
    };

    const season = 'General';

    const [result] = await db.query(
      `INSERT INTO forecast_snapshots (forecast, season)
       VALUES (?, ?)`,
      [JSON.stringify(forecast), season]
    );

    const [rows] = await db.query(
      `SELECT id, forecast, season, generated_at
       FROM forecast_snapshots
       WHERE id = ?`,
      [result.insertId]
    );

    let savedForecast = rows[0].forecast;

    if (typeof savedForecast === 'string') {
      savedForecast = JSON.parse(savedForecast);
    }

    res.status(201).json({
      message: 'forecast_generated',
      forecast: savedForecast,
      season: rows[0].season,
      generated_at: rows[0].generated_at
    });
  } catch (error) {
    console.error('Generate forecast error:', error);
    res.status(500).json({
      error: 'server_error'
    });
  }
});

module.exports = router;