
const jwt = require('jsonwebtoken');
const pool = require('../db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Missing token' });
  
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const [rows] = await pool.query('SELECT * FROM User WHERE user_id=?', [payload.user_id]);
    const u = rows[0];
    
    if (!u || !u.is_active) return res.status(403).json({ error: 'Account inactive' });
    if (!u.is_verified) return res.status(403).json({ error: 'Email not verified' });
    
    req.user = u;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = auth;