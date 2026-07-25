const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDatabase } = require('./utils/database');
const authRoutes = require('./routes/auth');
const earningsRoutes = require('./routes/earnings');
const expensesRoutes = require('./routes/expenses');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' }
});
app.use('/api/', limiter);

// Stricter rate limit for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }
});
app.use('/api/auth/', authLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/earnings', earningsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}).catch((err) => {
  console.error('Erro ao inicializar banco de dados:', err);
  process.exit(1);
});
