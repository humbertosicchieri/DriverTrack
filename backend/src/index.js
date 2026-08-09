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

// Build marker (set by Dockerfile) so we can tell which build is running.
let buildId = 'local';
try {
  buildId = require('fs').readFileSync('/app/BUILD.txt', 'utf8').trim();
} catch {}

// Trust the first proxy hop (Cloudflare/host proxy) so the real client IP is
// used for rate limiting. Fixes ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set('trust proxy', 1);

// Security middleware. CSP allows the CDN assets the frontend uses
// (Chart.js and Google Fonts).
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
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

// Handle malformed JSON bodies: return 400 instead of the default HTML page
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON invalido no corpo da requisicao' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Corpo da requisicao muito grande' });
  }
  next(err);
});

// Never cache API responses (prevents browser/Cloudflare from serving stale data)
app.use('/api/', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Serve the frontend static files (single-container setup: no nginx needed).
// JS/CSS get cache-busted via ?v= in the HTML, so they can be cached safely.
app.use(express.static(FRONTEND_DIR, {
  setHeaders: (res, filePath) => {
    if (/\.(js|css)$/.test(filePath)) {
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.set('Cache-Control', 'no-store');
    }
  }
}));

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
  res.json({ status: 'ok', version: '1.2.2', build: buildId, timestamp: new Date().toISOString() });
});

// SPA fallback: unknown non-API paths serve the login page (like nginx try_files)
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Rota não encontrada' });
  }
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Final error handler: never leak stack traces to the client
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Erro nao tratado:', err);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
  res.status(500).send('Erro interno do servidor');
});

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor v1.2.2 (build ${buildId}) rodando na porta ${PORT}`);
  });
}).catch((err) => {
  console.error('Erro ao inicializar banco de dados:', err);
  process.exit(1);
});
