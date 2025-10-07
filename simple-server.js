const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Basic API endpoints
app.get('/api/daily-horoscope', (req, res) => {
  res.json({
    sign: req.query.sign || 'aries',
    horoscope: 'Today is a great day for new beginnings!',
    date: new Date().toISOString().split('T')[0]
  });
});

app.get('/api/compatibility', (req, res) => {
  const { sign1, sign2 } = req.query;
  res.json({
    sign1: sign1 || 'aries',
    sign2: sign2 || 'leo',
    compatibility: 85,
    description: 'Great compatibility between these signs!'
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint working' });
});

app.listen(PORT, () => {
  console.log(`🚀 Simple Backend Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});