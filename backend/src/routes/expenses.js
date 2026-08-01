const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../utils/database');
const { authMiddleware } = require('../utils/auth');

router.use(authMiddleware);

const CATEGORIES = [
  'combustivel', 'manutencao', 'seguro', 'lavagem', 'alimentacao',
  'estacionamento', 'taxa_plataforma', 'imposto', 'celular', 'outros'
];

// Get all expenses
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { start_date, end_date, category } = req.query;
    
    let query = 'SELECT * FROM expenses WHERE user_id = ?';
    const params = [req.userId];

    if (start_date) {
      query += ' AND date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND date <= ?';
      params.push(end_date);
    }
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY date DESC, created_at DESC';
    const expenses = db.prepare(query).all(...params);
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar despesas' });
  }
});

// Add expense
router.post('/', [
  body('date').isDate(),
  body('category').isIn(CATEGORIES),
  body('amount').isFloat({ min: 0.01 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const db = getDb();
    const { date, category, description, amount, recurring } = req.body;
    const id = uuidv4();

    db.prepare(
      'INSERT INTO expenses (id, user_id, date, category, description, amount, recurring) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, req.userId, date, category, description || null, amount, recurring ? 1 : 0);

    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    res.status(201).json(expense);
  } catch (error) {
    console.error('Erro ao adicionar despesa:', error);
    res.status(500).json({ error: 'Erro ao adicionar despesa' });
  }
});

// Update expense
router.put('/:id', [
  body('date').isDate().optional(),
  body('category').isIn(CATEGORIES).optional(),
  body('amount').isFloat({ min: 0.01 }).optional()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const db = getDb();
    const { date, category, description, amount, recurring } = req.body;
    
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!existing) {
      return res.status(404).json({ error: 'Registro não encontrado' });
    }

    db.prepare(
      'UPDATE expenses SET date = ?, category = ?, description = ?, amount = ?, recurring = ? WHERE id = ? AND user_id = ?'
    ).run(
      date ?? existing.date,
      category ?? existing.category,
      description ?? existing.description,
      amount ?? existing.amount,
      recurring !== undefined ? (recurring ? 1 : 0) : existing.recurring,
      req.params.id,
      req.userId
    );

    const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar despesa:', error);
    res.status(500).json({ error: 'Erro ao atualizar despesa' });
  }
});

// Delete expense
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Registro não encontrado' });
    }
    res.json({ message: 'Registro excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir despesa:', error);
    res.status(500).json({ error: 'Erro ao excluir despesa' });
  }
});

// Get categories
router.get('/categories', (req, res) => {
  res.json(CATEGORIES);
});

module.exports = router;
