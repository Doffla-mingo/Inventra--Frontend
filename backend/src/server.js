require('dotenv').config();

const express = require('express');
const db = require('./db');
const authRoutes = require('./routes/auth');
const meRoutes = require('./routes/me');
const verificationRoutes = require('./routes/verification');
const profileRoutes = require('./routes/profile');
const passwordRoutes = require('./routes/password');
const productsRoutes = require('./routes/products');
const barcodeRoutes = require('./routes/barcode');
const triggersRoutes = require('./routes/triggers');
const emailsRoutes = require('./routes/emails');
const growthRoutes = require('./routes/growth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/auth/me', meRoutes);
app.use('/api/auth', verificationRoutes);
app.use('/api/auth/profile', profileRoutes);
app.use('/api/auth/password', passwordRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/barcode', barcodeRoutes);
app.use('/api/triggers', triggersRoutes);
app.use('/api/emails', emailsRoutes);
app.use('/api/growth', growthRoutes);

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
