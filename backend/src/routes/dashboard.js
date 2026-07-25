const express = require('express');
const router = express.Router();
const { getDb } = require('../utils/database');
const { authMiddleware } = require('../utils/auth');

router.use(authMiddleware);

// Get dashboard summary
router.get('/summary', (req, res) => {
  try {
    const db = getDb();
    const { period } = req.query; // 'week', 'month', 'year', 'all'

    const now = new Date();
    let dateParam = null;

    switch (period) {
      case 'week': {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        dateParam = d.toISOString().split('T')[0];
        break;
      }
      case 'month': {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 1);
        dateParam = d.toISOString().split('T')[0];
        break;
      }
      case 'year': {
        const d = new Date(now);
        d.setFullYear(d.getFullYear() - 1);
        dateParam = d.toISOString().split('T')[0];
        break;
      }
    }

    const dateClause = dateParam ? ' AND date >= ?' : '';
    const dateArgs = dateParam ? [req.userId, dateParam] : [req.userId];

    // Total earnings by platform
    const uberEarnings = db.prepare(`
      SELECT COALESCE(SUM(gross_amount + bonus + tips), 0) as total
      FROM earnings WHERE user_id = ? AND platform = 'uber' ${dateClause}
    `).get(...dateArgs);

    const nine9Earnings = db.prepare(`
      SELECT COALESCE(SUM(gross_amount + bonus + tips), 0) as total
      FROM earnings WHERE user_id = ? AND platform = '99' ${dateClause}
    `).get(...dateArgs);

    const totalEarnings = db.prepare(`
      SELECT COALESCE(SUM(gross_amount + bonus + tips), 0) as total
      FROM earnings WHERE user_id = ? ${dateClause}
    `).get(...dateArgs);

    const totalTrips = db.prepare(`
      SELECT COALESCE(SUM(trips), 0) as total
      FROM earnings WHERE user_id = ? ${dateClause}
    `).get(...dateArgs);

    // Total expenses
    const totalExpenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses WHERE user_id = ? ${dateClause}
    `).get(...dateArgs);

    // Expenses by category
    const expensesByCategory = db.prepare(`
      SELECT category, SUM(amount) as total
      FROM expenses WHERE user_id = ? ${dateClause}
      GROUP BY category ORDER BY total DESC
    `).all(...dateArgs);

    // Daily earnings (last 30 days)
    const dailyData = db.prepare(`
      SELECT date,
        SUM(CASE WHEN platform = 'uber' THEN gross_amount + bonus + tips ELSE 0 END) as uber,
        SUM(CASE WHEN platform = '99' THEN gross_amount + bonus + tips ELSE 0 END) as nine9
      FROM earnings WHERE user_id = ?
      AND date >= date('now', '-30 days')
      GROUP BY date ORDER BY date
    `).all(req.userId);

    // Daily expenses (last 30 days)
    const dailyExpenses = db.prepare(`
      SELECT date, SUM(amount) as total
      FROM expenses WHERE user_id = ?
      AND date >= date('now', '-30 days')
      GROUP BY date ORDER BY date
    `).all(req.userId);

    // Top expense categories
    const topExpenses = db.prepare(`
      SELECT category, SUM(amount) as total, COUNT(*) as count
      FROM expenses WHERE user_id = ? ${dateClause}
      GROUP BY category ORDER BY total DESC LIMIT 5
    `).all(...dateArgs);

    const netProfit = totalEarnings.total - totalExpenses.total;
    const avgPerTrip = totalTrips.total > 0 ? totalEarnings.total / totalTrips.total : 0;

    res.json({
      earnings: {
        uber: uberEarnings.total,
        nine9: nine9Earnings.total,
        total: totalEarnings.total
      },
      expenses: {
        total: totalExpenses.total,
        byCategory: expensesByCategory
      },
      stats: {
        totalTrips: totalTrips.total,
        netProfit,
        avgPerTrip,
        profitMargin: totalEarnings.total > 0 ? (netProfit / totalEarnings.total * 100) : 0
      },
      charts: {
        dailyEarnings: dailyData,
        dailyExpenses,
        topExpenses
      }
    });
  } catch (error) {
    console.error('Erro no dashboard:', error);
    res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
});

// Get daily details
router.get('/daily', (req, res) => {
  try {
    const db = getDb();
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const earnings = db.prepare(`
      SELECT * FROM earnings WHERE user_id = ? AND date = ?
    `).all(req.userId, targetDate);

    const expenses = db.prepare(`
      SELECT * FROM expenses WHERE user_id = ? AND date = ?
    `).all(req.userId, targetDate);

    const totalEarnings = earnings.reduce((sum, e) => sum + e.gross_amount + e.bonus + e.tips, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    res.json({
      date: targetDate,
      earnings,
      expenses,
      totalEarnings,
      totalExpenses,
      netProfit: totalEarnings - totalExpenses
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar detalhes diários' });
  }
});

module.exports = router;
