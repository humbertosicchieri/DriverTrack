const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'driver-tracker-secret-change-in-production-' + require('crypto').randomBytes(32).toString('hex');

const tempTokens = new Map();

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}

function generateTempToken(userId) {
  const token = require('crypto').randomBytes(32).toString('hex');
  tempTokens.set(token, { userId, expires: Date.now() + 5 * 60 * 1000 });
  return token;
}

function verifyTempToken(token) {
  const data = tempTokens.get(token);
  if (!data) return null;
  if (Date.now() > data.expires) {
    tempTokens.delete(token);
    return null;
  }
  tempTokens.delete(token);
  return data.userId;
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação necessário' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

function adminMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação necessário' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    const { getDb } = require('./database');
    const db = getDb();
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

module.exports = { generateToken, generateTempToken, verifyTempToken, authMiddleware, adminMiddleware, JWT_SECRET };
