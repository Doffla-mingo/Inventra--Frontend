
const express = require('express');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/:code', authenticateToken, async (req, res) => {
  try {
    const barcode = req.params.code.trim();

    const demoProducts = {
      '3017620422003': {
        name: 'Nutella',
        category: 'Other',
        supplier: 'Ferrero',
        price: 0
      },
      '5449000000996': {
        name: 'Coca-Cola',
        category: 'Beverages',
        supplier: 'Coca-Cola',
        price: 0
      },
      '4005900061492': {
        name: 'Nivea Cream',
        category: 'Personal Care',
        supplier: 'Nivea',
        price: 0
      },
      '8901058857298': {
        name: 'Britannia Good Day',
        category: 'Snacks',
        supplier: 'Britannia',
        price: 0
      },
      '8906072671018': {
        name: 'Amul Butter',
        category: 'Dairy',
        supplier: 'Amul',
        price: 0
      },
      '0012000001086': {
        name: 'Pepsi',
        category: 'Beverages',
        supplier: 'PepsiCo',
        price: 0
      },
      '8901030895968': {
        name: 'Maggi Noodles',
        category: 'Snacks',
        supplier: 'Nestle',
        price: 0
      },
      '8901719110498': {
        name: 'Haldiram Bhujia',
        category: 'Snacks',
        supplier: 'Haldiram',
        price: 0
      }
    };

    const product = demoProducts[barcode];

    if (!product) {
      return res.json({
        found: false
      });
    }

    res.json({
      found: true,
      ...product
    });
  } catch (error) {
    console.error('Barcode lookup error:', error);
    res.status(500).json({
      error: 'server_error'
    });
  }
});

module.exports = router;
router.get('/:code/predict-expiry', authenticateToken, async (req, res) => {
  try {
    const barcode = req.params.code.trim();

    const predictions = {
      '3017620422003': {
        expiry_date: '2027-06-30',
        reasoning: 'Provisional demo prediction for Nutella based on typical shelf life.'
      },
      '5449000000996': {
        expiry_date: '2027-03-31',
        reasoning: 'Provisional demo prediction for Coca-Cola based on typical shelf life.'
      },
      '4005900061492': {
        expiry_date: '2027-12-31',
        reasoning: 'Provisional demo prediction for Nivea Cream based on typical shelf life.'
      },
      '8901058857298': {
        expiry_date: '2027-09-30',
        reasoning: 'Provisional demo prediction for Britannia Good Day based on typical shelf life.'
      },
      '8906072671018': {
        expiry_date: '2027-05-31',
        reasoning: 'Provisional demo prediction for Amul Butter based on typical shelf life.'
      },
      '0012000001086': {
        expiry_date: '2027-03-31',
        reasoning: 'Provisional demo prediction for Pepsi based on typical shelf life.'
      },
      '8901030895968': {
        expiry_date: '2027-08-31',
        reasoning: 'Provisional demo prediction for Maggi Noodles based on typical shelf life.'
      },
      '8901719110498': {
        expiry_date: '2027-10-31',
        reasoning: 'Provisional demo prediction for Haldiram Bhujia based on typical shelf life.'
      }
    };

    const prediction = predictions[barcode];

    if (!prediction) {
      return res.status(404).json({
        error: 'prediction_not_available'
      });
    }

    res.json(prediction);
  } catch (error) {
    console.error('Expiry prediction error:', error);
    res.status(500).json({
      error: 'server_error'
    });
  }
});
