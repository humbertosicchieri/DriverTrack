const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../utils/database');
const { generateToken, authMiddleware } = require('../utils/auth');
const { validatePasswordComplexity } = require('../utils/password');
const { TOTP } = require('otpauth');
const QRCode = require('qrcode');

// Register
router.post('/register', [
  body('name').trim().isLength({ min: 2 }).withMessage('Nome deve ter pelo menos 2 caracteres'),
  body('email').isEmail().normalizeEmail().withMessage('Email invalido'),
  body('password').isLength({ min: 8 }).withMessage('Senha deve ter pelo menos 8 caracteres')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { name, email, password } = req.body;
    const complexityErrors = validatePasswordComplexity(password);
    if (complexityErrors.length > 0) {
      return res.status(400).json({ errors: complexityErrors.map(e => ({ msg: e })) });
    }
    const db = getDb();
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email ja cadastrado' });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    db.prepare('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)').run(userId, name, email, hashedPassword);
    const token = generateToken(userId);
    res.status(201).json({ token, user: { id: userId, name, email, role: 'user', totp_enabled: 0 } });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { email, password, totpCode } = req.body;
    
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }
    if (user.totp_enabled) {
      if (!totpCode) {
        const tempToken = require('../utils/auth').generateTempToken(user.id);
        return res.json({ requires2FA: true, tempToken });
      }
      const totp = new TOTP({ issuer: 'DriverTrack', label: user.email, algorithm: 'SHA1', digits: 6, period: 30, secret: user.totp_secret });
      const delta = totp.validate({ token: totpCode, window: 1 });
      if (delta === null) {
        return res.status(401).json({ error: 'Codigo 2FA invalido' });
      }
    }
    const token = generateToken(user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, totp_enabled: user.totp_enabled } });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Verify 2FA code (after password verified)
router.post('/login/2fa', [
  body('tempToken').notEmpty().withMessage('Token temporario obrigatorio'),
  body('totpCode').isLength({ min: 6, max: 6 }).withMessage('Codigo deve ter 6 digitos')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { tempToken, totpCode } = req.body;
    const { verifyTempToken } = require('../utils/auth');
    const userId = verifyTempToken(tempToken);
    if (!userId) {
      return res.status(401).json({ error: 'Token invalido ou expirado' });
    }
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user || !user.totp_enabled || !user.totp_secret) {
      return res.status(400).json({ error: '2FA nao configurado' });
    }
    const totp = new TOTP({ issuer: 'DriverTrack', label: user.email, algorithm: 'SHA1', digits: 6, period: 30, secret: user.totp_secret });
    const delta = totp.validate({ token: totpCode, window: 1 });
    if (delta === null) {
      return res.status(401).json({ error: 'Codigo 2FA invalido' });
    }
    const token = generateToken(user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, totp_enabled: 1 } });
  } catch (error) {
    console.error('Erro na verificacao 2FA:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get current user
router.get('/me', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, name, email, role, created_at, totp_enabled FROM users WHERE id = ?').get(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Update own profile
router.put('/profile', authMiddleware, [
  body('name').trim().isLength({ min: 2 }).withMessage('Nome deve ter pelo menos 2 caracteres'),
  body('email').isEmail().normalizeEmail().withMessage('Email invalido')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    const { name, email } = req.body;
    if (email !== user.email) {
      const emailTaken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.userId);
      if (emailTaken) {
        return res.status(409).json({ error: 'Email ja esta em uso' });
      }
    }
    db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(
      name || user.name,
      email || user.email,
      req.userId
    );
    const updated = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.userId);
    res.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

// Delete own account
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (user.role === 'admin' && totalUsers <= 1) {
      return res.status(400).json({ error: 'Nao e possivel excluir o unico administrador' });
    }
    db.prepare('DELETE FROM earnings WHERE user_id = ?').run(req.userId);
    db.prepare('DELETE FROM expenses WHERE user_id = ?').run(req.userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.userId);
    res.json({ message: 'Conta excluida com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir conta:', error);
    res.status(500).json({ error: 'Erro ao excluir conta' });
  }
});

// Change password
router.post('/change-password', authMiddleware, [
  body('currentPassword').notEmpty().withMessage('Senha atual obrigatoria'),
  body('newPassword').isLength({ min: 8 }).withMessage('Nova senha deve ter pelo menos 8 caracteres')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { currentPassword, newPassword } = req.body;
    const complexityErrors = validatePasswordComplexity(newPassword);
    if (complexityErrors.length > 0) {
      return res.status(400).json({ errors: complexityErrors.map(e => ({ msg: e })) });
    }
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.userId);
    res.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get password strength
router.post('/password-strength', [
  body('password').notEmpty()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { getPasswordStrength } = require('../utils/password');
  const result = getPasswordStrength(req.body.password);
  const complexity = validatePasswordComplexity(req.body.password);
  res.json({ ...result, valid: complexity.length === 0, errors: complexity });
});

// === 2FA Routes ===

// Setup 2FA - generate secret and QR code
router.post('/2fa/setup', authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, email, totp_enabled FROM users WHERE id = ?').get(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    if (user.totp_enabled) {
      return res.status(400).json({ error: '2FA ja esta habilitado. Desabilite primeiro.' });
    }
    const totp = new TOTP({
      issuer: 'DriverTrack',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30
    });
    const secret = totp.secret;
    const otpauthUrl = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(secret, req.userId);
    res.json({ secret: secret.base32, qrCode: qrCodeDataUrl, otpauthUrl });
  } catch (error) {
    console.error('Erro ao configurar 2FA:', error);
    res.status(500).json({ error: 'Erro ao configurar 2FA' });
  }
});

// Verify and enable 2FA
router.post('/2fa/verify', authMiddleware, [
  body('code').isLength({ min: 6, max: 6 }).withMessage('Codigo deve ter 6 digitos')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    if (!user.totp_secret) {
      return res.status(400).json({ error: 'Execute setup 2FA primeiro' });
    }
    if (user.totp_enabled) {
      return res.status(400).json({ error: '2FA ja habilitado' });
    }
    const totp = new TOTP({ issuer: 'DriverTrack', label: user.email, algorithm: 'SHA1', digits: 6, period: 30, secret: user.totp_secret });
    const delta = totp.validate({ token: req.body.code, window: 1 });
    if (delta === null) {
      return res.status(401).json({ error: 'Codigo invalido. Tente novamente.' });
    }
    db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(req.userId);
    res.json({ message: '2FA habilitado com sucesso' });
  } catch (error) {
    console.error('Erro ao verificar 2FA:', error);
    res.status(500).json({ error: 'Erro ao verificar 2FA' });
  }
});

// Disable 2FA
router.post('/2fa/disable', authMiddleware, [
  body('password').notEmpty().withMessage('Senha obrigatoria para desabilitar 2FA'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('Codigo deve ter 6 digitos')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { password, code } = req.body;
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    if (!user.totp_enabled) {
      return res.status(400).json({ error: '2FA nao esta habilitado' });
    }
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }
    const totp = new TOTP({ issuer: 'DriverTrack', label: user.email, algorithm: 'SHA1', digits: 6, period: 30, secret: user.totp_secret });
    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) {
      return res.status(401).json({ error: 'Codigo 2FA invalido' });
    }
    db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?').run(req.userId);
    res.json({ message: '2FA desabilitado com sucesso' });
  } catch (error) {
    console.error('Erro ao desabilitar 2FA:', error);
    res.status(500).json({ error: 'Erro ao desabilitar 2FA' });
  }
});

module.exports = router;
