const db = require('../db.js');

async function requireAdmin(req, res, next) {
  // TEMP DEMO BYPASS - Remove auth check
  req.userId = 1;
  next();
}

module.exports = { requireAdmin };
