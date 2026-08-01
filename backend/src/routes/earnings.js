const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../utils/database');
const { authMiddleware } = require('../utils/auth');

router.use(authMiddleware);

// Get all earnings (with optional date filter)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { start_date, end_date, platform } = req.query;
    
    let query = 'SELECT * FROM earnings WHERE user_id = ?';
    const params = [req.userId];

    if (start_date) {
      query += ' AND date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND date <= ?';
      params.push(end_date);
    }
    if (platform) {
      query += ' AND platform = ?';
      params.push(platform);
    }

    query += ' ORDER BY date DESC, created_at DESC';
    const earnings = db.prepare(query).all(...params);
    res.json(earnings);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar ganhos' });
  }
});

// Add earning
router.post('/', [
  body('platform').isIn(['uber', '99']),
  body('date').isDate(),
  body('gross_amount').isFloat({ min: 0 }),
  body('trips').isInt({ min: 0 }).optional(),
  body('bonus').isFloat({ min: 0 }).optional(),
  body('tips').isFloat({ min: 0 }).optional()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const db = getDb();
    const { platform, date, gross_amount, trips, bonus, tips, notes } = req.body;
    const id = uuidv4();

    db.prepare(
      'INSERT INTO earnings (id, user_id, platform, date, gross_amount, trips, bonus, tips, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, req.userId, platform, date, gross_amount, trips || 0, bonus || 0, tips || 0, notes || null);

    const earning = db.prepare('SELECT * FROM earnings WHERE id = ?').get(id);
    res.status(201).json(earning);
  } catch (error) {
    console.error('Erro ao adicionar ganho:', error);
    res.status(500).json({ error: 'Erro ao adicionar ganho' });
  }
});

// Update earning
router.put('/:id', [
  body('platform').isIn(['uber', '99']).optional(),
  body('date').isDate().optional(),
  body('gross_amount').isFloat({ min: 0 }).optional(),
  body('trips').isInt({ min: 0 }).optional(),
  body('bonus').isFloat({ min: 0 }).optional(),
  body('tips').isFloat({ min: 0 }).optional()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const db = getDb();
    const { platform, date, gross_amount, trips, bonus, tips, notes } = req.body;
    
    const existing = db.prepare('SELECT * FROM earnings WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!existing) {
      return res.status(404).json({ error: 'Registro não encontrado' });
    }

    db.prepare(
      'UPDATE earnings SET platform = ?, date = ?, gross_amount = ?, trips = ?, bonus = ?, tips = ?, notes = ? WHERE id = ? AND user_id = ?'
    ).run(
      platform ?? existing.platform,
      date ?? existing.date,
      gross_amount ?? existing.gross_amount,
      trips ?? existing.trips,
      bonus ?? existing.bonus,
      tips ?? existing.tips,
      notes ?? existing.notes,
      req.params.id,
      req.userId
    );

    const updated = db.prepare('SELECT * FROM earnings WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar ganho:', error);
    res.status(500).json({ error: 'Erro ao atualizar ganho' });
  }
});

// Delete earning
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM earnings WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Registro não encontrado' });
    }
    res.json({ message: 'Registro excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir ganho:', error);
    res.status(500).json({ error: 'Erro ao excluir ganho' });
  }
});

module.exports = router;
