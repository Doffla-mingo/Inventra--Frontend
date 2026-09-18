require('dotenv').config();

const express = require('express');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Database
const db = require('./db');

// Routes
const authRoutes = require('./routes/auth');
const verificationRoutes = require('./routes/verification');
const meRoutes = require('./routes/me');
const profileRoutes = require('./routes/profile');
const passwordRoutes = require('./routes/password');
const productsRoutes = require('./routes/products');
const barcodeRoutes = require('./routes/barcode');
const triggersRoutes = require('./routes/triggers');
const emailsRoutes = require('./routes/emails');
const growthRoutes = require('./routes/growth');
const forecastRoutes = require('./routes/forecast');
const chatRoutes = require('./routes/chat');

// Authentication
app.use('/api/auth', authRoutes);
app.use('/api/auth/me', meRoutes);
app.use('/api/auth', verificationRoutes);
app.use('/api/auth/profile', profileRoutes);
app.use('/api/auth/password', passwordRoutes);

// Products
app.use('/api/products', productsRoutes);
app.use('/api/barcode', barcodeRoutes);

// Triggers and emails
app.use('/api/triggers', triggersRoutes);
app.use('/api/emails', emailsRoutes);

// Growth and forecast
app.use('/api/growth', growthRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/chat', chatRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');

    res.json({
      message: 'Inventra backend is running',
      database: 'connected'
    });
  } catch (error) {
    console.error('Database connection error:', error.message);

    res.status(500).json({
      message: 'Inventra backend is running',
      database: 'disconnected'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Inventra backend running on http://localhost:${PORT}`);
});
