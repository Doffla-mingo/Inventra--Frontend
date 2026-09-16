require('dotenv').config();

const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

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
