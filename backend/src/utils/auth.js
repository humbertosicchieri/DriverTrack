const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'driver-tracker-secret-change-in-production-' + require('crypto').randomBytes(32).toString('hex');

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
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

module.exports = { generateToken, authMiddleware, JWT_SECRET };
