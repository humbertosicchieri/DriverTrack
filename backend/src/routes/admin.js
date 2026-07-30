const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../utils/database');
const { adminMiddleware } = require('../utils/auth');
const { validatePasswordComplexity } = require('../utils/password');

router.use(adminMiddleware);

// List all users
router.get('/users', (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC').all();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// Get single user
router.get('/users/:id', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

// Create user
router.post('/users', [
  body('name').trim().isLength({ min: 2 }).withMessage('Nome deve ter pelo menos 2 caracteres'),
  body('email').isEmail().normalizeEmail().withMessage('Email invalido'),
  body('password').isLength({ min: 8 }).withMessage('Senha deve ter pelo menos 8 caracteres'),
  body('role').isIn(['admin', 'user']).withMessage('Role invalido')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { name, email, password, role } = req.body;
    const complexityErrors = validatePasswordComplexity(password);
    if (complexityErrors.length > 0) {
      return res.status(400).json({ errors: complexityErrors.map(e => ({ msg: e })) });
    }
    const db = getDb();
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    db.prepare('INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)').run(userId, name, email, hashedPassword, role || 'user');
    res.status(201).json({ id: userId, name, email, role: role || 'user' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// Update user
router.put('/users/:id', [
  body('name').trim().isLength({ min: 2 }).optional(),
  body('email').isEmail().normalizeEmail().optional(),
  body('role').isIn(['admin', 'user']).optional()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const { name, email, role } = req.body;
    if (email && email !== existing.email) {
      const emailTaken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.params.id);
      if (emailTaken) {
        return res.status(409).json({ error: 'Email já está em uso' });
      }
    }
    db.prepare('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?').run(
      name || existing.name,
      email || existing.email,
      role || existing.role,
      req.params.id
    );
    const updated = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// Reset user password
router.post('/users/:id/reset-password', [
  body('password').isLength({ min: 8 }).withMessage('Senha deve ter pelo menos 8 caracteres')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const complexityErrors = validatePasswordComplexity(req.body.password);
    if (complexityErrors.length > 0) {
      return res.status(400).json({ errors: complexityErrors.map(e => ({ msg: e })) });
    }
    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const hashedPassword = await bcrypt.hash(req.body.password, 12);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.params.id);
    res.json({ message: 'Senha redefinida com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao redefinir senha' });
  }
});

// Delete user
router.delete('/users/:id', (req, res) => {
  try {
    const db = getDb();
    if (req.params.id === req.userId) {
      return res.status(400).json({ error: 'Não é possível excluir seu próprio usuário' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ message: 'Usuário excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
});

// System stats
router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const totalEarnings = db.prepare('SELECT COALESCE(SUM(gross_amount + bonus + tips), 0) as total FROM earnings').get().total;
    const totalExpenses = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses').get().total;
    const totalTrips = db.prepare('SELECT COALESCE(SUM(trips), 0) as total FROM earnings').get().total;
    res.json({ totalUsers, totalEarnings, totalExpenses, totalTrips });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

module.exports = router;
