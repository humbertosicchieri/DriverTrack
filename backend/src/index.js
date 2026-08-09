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
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');

// Trust the first proxy hop (Cloudflare/host proxy) so the real client IP is
// used for rate limiting. Fixes ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set('trust proxy', 1);

// Security middleware. CSP allows the CDN assets the frontend uses
// (Chart.js and Google Fonts).
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"]
    }
  }
}));
// CORS is only needed for cross-origin access. The frontend is served by the
// same origin, so CORS stays disabled by default. Set CORS_ORIGIN in
// .env (e.g. https://app.exemplo.com) to allow a specific origin.
const corsOrigin = process.env.CORS_ORIGIN || false;
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '1mb' }));

// Never cache anything (prevents browser/Cloudflare from serving stale data)
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Serve the frontend static files (single-container setup: no nginx needed)
app.use(express.static(FRONTEND_DIR));

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
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.1.0', timestamp: new Date().toISOString() });
});

// SPA fallback: unknown non-API paths serve the login page (like nginx try_files)
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Rota não encontrada' });
  }
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor v1.1.0 rodando na porta ${PORT}`);
  });
}).catch((err) => {
  console.error('Erro ao inicializar banco de dados:', err);
  process.exit(1);
});
